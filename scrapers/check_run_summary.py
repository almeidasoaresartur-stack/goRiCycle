#!/usr/bin/env python3
"""Verifica o sumário do scrape antes de publicar os JSON.

O workflow «Scrape diário» chama este script no passo «Verificar sumário»,
que fica antes de «Commit dados actualizados». Exit 1 impede o commit, por
isso um catálogo vazio ou em queda não chega ao site.

Falhas:
- loja crítica com fatal_error (qualquer modo) ou total 0 no full
- Certideal com 0 iPads no full
- loja que tinha ofertas e ficou com 0 (qualquer modo)
- queda de ofertas superior a 80% no full
- all_products.json em falta ou com menos de 400 produtos

Avisos (não falham o job):
- total 0 no incremental
- queda superior a 80% no incremental
- verificação live suspensa ou remoção em massa abortada
"""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
SUMMARY_PATH = DATA_DIR / "last_run_summary.json"
CATALOG_PATH = DATA_DIR / "all_products.json"
VALIDATION_REPORT_PATH = DATA_DIR / "validate_and_clean_report.json"

CRITICAL_STORES = ("iservices", "refurbed", "swappie", "certideal", "callphone")
DROP_LIMIT = 0.80
MIN_CATALOG_PRODUCTS = 400


def product_count(payload: object) -> int:
    if isinstance(payload, dict):
        products = payload.get("products", [])
        return len(products) if isinstance(products, list) else 0
    return 0


def evaluate_run(
    summary: dict,
    *,
    before_counts: dict[str, int | None],
    after_counts: dict[str, int],
    validation_sources: dict | None = None,
    catalog_total: int | None,
) -> tuple[list[str], list[str]]:
    """Devolve (falhas que abortam o job, linhas para o log)."""
    lines: list[str] = []
    hard_fails: list[str] = []
    sources = summary.get("sources") or {}
    mode = summary.get("mode")
    total = summary.get("grand_total", 0)

    lines.append(f"Modo: {mode} | Total scrape: {total}")
    for name, stats in sources.items():
        errors = stats.get("errors", 0)
        count = stats.get("total", 0)
        fatal = stats.get("fatal_error")
        flag = "⚠️" if errors or count == 0 or fatal else "✓"
        lines.append(f"  {flag} {name}: {count} produtos, {errors} erros")
        if fatal:
            lines.append(f"      FATAL: {str(fatal)[:200]}")
        for note in stats.get("warnings") or []:
            lines.append(f"      aviso: {str(note)[:200]}")

    if total < MIN_CATALOG_PRODUCTS:
        lines.append(f"⚠️ grand_total ({total}) abaixo do esperado (~900+)")

    for name in CRITICAL_STORES:
        stats = sources.get(name) or {}
        if stats.get("fatal_error"):
            hard_fails.append(f"{name}: fatal_error")
            lines.append(f"::error::{name} fatal_error: {str(stats.get('fatal_error'))[:200]}")
        elif stats.get("total", 0) == 0:
            message = f"{name}: 0 produtos"
            if mode == "full":
                hard_fails.append(message)
                lines.append(f"::error::{message}")
            else:
                lines.append(
                    f"::warning::{message} (modo {mode}; confirmar se o total é só novidades)"
                )

    # Certideal: iPads a 0 num full significa que a listagem geral deixou de ser lida.
    certideal = sources.get("certideal") or {}
    if mode == "full" and not certideal.get("fatal_error"):
        ipads = (certideal.get("by_category") or {}).get("ipads", 0)
        if ipads == 0:
            hard_fails.append("certideal: 0 iPads no full")
            lines.append("::error::certideal: 0 iPads no full (listagem geral de iPads não lida?)")

    for name in sources:
        before = before_counts.get(name)
        if before is None or before <= 0:
            continue
        after = after_counts.get(name, 0)
        drop = 1 - after / before
        lines.append(f"  Δ {name}: {before} → {after} ofertas ({-drop:+.0%})")
        if after == 0:
            hard_fails.append(f"{name}: {before} → 0 ofertas")
            lines.append(f"::error::{name}: tinha {before} ofertas e veio a 0")
        elif drop > DROP_LIMIT:
            message = f"{name}: queda de {drop:.0%} ({before} → {after})"
            if mode == "full":
                hard_fails.append(message)
                lines.append(f"::error::{message}")
            else:
                lines.append(f"::warning::{message} (modo {mode})")

    for name, stats in (validation_sources or {}).items():
        if stats.get("live_check_stopped") or stats.get("live_removal_aborted"):
            lines.append(
                f"::warning::{name}: verificação live inconclusiva "
                f"({stats.get('live_failed')}/{stats.get('live_checked')} falharam; "
                f"suspensa={stats.get('live_check_stopped')}, "
                f"remoção abortada={stats.get('live_removal_aborted')}) — ofertas mantidas"
            )

    if hard_fails:
        lines.append("❌ Scrapers críticos em falha:")
        for line in hard_fails:
            lines.append(f"  - {line}")
        return hard_fails, lines

    if catalog_total is None:
        hard_fails.append("all_products.json em falta")
        lines.append("❌ all_products.json em falta após merge_and_clean")
        return hard_fails, lines

    lines.append(f"Catálogo merge: {catalog_total} produtos únicos")
    if catalog_total < MIN_CATALOG_PRODUCTS:
        message = f"all_products ({catalog_total}) abaixo de 400"
        hard_fails.append(message)
        lines.append(f"❌ all_products ({catalog_total}) abaixo do esperado (~400+)")
        lines.append(f"::error::{message}")
    return hard_fails, lines


def _published_count(name: str) -> int | None:
    rel = f"data/{name}_produtos.json"
    try:
        completed = subprocess.run(
            ["git", "-C", str(ROOT), "show", f"HEAD:{rel}"],
            check=True,
            capture_output=True,
            text=True,
        )
        return product_count(json.loads(completed.stdout))
    except (subprocess.CalledProcessError, OSError, json.JSONDecodeError, UnicodeError):
        return None


def _current_count(name: str) -> int:
    path = DATA_DIR / f"{name}_produtos.json"
    if not path.exists():
        return 0
    try:
        return product_count(json.loads(path.read_text(encoding="utf-8")))
    except json.JSONDecodeError as exc:
        print(f"::error::{path}: JSON inválido após o scrape ({exc})")
        raise SystemExit(1) from exc


def main() -> int:
    if not SUMMARY_PATH.exists():
        print("❌ last_run_summary.json em falta")
        return 1

    summary = json.loads(SUMMARY_PATH.read_text(encoding="utf-8"))
    sources = summary.get("sources") or {}
    before_counts = {name: _published_count(name) for name in sources}
    after_counts = {name: _current_count(name) for name in sources}

    validation_sources = None
    if VALIDATION_REPORT_PATH.exists():
        validation_sources = json.loads(VALIDATION_REPORT_PATH.read_text(encoding="utf-8")).get(
            "sources", {}
        )

    catalog_total = None
    if CATALOG_PATH.exists():
        catalog = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
        products = catalog.get("products", []) if isinstance(catalog, dict) else []
        catalog_total = catalog.get("total_products", len(products)) if isinstance(catalog, dict) else 0

    hard_fails, lines = evaluate_run(
        summary,
        before_counts=before_counts,
        after_counts=after_counts,
        validation_sources=validation_sources,
        catalog_total=catalog_total,
    )
    for line in lines:
        print(line)
    return 1 if hard_fails else 0


if __name__ == "__main__":
    sys.exit(main())
