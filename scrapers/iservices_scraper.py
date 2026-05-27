#!/usr/bin/env python3
"""
riCycle — scraper iServices (multi-categoria, Portugal).

Uso:
    python scrapers/iservices_scraper.py
    python scrapers/iservices_scraper.py --mode incremental
    python scrapers/iservices_scraper.py --categories iphones,macs
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

from playwright.sync_api import Locator, Page, sync_playwright

_SCRAPERS_DIR = Path(__file__).resolve().parent
if str(_SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRAPERS_DIR))

from common import (
    build_normalized_product,
    extract_grade,
    extract_storage,
    human_delay,
    parse_original_price_eur,
    parse_price_eur,
    resolve_image_url,
    setup_logging,
)
from config import CATEGORY_KEYS, ISERVICES_CONFIG

CFG = ISERVICES_CONFIG
SEL = CFG["selectors"]
logger = logging.getLogger(__name__)


def clean_price(price: float | None) -> float | None:
    # Rejeita valores que são claramente anos ou valores impossíveis
    # Um iPhone recondicionado nunca custa menos de 30€ nem mais de 3000€
    if price is not None and (price < 30 or price > 3000):
        logger.warning("Preço rejeitado por estar fora do intervalo válido: %s", price)
        return None
    if price is not None and 2010 <= price <= 2035 and abs(price - round(price)) < 0.01:
        logger.warning("Preço rejeitado por parecer um ano: %s", price)
        return None
    return price


def parse_iservices_price_eur(text: str | None) -> float | None:
    """Ignora datas de promoção (ex. 29-05-2026) no bloco de preço."""
    if not text:
        return None
    cleaned = re.split(r"Promoção|promoção", text, maxsplit=1)[0]
    match = re.search(r"(\d+[,.]\d{2})", cleaned.replace("\xa0", " "))
    if match:
        try:
            return clean_price(float(match.group(1).replace(",", ".")))
        except ValueError:
            return None
    return clean_price(parse_price_eur(cleaned))


def dismiss_cookie_banner(page: Page) -> None:
    try:
        for key in ("cookie_accept", "cookie_accept_alt", "cookie_accept_all"):
            botao = page.locator(SEL[key])
            if botao.count():
                botao.first.click(force=True, timeout=3000)
                human_delay(CFG["delays"], "after_cookie_dismiss")
                return
    except Exception:
        pass

    page.evaluate(
        """() => {
            document.getElementById('klaro')?.remove();
            document.querySelectorAll('.cm-bg').forEach((el) => el.remove());
        }"""
    )
    human_delay(CFG["delays"], "after_cookie_dismiss")


def normalize_record(
    *,
    category: str,
    url: str,
    model: str,
    price: float,
    image_url: str | None,
    source_page: str,
    scraped_at: str,
    storage: str | None = None,
    grade: str | None = None,
    color: str | None = None,
    original_price: float | None = None,
) -> dict[str, Any]:
    return build_normalized_product(
        CFG,
        category=category,
        url=url,
        model=model,
        price=price,
        image_url=image_url,
        source_page=source_page,
        scraped_at=scraped_at,
        storage=storage or extract_storage(model),
        grade=grade or extract_grade(model),
        color=color,
        original_price=original_price,
    )


def collect_listing_cards(page: Page) -> list[dict[str, Any]]:
    page.wait_for_selector(SEL["listing_grid"], timeout=60_000)
    page.wait_for_selector(SEL["product_card"], timeout=60_000)

    cards: list[dict[str, Any]] = []
    elements = page.locator(SEL["product_card"])
    total = elements.count()

    for index in range(total):
        try:
            card = elements.nth(index)
            name = card.locator(SEL["product_name"]).inner_text(timeout=5000).strip()
            price_raw = card.locator(SEL["product_price"]).inner_text(timeout=5000)
            image_loc = card.locator(SEL["product_image"])
            image_url = resolve_image_url(image_loc) if image_loc.count() else None
            href = card.get_attribute("href")

            if not href or not name:
                continue

            cards.append(
                {
                    "model": name,
                    "listing_price": clean_price(parse_iservices_price_eur(price_raw)),
                    "original_price": parse_original_price_eur(price_raw),
                    "image_url": image_url,
                    "url": href,
                }
            )
        except Exception as exc:
            logger.warning("Cartão %s/%s ignorado: %s", index + 1, total, exc)

    return cards


def get_next_listing_url(page: Page, current_url: str) -> str | None:
    next_loc = page.locator(SEL["pagination_next"])
    if next_loc.count() == 0:
        return None
    href = next_loc.first.get_attribute("href")
    if not href or href in ("#", current_url):
        return None
    return urljoin(current_url, href)


def scrape_category_listing(page: Page, category_url: str) -> list[dict[str, Any]]:
    all_cards: list[dict[str, Any]] = []
    url: str | None = category_url
    page_num = 0

    while url:
        page_num += 1
        logger.info("Listagem página %s: %s", page_num, url)
        page.goto(url, wait_until="domcontentloaded", timeout=60_000)
        human_delay(CFG["delays"], "after_navigation")
        dismiss_cookie_banner(page)

        cards = collect_listing_cards(page)
        logger.info("Página %s: %s cartões", page_num, len(cards))
        all_cards.extend(cards)

        next_url = get_next_listing_url(page, url)
        if next_url and next_url != url:
            url = next_url
            human_delay(CFG["delays"], "between_pages")
        else:
            if page_num == 1:
                logger.info(
                    "Paginação '%s' sem correspondências (página única?).",
                    SEL["pagination_next"],
                )
            url = None

    return all_cards


def _click_variant_option(group: Locator, value: str, label: str | None) -> None:
    radio_sel = f"{SEL['detail_variant_radio']}[value='{value}']"
    if group.locator(radio_sel).count() == 0:
        raise RuntimeError(f"Opção não encontrada: {label or value}")
    label_loc = group.locator(f"label:has({radio_sel})")
    target = label_loc if label_loc.count() else group.locator(radio_sel)
    target.first.click(force=True, timeout=8_000)


def _detail_image(page: Page, fallback: str | None) -> str | None:
    try:
        img = page.locator(SEL["detail_image"]).first
        if img.count():
            url = resolve_image_url(img)
            if url:
                return url
    except Exception:
        pass
    try:
        og = page.locator(SEL["detail_og_image"]).first
        if og.count():
            return og.get_attribute("content")
    except Exception:
        pass
    return fallback


def _variants_from_detail_page(
    page: Page,
    card: dict[str, Any],
    category: str,
    source_page: str,
    scraped_at: str,
) -> list[dict[str, Any]]:
    page.goto(card["url"], wait_until="domcontentloaded", timeout=60_000)
    human_delay(CFG["delays"], "after_navigation")
    dismiss_cookie_banner(page)

    model = card["model"]
    try:
        title = page.locator(SEL["detail_title"]).first.inner_text(timeout=5000).strip()
        if title:
            model = title.split("\n")[0].strip()
    except Exception:
        pass

    image_url = _detail_image(page, card.get("image_url"))
    product_url = page.url

    group_storage = page.locator(SEL["detail_variant_group"]).filter(has_text="Armazenamento")
    group_grade = page.locator(SEL["detail_variant_group"]).filter(has_text="Estado")

    if group_storage.count() == 0 or group_grade.count() == 0:
        price_raw = None
        try:
            price_raw = page.locator(SEL["detail_price"]).first.inner_text(timeout=5000)
        except Exception:
            pass
        price = parse_price_eur(price_raw) or card.get("listing_price")
        if price is None:
            return []
        return [
            normalize_record(
                category=category,
                url=product_url,
                model=model,
                price=price,
                image_url=image_url,
                source_page=source_page,
                scraped_at=scraped_at,
                original_price=card.get("original_price"),
            )
        ]

    storage_options = group_storage.locator(SEL["detail_variant_radio"]).evaluate_all(
        """(inputs) => inputs.map((input) => ({
            value: input.value,
            label: input.closest('label')?.querySelector('.radio-label')?.innerText?.trim() || null
        }))"""
    )
    grade_options = group_grade.locator(SEL["detail_variant_radio"]).evaluate_all(
        """(inputs) => inputs.map((input) => ({
            value: input.value,
            label: input.closest('label')?.querySelector('.radio-label')?.innerText?.trim() || null
        }))"""
    )

    records: list[dict[str, Any]] = []
    for storage_opt in storage_options:
        for grade_opt in grade_options:
            try:
                group_storage = page.locator(SEL["detail_variant_group"]).filter(
                    has_text="Armazenamento"
                )
                group_grade = page.locator(SEL["detail_variant_group"]).filter(has_text="Estado")

                _click_variant_option(group_storage, storage_opt["value"], storage_opt.get("label"))
                human_delay(CFG["delays"], "between_variants")
                _click_variant_option(group_grade, grade_opt["value"], grade_opt.get("label"))
                human_delay(CFG["delays"], "after_variant_select")

                price_raw = page.locator(SEL["detail_price"]).first.inner_text(timeout=5000)
                price = clean_price(parse_iservices_price_eur(price_raw))
                if price is None:
                    continue

                storage_label = storage_opt.get("label") or ""
                grade_label = grade_opt.get("label") or ""
                records.append(
                    normalize_record(
                        category=category,
                        url=product_url,
                        model=model,
                        price=price,
                        image_url=image_url,
                        source_page=source_page,
                        scraped_at=scraped_at,
                        storage=extract_storage(storage_label) or extract_storage(model),
                        grade=extract_grade(grade_label) or extract_grade(model),
                        original_price=card.get("original_price"),
                    )
                )
            except Exception as exc:
                logger.warning(
                    "Variante ignorada (%s / %s / %s): %s",
                    model,
                    storage_opt.get("label"),
                    grade_opt.get("label"),
                    exc,
                )
    return records


def extract_product(
    page: Page,
    card: dict[str, Any],
    category: str,
    source_page: str,
    scraped_at: str,
) -> list[dict[str, Any]] | None:
    try:
        records = _variants_from_detail_page(page, card, category, source_page, scraped_at)
        if records:
            logger.info("%s [%s]: %s registo(s)", card.get("model"), category, len(records))
        else:
            logger.warning("Sem registos: %s", card.get("url"))
        return records
    except Exception as exc:
        logger.error(
            "Falha ao extrair %s (%s): %s",
            card.get("model"),
            card.get("url"),
            exc,
            exc_info=True,
        )
        return None


def load_existing_products(path: Path) -> tuple[list[dict[str, Any]], set[str]]:
    if not path.exists():
        return [], set()
    with path.open(encoding="utf-8") as fh:
        data = json.load(fh)
    products = data.get("products", [])
    known_ids = {p["product_id"] for p in products if p.get("product_id")}
    return products, known_ids


def save_products(products: list[dict[str, Any]], path: Path, meta: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = {**meta, "total_products": len(products), "products": products}
    with path.open("w", encoding="utf-8") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
    logger.info("JSON guardado: %s (%s produtos)", path, len(products))


def run_scraper(
    mode: str = "full",
    categories: list[str] | None = None,
) -> dict[str, Any]:
    scraped_at = datetime.now(timezone.utc).isoformat()
    selected = categories or list(CATEGORY_KEYS)
    stats: dict[str, Any] = {"total": 0, "by_category": {}, "errors": 0}

    if mode == "full":
        products: list[dict[str, Any]] = []
        known_ids: set[str] = set()
        logger.info("Modo full: recriação completa do JSON")
    elif mode == "incremental":
        products, known_ids = load_existing_products(CFG["output_json"])
        logger.info("Modo incremental: %s produtos, %s product_ids", len(products), len(known_ids))
    else:
        raise ValueError(f"Modo inválido: {mode}")

    with sync_playwright() as playwright:
        browser = playwright.chromium.launch(headless=CFG["headless"])
        context = browser.new_context(
            user_agent=CFG["user_agent"],
            locale="pt-PT",
            base_url=CFG["base_url"],
        )
        page = context.new_page()

        for category in selected:
            category_url = CFG["categories"].get(category)
            if not category_url:
                logger.warning("Categoria '%s' indisponível na iServices — ignorada.", category)
                stats["by_category"][category] = 0
                continue

            logger.info("=== Categoria: %s ===", category)
            cards = scrape_category_listing(page, category_url)
            cat_count = 0

            for index, card in enumerate(cards, start=1):
                logger.info("[%s/%s] %s", index, len(cards), card.get("model"))
                source_page = page.url
                result = extract_product(page, card, category, source_page, scraped_at)

                if result is None:
                    stats["errors"] += 1
                    human_delay(CFG["delays"], "between_products")
                    continue

                for record in result:
                    pid = record["product_id"]
                    if mode == "incremental" and pid in known_ids:
                        continue
                    products.append(record)
                    known_ids.add(pid)
                    cat_count += 1

                human_delay(CFG["delays"], "between_products")

            stats["by_category"][category] = cat_count
            stats["total"] += cat_count

        browser.close()

    meta = {
        "source": CFG["source"],
        "categories": selected,
        "scraped_at": scraped_at,
    }
    save_products(products, CFG["output_json"], meta)
    logger.info("Concluído. Total: %s | %s", stats["total"], stats["by_category"])
    return stats


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="riCycle — scraper iServices")
    parser.add_argument("--mode", choices=("full", "incremental"), default="full")
    parser.add_argument(
        "--categories",
        default="",
        help="Lista separada por vírgulas (default: todas). Ex: iphones,macs",
    )
    return parser.parse_args()


def main() -> dict[str, Any]:
    setup_logging(CFG["log_file"])
    args = parse_args()
    cats = [c.strip() for c in args.categories.split(",") if c.strip()] or None
    logger.info("riCycle iServices — modo %s | categorias %s", args.mode, cats or "todas")
    return run_scraper(args.mode, cats)


if __name__ == "__main__":
    main()
