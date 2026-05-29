#!/usr/bin/env python3
"""
riCycle — orquestrador de scrapers (5 fontes).

Uso:
    python scrapers/run_all.py
    python scrapers/run_all.py --mode incremental
    python scrapers/run_all.py --sources iservices,refurbed,backmarket --categories iphones
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

from common import estimate_per_conversion, setup_logging
from config import ALL_SOURCE_KEYS, CATEGORY_KEYS, DATA_DIR, LAST_RUN_SUMMARY_JSON, PROJECT_ROOT, SOURCE_CONFIGS

logger = logging.getLogger(__name__)

WEB_DATA_DIR = PROJECT_ROOT / "web" / "data"

SOURCE_MODULES = {
    "iservices": "iservices_scraper",
    "refurbed": "refurbed_scraper",
    "backmarket": "backmarket_scraper",
    "swappie": "swappie_scraper",
    "certideal": "certideal_scraper",
    "callphone": "callphone_scraper",
}


def build_affiliate_revenue_estimate() -> dict[str, dict]:
    """Estimativa por conversão a partir das configs de afiliado."""
    estimate: dict[str, dict] = {}
    for source, cfg in SOURCE_CONFIGS.items():
        aff = cfg.get("affiliate", {})
        pct = aff.get("commission_pct")
        basket = aff.get("avg_basket_eur")
        estimate[source] = {
            "commission_pct": pct,
            "avg_basket": basket,
            "est_per_conversion": estimate_per_conversion(cfg),
        }
    return estimate


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="riCycle — corre todos os scrapers")
    parser.add_argument("--mode", choices=("full", "incremental"), default="full")
    parser.add_argument(
        "--sources",
        default=",".join(ALL_SOURCE_KEYS),
        help=f"Fontes separadas por vírgula (default: {','.join(ALL_SOURCE_KEYS)})",
    )
    parser.add_argument(
        "--categories",
        default="",
        help="Categorias separadas por vírgula (default: todas)",
    )
    return parser.parse_args()


def cleanup_source_json(sources: list[str], mode: str) -> None:
    """
    Limpeza pré-scrape: remove JSONs antigos/corrompidos para evitar duplicados
    ou dados parciais de execuções anteriores.
    """
    for source in sources:
        cfg = SOURCE_CONFIGS.get(source)
        if not cfg:
            continue

        output: Path = cfg["output_json"]
        targets = [output, WEB_DATA_DIR / output.name]

        if mode == "full":
            for path in targets:
                if path.exists():
                    path.unlink()
                    logger.info("Limpeza pré-scrape: removido %s", path)
            continue

        if not output.exists():
            continue

        try:
            json.loads(output.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            for path in targets:
                if path.exists():
                    path.unlink()
                    logger.warning("Limpeza pré-scrape: JSON corrompido removido %s", path)


def run_source(source: str, mode: str, categories: list[str] | None) -> dict:
    module_name = SOURCE_MODULES.get(source)
    if not module_name:
        raise ValueError(f"Fonte desconhecida: {source}")

    module = __import__(module_name)
    logger.info("A iniciar scraper: %s", source)
    return module.run_scraper(mode=mode, categories=categories)


def main() -> None:
    setup_logging(DATA_DIR / "run_all.log")
    args = parse_args()

    sources = [s.strip() for s in args.sources.split(",") if s.strip()]
    categories = [c.strip() for c in args.categories.split(",") if c.strip()] or None

    if categories:
        invalid = [c for c in categories if c not in CATEGORY_KEYS]
        if invalid:
            raise ValueError(f"Categorias inválidas: {invalid}. Válidas: {list(CATEGORY_KEYS)}")

    invalid_sources = [s for s in sources if s not in SOURCE_MODULES]
    if invalid_sources:
        raise ValueError(f"Fontes inválidas: {invalid_sources}")

    cleanup_source_json(sources, args.mode)

    run_at = datetime.now(timezone.utc).isoformat()
    summary: dict = {
        "run_at": run_at,
        "mode": args.mode,
        "categories": categories or list(CATEGORY_KEYS),
        "sources": {},
        "grand_total": 0,
        "affiliate_revenue_estimate": build_affiliate_revenue_estimate(),
    }

    for source in sources:
        try:
            stats = run_source(source, args.mode, categories)
            summary["sources"][source] = stats
            summary["grand_total"] += stats.get("total", 0)
        except Exception as exc:
            logger.error("Scraper %s falhou: %s", source, exc, exc_info=True)
            summary["sources"][source] = {
                "total": 0,
                "by_category": {},
                "errors": 1,
                "fatal_error": str(exc),
            }

    LAST_RUN_SUMMARY_JSON.parent.mkdir(parents=True, exist_ok=True)
    with LAST_RUN_SUMMARY_JSON.open("w", encoding="utf-8") as fh:
        json.dump(summary, fh, ensure_ascii=False, indent=2)

    logger.info(
        "Sumário guardado em %s | grand_total=%s",
        LAST_RUN_SUMMARY_JSON,
        summary["grand_total"],
    )


if __name__ == "__main__":
    main()
