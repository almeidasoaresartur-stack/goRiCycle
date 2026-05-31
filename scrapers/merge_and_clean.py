#!/usr/bin/env python3
"""
goRiCycle — fusão e deduplicação por loja dos JSONs de produtos.

Pipeline (ordem fixa — nunca inverter):
  1. PRODUCT_CORRECTIONS → corrige o campo model (dedup usa o nome corrigido)
  2. Deduplicação por loja-modelo-armazenamento-estado
  3. Filtro de antiguidade Samsung/Google

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

from common import (
    detect_brand,
    filter_best_price_per_store,
    is_model_relevant,
    normalize_product_url,
)
from config import DATA_DIR, PROJECT_ROOT

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

WEB_DATA_DIR = PROJECT_ROOT / "web" / "data"
REPORT_PATH = DATA_DIR / "merge_and_clean_report.json"
ALL_PRODUCTS_JSON = DATA_DIR / "all_products.json"
PRODUCT_CORRECTIONS_JSON = DATA_DIR / "product_corrections.json"

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


def _expand_correction_keys(raw: dict[str, str]) -> dict[str, str]:
    """Gera variantes de lookup: URL completa, path normalizado e slug PrestaShop."""
    expanded: dict[str, str] = {}
    for key, value in raw.items():
        cleaned_key = str(key).strip()
        cleaned_value = str(value).strip()
        if not cleaned_key or not cleaned_value:
            continue
        expanded[cleaned_key] = cleaned_value
        if cleaned_key.startswith("http"):
            path = normalize_product_url(cleaned_key)
            if path:
                expanded[path] = cleaned_value
                slug = path.rsplit("/", 1)[-1]
                if slug:
                    expanded[slug] = cleaned_value
        else:
            expanded[cleaned_key.lower()] = cleaned_value
    return expanded


def load_product_corrections(path: Path = PRODUCT_CORRECTIONS_JSON) -> dict[str, str]:
    """Carrega mapa url/product_id/slug → nome correcto (model)."""
    if not path.exists():
        return {}
    try:
        payload = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        log.warning("Correcções inválidas em %s: %s", path, exc)
        return {}
    if isinstance(payload, dict) and "corrections" in payload:
        raw = payload.get("corrections") or {}
    elif isinstance(payload, dict):
        raw = {k: v for k, v in payload.items() if not str(k).startswith("_")}
    else:
        return {}
    cleaned = {
        str(key).strip(): str(value).strip()
        for key, value in raw.items()
        if key and value
    }
    return _expand_correction_keys(cleaned)


def _correction_lookup_keys(product: dict) -> tuple[str, ...]:
    """Chaves possíveis para encontrar override no dicionário de correcções."""
    product_id = (product.get("product_id") or "").strip()
    url = (product.get("url") or "").strip()
    url_path = normalize_product_url(url)
    keys: list[str] = []
    for candidate in (product_id, url, url_path):
        if candidate and candidate not in keys:
            keys.append(candidate)
    if url_path:
        slug = url_path.rsplit("/", 1)[-1]
        if slug and slug not in keys:
            keys.append(slug)
    return tuple(keys)


def lookup_product_correction(product: dict, corrections: dict[str, str]) -> str | None:
    """Devolve model corrigido se existir entrada no dicionário."""
    for key in _correction_lookup_keys(product):
        new_model = corrections.get(key)
        if new_model:
            return new_model
    return None


def apply_product_corrections(
    products: list[dict],
    corrections: dict[str, str],
) -> tuple[list[dict], int]:
    """
    Substitui o campo model quando url ou product_id estiver em PRODUCT_CORRECTIONS.
    Não altera preço, stock ou restantes campos.

    Deve correr sempre antes da deduplicação — a chave usa o model já corrigido.
    """
    if not corrections:
        return products, 0

    applied = 0
    for product in products:
        new_model = lookup_product_correction(product, corrections)
        if not new_model:
            continue

        current = (product.get("model") or "").strip()
        if current == new_model:
            continue

        product["model"] = new_model
        brand = detect_brand(new_model)
        if brand:
            product["brand"] = brand
        applied += 1
        lookup_keys = _correction_lookup_keys(product)
        log.info(
            "Correcção de modelo: %s → %s (%s)",
            current or "?",
            new_model,
            lookup_keys[0] if lookup_keys else "?",
        )

    return products, applied


def process_product_list(
    products: list[dict],
    corrections: dict[str, str],
    *,
    apply_relevance_filter: bool = True,
) -> tuple[list[dict], dict[str, int]]:
    """
    Pipeline único: correcções → deduplicação (model corrigido) → filtro de antiguidade.
    """
    products, corrections_applied = apply_product_corrections(products, corrections)
    kept, removed = filter_best_price_per_store(products, log=log)
    relevance_removed = 0
    if apply_relevance_filter:
        kept, relevance_removed = filter_by_model_relevance(kept)
    return kept, {
        "corrections_applied": corrections_applied,
        "removed": removed,
        "removed_by_relevance": relevance_removed,
    }


def filter_by_model_relevance(products: list[dict]) -> tuple[list[dict], int]:
    """Remove Samsung/Google anteriores a 2022; Apple passa sempre."""
    kept: list[dict] = []
    removed = 0

    for product in products:
        model = product.get("model") or ""
        brand = product.get("brand") or detect_brand(model) or ""
        if is_model_relevant(model, brand):
            kept.append(product)
        else:
            removed += 1

    return kept, removed


def clean_source(
    source_name: str,
    path: Path,
    *,
    dry_run: bool = False,
    sync_web: bool = True,
    corrections: dict[str, str] | None = None,
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
    kept, stats = process_product_list(products, corrections or {})
    removed = stats["removed"]
    relevance_removed = stats["removed_by_relevance"]
    corrections_applied = stats["corrections_applied"]

    log.info(
        "[%s] %s → %s produtos (%s duplicados internos removidos, %s por antiguidade, %s correcções)",
        source_name,
        before,
        len(kept),
        removed,
        relevance_removed,
        corrections_applied,
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
        "removed_by_relevance": relevance_removed,
        "corrections_applied": corrections_applied,
    }


def merge_all_sources(
    sources: dict[str, Path],
    *,
    corrections: dict[str, str] | None = None,
) -> tuple[list[dict], int, int, int]:
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
    kept, stats = process_product_list(combined, corrections or {})
    removed = stats["removed"]
    relevance_removed = stats["removed_by_relevance"]
    corrections_applied = stats["corrections_applied"]
    log.info(
        "Catálogo combinado: %s → %s produtos (%s duplicados removidos na fusão, %s correcções)",
        before,
        len(kept),
        removed,
        corrections_applied,
    )
    return kept, removed, relevance_removed, corrections_applied


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

    corrections = load_product_corrections()
    if corrections:
        log.info("Correcções de modelo carregadas: %s entradas", len(corrections))

    per_source: list[dict] = []
    for source_name, path in sources_to_process.items():
        stats = clean_source(
            source_name,
            path,
            dry_run=args.dry_run,
            sync_web=sync_web,
            corrections=corrections,
        )
        per_source.append(stats)

    merged, merge_removed, merge_relevance_removed, merge_corrections = merge_all_sources(
        sources_to_process,
        corrections=corrections,
    )
    source_relevance_removed = sum(s.get("removed_by_relevance", 0) for s in per_source)
    total_relevance_removed = source_relevance_removed + merge_relevance_removed
    total_corrections = sum(s.get("corrections_applied", 0) for s in per_source) + merge_corrections

    report = {
        "merged_at": datetime.now(timezone.utc).isoformat(),
        "dry_run": args.dry_run,
        "per_source": per_source,
        "combined": {
            "total_unique": len(merged),
            "removed_on_merge": merge_removed,
            "removed_by_relevance": total_relevance_removed,
            "corrections_applied": total_corrections,
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
    log.info(
        "Processando catálogo... | Total de produtos após filtro de antiguidade: %s | Produtos removidos: %s",
        len(merged),
        total_relevance_removed,
    )
    log.info("Catálogo combinado único: %s produtos", len(merged))


if __name__ == "__main__":
    main()
