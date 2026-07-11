#!/usr/bin/env python3
"""
goRiCycle — Agente 1: Curador de Dados.

Corre após merge_and_clean.py e antes do commit do all_products.json.
Limpa URLs/preços inválidos, deduplica por loja, e bloqueia updates com queda
brusca de stock (≥35%) usando a versão commitada de ontem via git show.

Uso:
    python3 scripts/curator.py
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
ALL_PRODUCTS_JSON = ROOT / "data" / "all_products.json"
WEB_ALL_PRODUCTS_JSON = ROOT / "web" / "data" / "all_products.json"
CURATION_REPORT_JSON = ROOT / "data" / "curation_report.json"

KNOWN_SOURCES = ("iservices", "refurbed", "swappie", "certideal", "callphone")

PRICE_MIN, PRICE_MAX = 30, 3000
DROP_THRESHOLD = 0.35
KEEP_RATIO = 1 - DROP_THRESHOLD

BAD_URL_PATTERNS = ("/procurar", "search_query", "/search/", "/c/", "/cat", "/categoria")


def load_json(path: Path) -> dict:
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def save_json(path: Path, data: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def load_yesterday_catalog() -> dict | None:
    result = subprocess.run(
        ["git", "show", "HEAD:data/all_products.json"],
        capture_output=True,
        text=True,
        cwd=ROOT,
    )
    if result.returncode != 0:
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        return None


def store_name(product: dict) -> str:
    return (product.get("source") or product.get("loja") or "").strip().lower()


def group_by_store(products: list[dict]) -> dict[str, list[dict]]:
    groups: dict[str, list[dict]] = defaultdict(list)
    for product in products:
        store = store_name(product)
        if store:
            groups[store].append(product)
    return dict(groups)


def is_invalid_product(product: dict) -> bool:
    url = (product.get("url") or "").strip()
    if not url:
        return True

    url_lower = url.lower()
    if any(pattern in url_lower for pattern in BAD_URL_PATTERNS):
        return True

    price = product.get("price")
    if price is None:
        return True

    try:
        price_value = float(price)
    except (TypeError, ValueError):
        return True

    return not (PRICE_MIN <= price_value <= PRICE_MAX)


def dedupe_key(product: dict) -> tuple:
    return (
        (product.get("model") or "").strip(),
        (product.get("storage") or "").strip(),
        (product.get("color") or "").strip(),
        (product.get("grade") or product.get("condition") or "").strip(),
        store_name(product),
    )


def dedupe_keep_cheapest(products: list[dict]) -> list[dict]:
    seen: dict[tuple, dict] = {}
    for product in products:
        key = dedupe_key(product)
        try:
            price_value = float(product.get("price"))
        except (TypeError, ValueError):
            price_value = float("inf")

        if key not in seen:
            seen[key] = product
            continue

        try:
            existing_price = float(seen[key].get("price"))
        except (TypeError, ValueError):
            existing_price = float("inf")

        if price_value < existing_price:
            seen[key] = product

    return list(seen.values())


def process_store_today(products: list[dict]) -> tuple[list[dict], dict]:
    hoje_bruto = len(products)
    valid = [product for product in products if not is_invalid_product(product)]
    removidos_invalidos = hoje_bruto - len(valid)
    deduped = dedupe_keep_cheapest(valid)
    removidos_duplicados = len(valid) - len(deduped)

    return deduped, {
        "hoje_bruto": hoje_bruto,
        "removidos_invalidos": removidos_invalidos,
        "removidos_duplicados": removidos_duplicados,
        "final": len(deduped),
    }


def write_summary(report: dict) -> None:
    lines = ["# 🧹 Agente 1 — Relatório de Curadoria\n"]
    if report["alerts"]:
        lines.append("## ⚠️ Alertas\n")
        for alert in report["alerts"]:
            lines.append(f"- {alert}")
        lines.append("")
    lines.append("## Resumo por loja\n")
    lines.append("| Loja | Ontem | Hoje (bruto) | Inválidos removidos | Duplicados removidos | Final |")
    lines.append("|---|---|---|---|---|---|")
    for store, stats in report["stores"].items():
        lines.append(
            f"| {store} | {stats['ontem']} | {stats['hoje_bruto']} | "
            f"{stats['removidos_invalidos']} | {stats['removidos_duplicados']} | {stats['final']} |"
        )

    summary_text = "\n".join(lines)
    summary_path = os.environ.get("GITHUB_STEP_SUMMARY")
    if summary_path:
        with open(summary_path, "a", encoding="utf-8") as f:
            f.write(summary_text + "\n")
    else:
        print(summary_text)


def curate_catalog(today_catalog: dict, yesterday_catalog: dict | None) -> tuple[dict, dict]:
    today_products = today_catalog.get("products", [])
    yesterday_products = (
        yesterday_catalog.get("products", []) if yesterday_catalog else []
    )

    today_by_store = group_by_store(today_products)
    yesterday_by_store = group_by_store(yesterday_products)

    all_stores = list(KNOWN_SOURCES)
    for store in today_by_store:
        if store not in all_stores:
            all_stores.append(store)
    for store in yesterday_by_store:
        if store not in all_stores:
            all_stores.append(store)

    final_products: list[dict] = []
    report_stores: dict[str, dict] = {}
    alerts: list[str] = []

    for store in all_stores:
        today_store = today_by_store.get(store, [])
        yesterday_store = yesterday_by_store.get(store, [])
        ontem = len(yesterday_store)

        processed, stats = process_store_today(today_store)
        final_today = stats["final"]

        if ontem > 0 and final_today < ontem * KEEP_RATIO:
            drop_pct = (1 - final_today / ontem) * 100
            alerts.append(
                f"**{store}**: queda de {drop_pct:.0f}% ({ontem} → {final_today}) "
                "— mantidos dados de ontem (scraper provavelmente partido)"
            )
            store_products = yesterday_store
            stats["final"] = len(yesterday_store)
            stats["blocked"] = True
        else:
            store_products = processed
            stats["blocked"] = False

        stats["ontem"] = ontem
        report_stores[store] = stats
        final_products.extend(store_products)

    curated_at = datetime.now(timezone.utc).replace(microsecond=0).isoformat()
    catalog_payload = {
        key: value
        for key, value in today_catalog.items()
        if key not in ("products", "total_products")
    }
    catalog_payload["total_products"] = len(final_products)
    catalog_payload["products"] = final_products

    report = {
        "curated_at": curated_at,
        "alerts": alerts,
        "stores": report_stores,
        "total_final": len(final_products),
    }
    return catalog_payload, report


def main() -> int:
    if not ALL_PRODUCTS_JSON.exists():
        print(f"Erro: {ALL_PRODUCTS_JSON} não encontrado", file=sys.stderr)
        return 1

    today_catalog = load_json(ALL_PRODUCTS_JSON)
    yesterday_catalog = load_yesterday_catalog()
    catalog_payload, report = curate_catalog(today_catalog, yesterday_catalog)

    save_json(ALL_PRODUCTS_JSON, catalog_payload)
    save_json(WEB_ALL_PRODUCTS_JSON, catalog_payload)
    save_json(CURATION_REPORT_JSON, report)
    write_summary({"alerts": report["alerts"], "stores": report["stores"]})

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
