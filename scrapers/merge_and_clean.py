#!/usr/bin/env python3
"""
goRiCycle — fusão e deduplicação por loja dos JSONs de produtos.

Para cada fonte, mantém apenas a oferta mais barata por chave:
  loja-modelo-armazenamento-estado  (source-grade no schema actual)

Uso:
    python scrapers/merge_and_clean.py
    python scrapers/merge_and_clean.py --source refurbed
    python scrapers/merge_and_clean.py --dry-run
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path

_SCRAPERS_DIR = Path(__file__).resolve().parent
if str(_SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRAPERS_DIR))

from common import filter_best_price_per_store
from config import DATA_DIR, PROJECT_ROOT

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

WEB_DATA_DIR = PROJECT_ROOT / "web" / "data"
REPORT_PATH = DATA_DIR / "merge_and_clean_report.json"
ALL_PRODUCTS_JSON = DATA_DIR / "all_products.json"

SOURCES: dict[str, Path] = {
    "iservices": DATA_DIR / "iservices_produtos.json",
    "refurbed": DATA_DIR / "refurbed_produtos.json",
    "swappie": DATA_DIR / "swappie_produtos.json",
    "certideal": DATA_DIR / "certideal_produtos.json",
    "callphone": DATA_DIR / "callphone_produtos.json",
}


def load_json(path: Path) -> dict | list | None:
    if not path.exists():
        return None
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(data: dict | list, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def clean_source(
    source_name: str,
    path: Path,
    *,
    dry_run: bool = False,
    sync_web: bool = True,
) -> dict:
    """Deduplica produtos de uma fonte (melhor preço por loja) e guarda o JSON."""
    data = load_json(path)
    if not data:
        log.warning("[%s] Ficheiro não encontrado ou vazio: %s", source_name, path)
        return {"source": source_name, "total": 0, "kept": 0, "removed": 0}

    if isinstance(data, list):
        products = data
        is_list_format = True
    else:
        products = data.get("products", [])
        is_list_format = False

    before = len(products)
    kept, removed = filter_best_price_per_store(products, log=log)

    log.info(
        "[%s] %s → %s produtos (%s duplicados internos removidos)",
        source_name,
        before,
        len(kept),
        removed,
    )

    if not dry_run:
        if is_list_format:
            save_json(kept, path)
        else:
            data["products"] = kept
            data["total_products"] = len(kept)
            data["merged_at"] = datetime.now(timezone.utc).isoformat()
            save_json(data, path)

        if sync_web:
            web_path = WEB_DATA_DIR / path.name
            web_path.parent.mkdir(parents=True, exist_ok=True)
            save_json(data if not is_list_format else kept, web_path)
            log.info("  💾 Sincronizado: %s", web_path)

    return {
        "source": source_name,
        "total": before,
        "kept": len(kept),
        "removed": removed,
    }


def merge_all_sources(sources: dict[str, Path]) -> tuple[list[dict], int]:
    """
    Junta todos os produtos e aplica deduplicação por loja no catálogo combinado.
    Garante que duplicados internos de cada loja são eliminados após a fusão.
    """
    combined: list[dict] = []

    for path in sources.values():
        data = load_json(path)
        if not data:
            continue
        if isinstance(data, list):
            combined.extend(data)
        else:
            combined.extend(data.get("products", []))

    before = len(combined)
    kept, removed = filter_best_price_per_store(combined, log=log)
    log.info(
        "Catálogo combinado: %s → %s produtos (%s duplicados removidos na fusão)",
        before,
        len(kept),
        removed,
    )
    return kept, removed


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="goRiCycle — merge e dedup por loja")
    parser.add_argument(
        "--source",
        default="",
        help="Processar só uma fonte (ex: refurbed)",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Mostra estatísticas sem alterar ficheiros",
    )
    parser.add_argument(
        "--no-sync-web",
        action="store_true",
        help="Não copiar JSONs para web/data/",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    sync_web = not args.no_sync_web

    sources_to_process = (
        {args.source: SOURCES[args.source]}
        if args.source and args.source in SOURCES
        else SOURCES
    )

    if args.dry_run:
        log.info("🔍 MODO DRY RUN — nenhum ficheiro será alterado\n")

    per_source: list[dict] = []
    for source_name, path in sources_to_process.items():
        stats = clean_source(
            source_name,
            path,
            dry_run=args.dry_run,
            sync_web=sync_web,
        )
        per_source.append(stats)

    merged, merge_removed = merge_all_sources(sources_to_process)

    report = {
        "merged_at": datetime.now(timezone.utc).isoformat(),
        "dry_run": args.dry_run,
        "per_source": per_source,
        "combined": {
            "total_unique": len(merged),
            "removed_on_merge": merge_removed,
        },
    }

    if not args.dry_run:
        save_json(report, REPORT_PATH)
        web_report = WEB_DATA_DIR / REPORT_PATH.name
        save_json(report, web_report)
        log.info("📄 Relatório guardado: %s", REPORT_PATH)

        catalog_payload = {
            "merged_at": report["merged_at"],
            "total_products": len(merged),
            "products": merged,
        }
        save_json(catalog_payload, ALL_PRODUCTS_JSON)
        save_json(catalog_payload, WEB_DATA_DIR / ALL_PRODUCTS_JSON.name)
        log.info("📦 Catálogo combinado: %s (%s produtos)", ALL_PRODUCTS_JSON, len(merged))

    total_removed = sum(s["removed"] for s in per_source)
    log.info("\n%s", "=" * 50)
    log.info("TOTAL: %s duplicados removidos por fonte", total_removed)
    log.info("Catálogo combinado único: %s produtos", len(merged))


if __name__ == "__main__":
    main()
