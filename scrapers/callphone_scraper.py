#!/usr/bin/env python3
"""
goRiCycle — scraper Callphone.pt (Shopify JSON API).

A Callphone usa Shopify, que expõe /products.json publicamente.
Não usa Playwright — apenas requests HTTP simples.

Uso:
  python scrapers/callphone_scraper.py --mode full
  python scrapers/callphone_scraper.py --mode incremental
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import httpx

_SCRAPERS_DIR = Path(__file__).resolve().parent
if str(_SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRAPERS_DIR))

from common import build_normalized_product, extract_storage, setup_logging
from config import CALLPHONE_CONFIG

CFG = CALLPHONE_CONFIG
BASE_URL = CFG["base_url"]
PRODUCTS_JSON = CFG["products_json"]
OUTPUT_JSON = CFG["output_json"]
LOG_FILE = CFG["log_file"]
SOURCE_NAME = CFG["source"]

PAGE_LIMIT = 250

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "application/json",
    "Accept-Language": "pt-PT,pt;q=0.9",
}

GRADE_MAP = {
    "a+": "Premium",
    "a plus": "Premium",
    "a": "Excelente",
    "b": "Bom",
    "b+": "Bom",
    "novo": "Premium",
    "new": "Premium",
    "premium": "Premium",
    "excelente": "Excelente",
    "muito bom": "Muito Bom",
    "bom": "Bom",
}

CASE_BRAND_KEYWORDS = (
    "guess",
    "karl lagerfeld",
    "spigen",
    "otterbox",
    "capa",
    "case",
)

logger = logging.getLogger(__name__)


def parse_price(price_str: str | None) -> float | None:
    if not price_str:
        return None
    try:
        price = float(str(price_str).replace(",", "."))
        if price < 30 or price > 3000:
            logger.warning("Preço fora do intervalo válido: €%s", price)
            return None
        return price
    except (ValueError, TypeError):
        return None


def extract_grade_callphone(text: str) -> str | None:
    text_lower = text.lower()
    match = re.search(r"\bgrad[eo]?\s*([ab][+]?)\b", text_lower)
    if match:
        grade_raw = match.group(1).strip()
        return GRADE_MAP.get(grade_raw)
    for key, value in GRADE_MAP.items():
        if re.search(r"\b" + re.escape(key) + r"\b", text_lower):
            return value
    return None


def clean_title(title: str) -> str:
    cleaned = re.sub(r"\s*[-–|·]\s*(grad[eo]?\s*)?[ab][+]?\b", "", title, flags=re.IGNORECASE)
    cleaned = re.sub(
        r"\b(recondicionado|reconditioned|reacondicionado)\b",
        "",
        cleaned,
        flags=re.IGNORECASE,
    )
    return re.sub(r"\s+", " ", cleaned).strip()


def infer_category(product: dict) -> str:
    product_type = product.get("product_type", "").lower()
    tags_text = " ".join(product.get("tags", [])).lower()
    title = product.get("title", "").lower()
    blob = f"{product_type} {tags_text} {title}"

    if any(k in blob for k in ("ipad", "galaxy tab", "tab s", "tab a", "lenovo tab", "tablet")):
        return "tablets" if "galaxy tab" in blob or "tab s" in blob or "tab a" in blob or "lenovo tab" in blob else "ipads"
    if "samsung" in blob and "galaxy" in blob:
        return "samsung_phones"
    return "iphones"


def is_valid_product(product: dict) -> bool:
    title = product.get("title", "").lower()
    product_type = product.get("product_type", "").lower()

    skip_keywords = [
        "capa",
        "case",
        "cabo",
        "cable",
        "carregador",
        "charger",
        "película",
        "screen protector",
        "auricular",
        "headphone",
        "suporte",
        "stand",
        "bateria",
        "battery",
        "apple watch",
        "watch series",
        "galaxy watch",
        "macbook",
        "laptop",
        "portátil",
        "portatil",
        "notebook",
        "airpods",
        "earpods",
    ]
    for kw in skip_keywords:
        if kw in title or kw in product_type:
            return False

    for brand in CASE_BRAND_KEYWORDS:
        if brand in title:
            return False

    return True


def extract_variant_info(variant: dict, product_title: str) -> dict:
    variant_title = variant.get("title", "")
    option1 = (variant.get("option1") or "").strip()
    option2 = (variant.get("option2") or "").strip()
    option3 = (variant.get("option3") or "").strip()

    price = parse_price(variant.get("price"))
    storage = extract_storage(variant_title) or extract_storage(product_title)

    grade = None
    for candidate in (option1, variant_title, product_title):
        if not candidate:
            continue
        mapped = GRADE_MAP.get(candidate.lower())
        if mapped:
            grade = mapped
            break
        grade = extract_grade_callphone(candidate)
        if grade:
            break

    color = None
    if option2 and not re.search(r"\d+\s*gb", option2, re.IGNORECASE):
        color = option2
    elif option1 and not GRADE_MAP.get(option1.lower()) and not re.search(r"\d+\s*gb", option1, re.IGNORECASE):
        color = option1

    if option3:
        sim_label = option3.strip()
        if sim_label:
            color = f"{color} ({sim_label})" if color else sim_label

    return {
        "price": price,
        "storage": storage,
        "color": color,
        "grade": grade,
        "available": variant.get("available", False),
        "variant_id": str(variant.get("id", "")),
    }


def fetch_all_products(client: httpx.Client) -> list[dict]:
    all_products: list[dict] = []
    page = 1

    while True:
        url = f"{PRODUCTS_JSON}?limit={PAGE_LIMIT}&page={page}"
        logger.info("A carregar página %s: %s", page, url)

        try:
            response = client.get(url, timeout=30)
            response.raise_for_status()
            data = response.json()
        except Exception as exc:
            logger.error("Erro ao carregar página %s: %s", page, exc)
            break

        products = data.get("products", [])
        if not products:
            logger.info("Página %s vazia — fim da paginação.", page)
            break

        all_products.extend(products)
        logger.info("Página %s: %s produtos (total: %s)", page, len(products), len(all_products))

        if len(products) < PAGE_LIMIT:
            break

        page += 1
        time.sleep(0.5)

    return all_products


def process_product(shopify_product: dict, scraped_at: str) -> list[dict[str, Any]]:
    title = shopify_product.get("title", "")
    title_lower = title.lower()

    wearable_keywords = ["watch", "relógio", "relogio", "wearable", "airpod", "earpod"]
    if any(k in title_lower for k in wearable_keywords):
        return []

    laptop_keywords = ["macbook", "laptop", "portátil", "portatil", "notebook", "mac mini", "imac"]
    if any(k in title_lower for k in laptop_keywords):
        return []

    if not is_valid_product(shopify_product):
        return []
    handle = shopify_product.get("handle", "")
    variants = shopify_product.get("variants", [])
    category = infer_category(shopify_product)

    images = shopify_product.get("images", [])
    image_url = images[0].get("src") if images else None

    records: list[dict[str, Any]] = []
    seen_combos: set[str] = set()

    for variant in variants:
        info = extract_variant_info(variant, title)
        if info["price"] is None:
            continue

        product_url = f"{BASE_URL}/products/{handle}"
        if info["variant_id"]:
            product_url += f"?variant={info['variant_id']}"

        combo = info["variant_id"] or f"{handle}|{info['storage']}|{info['grade']}|{info['color']}"
        if combo in seen_combos:
            continue
        seen_combos.add(combo)

        clean_name = clean_title(title)

        try:
            record = build_normalized_product(
                CFG,
                category=category,
                url=product_url,
                model=clean_name,
                price=info["price"],
                image_url=image_url,
                source_page=PRODUCTS_JSON,
                scraped_at=scraped_at,
                storage=info["storage"],
                grade=info["grade"],
                color=info["color"],
            )
            if info["variant_id"]:
                record["product_id"] = f"{SOURCE_NAME}_{info['variant_id']}"
            records.append(record)
        except Exception as exc:
            logger.error("Erro ao processar variante '%s': %s", title, exc)

    return records


def load_existing(path: Path) -> tuple[list[dict[str, Any]], set[str]]:
    if not path.exists():
        return [], set()
    data = json.loads(path.read_text(encoding="utf-8"))
    products = data.get("products", [])
    return products, {p["product_id"] for p in products if p.get("product_id")}


def save(products: list[dict[str, Any]], path: Path, scraped_at: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(
        json.dumps(
            {
                "source": SOURCE_NAME,
                "scraped_at": scraped_at,
                "total_products": len(products),
                "products": products,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    logger.info("JSON guardado: %s (%s produtos)", path, len(products))


def run_scraper(mode: str = "full", categories: list[str] | None = None) -> dict[str, Any]:
    del categories  # Callphone usa catálogo Shopify completo
    scraped_at = datetime.now(timezone.utc).isoformat()
    stats: dict[str, Any] = {"total": 0, "by_category": {}, "errors": 0}

    if mode == "incremental":
        products, known_ids = load_existing(OUTPUT_JSON)
    else:
        products, known_ids = [], set()

    with httpx.Client(headers=HEADERS, follow_redirects=True) as client:
        shopify_products = fetch_all_products(client)

    logger.info("Total produtos Shopify: %s", len(shopify_products))

    for shopify_product in shopify_products:
        records = process_product(shopify_product, scraped_at)
        for record in records:
            if mode == "incremental" and record["product_id"] in known_ids:
                continue
            products.append(record)
            known_ids.add(record["product_id"])
            category = record.get("category", "iphones")
            stats["by_category"][category] = stats["by_category"].get(category, 0) + 1
            stats["total"] += 1

    save(products, OUTPUT_JSON, scraped_at)
    logger.info("Stats: %s", stats)
    return stats


def main() -> None:
    setup_logging(LOG_FILE)
    parser = argparse.ArgumentParser(description="goRiCycle — scraper Callphone")
    parser.add_argument("--mode", choices=("full", "incremental"), default="full")
    args = parser.parse_args()
    run_scraper(args.mode)


if __name__ == "__main__":
    main()
