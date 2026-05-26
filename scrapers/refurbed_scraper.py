#!/usr/bin/env python3
"""
riCycle — scraper Refurbed.pt (multi-categoria, marketplace).

Uso:
    python scrapers/refurbed_scraper.py
    python scrapers/refurbed_scraper.py --mode incremental
    python scrapers/refurbed_scraper.py --categories iphones,laptops
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

from playwright.sync_api import Page, sync_playwright

_SCRAPERS_DIR = Path(__file__).resolve().parent
if str(_SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRAPERS_DIR))

from common import (
    build_normalized_product,
    detect_brand,
    extract_storage,
    human_delay,
    normalize_grade_refurbed,
    page_wait_ms,
    parse_original_price_eur,
    parse_price_eur,
    parse_rating,
    resolve_image_url,
    setup_logging,
)
from config import CATEGORY_KEYS, REFURBED_CONFIG

CFG = REFURBED_CONFIG
SEL = CFG["selectors"]
logger = logging.getLogger(__name__)


def dismiss_cookie_banner(page: Page) -> None:
    try:
        for key in ("cookie_accept", "cookie_accept_alt"):
            btn = page.locator(SEL[key])
            if btn.count():
                btn.first.click(force=True, timeout=3000)
                human_delay(CFG["delays"], "after_cookie_dismiss")
                break
    except Exception:
        pass

    try:
        close = page.locator(SEL.get("newsletter_close", ""))
        if close.count():
            close.first.click(force=True, timeout=2000)
            human_delay(CFG["delays"], "after_cookie_dismiss")
    except Exception:
        pass

    page.evaluate(
        """() => {
            document.getElementById('cookiebanner')?.remove();
            document.querySelector('[data-alpine-was-cloaked]')?.remove();
        }"""
    )


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
    seller_rating: float | None = None,
) -> dict[str, Any]:
    record = build_normalized_product(
        CFG,
        category=category,
        url=url,
        model=model,
        price=price,
        image_url=image_url,
        source_page=source_page,
        scraped_at=scraped_at,
        storage=storage or extract_storage(model),
        grade=grade or normalize_grade_refurbed(model),
        color=color,
        original_price=original_price,
        extra_grade_keywords=(),
    )
    if seller_rating is not None:
        record["seller_rating"] = seller_rating
    return record


def _listing_rating(card) -> float | None:
    try:
        aria = card.locator(SEL["seller_rating_aria"]).first
        if aria.count():
            label = aria.get_attribute("aria-label")
            rating = parse_rating(label)
            if rating:
                return rating
    except Exception:
        pass
    try:
        spans = card.locator("span.text-content-01").all_inner_texts()
        for text in spans:
            rating = parse_rating(text)
            if rating and rating <= 5:
                return rating
    except Exception:
        pass
    return None


def collect_listing_cards(page: Page, base_url: str) -> list[dict[str, Any]]:
    page.wait_for_selector(SEL["listing_grid"], timeout=60_000)
    page.wait_for_selector(SEL["product_card"], timeout=60_000)
    page_wait_ms(CFG["delays"], "page_load")

    cards: list[dict[str, Any]] = []
    elements = page.locator(SEL["product_card"])
    total = elements.count()

    for index in range(total):
        try:
            card = elements.nth(index)
            link_el = card.locator(SEL["product_link"]).first
            href = link_el.get_attribute("href") if link_el.count() else None
            if href and not href.startswith("http"):
                href = urljoin(base_url, href)

            name = card.locator(SEL["product_name"]).first.inner_text(timeout=5000).strip()
            price_raw = card.locator(SEL["product_price"]).first.inner_text(timeout=5000)
            image_loc = card.locator(SEL["product_image"]).first
            image_url = resolve_image_url(image_loc) if image_loc.count() else None
            seller_rating = _listing_rating(card)

            if not href or not name:
                continue

            cards.append(
                {
                    "model": name,
                    "listing_price": parse_price_eur(price_raw),
                    "original_price": parse_original_price_eur(price_raw),
                    "image_url": image_url,
                    "url": href,
                    "seller_rating": seller_rating,
                }
            )
        except Exception as exc:
            logger.warning("Cartão %s/%s ignorado: %s", index + 1, total, exc)

    return cards


def _scroll_listing(page: Page) -> None:
    page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
    page_wait_ms(CFG["delays"], "page_load")


def _click_load_more(page: Page) -> bool:
    """Clica no botão 'Mais' (load-more) se visível. Devolve True se clicou."""
    btn = page.locator(SEL["load_more_button"])
    if btn.count() == 0:
        return False
    try:
        btn.first.scroll_into_view_if_needed()
        btn.first.click(force=True, timeout=5000)
        human_delay(CFG["delays"], "between_pages")
        page_wait_ms(CFG["delays"], "page_load")
        return True
    except Exception:
        return False


def _filter_cards_by_brand(
    cards: list[dict[str, Any]], category: str
) -> list[dict[str, Any]]:
    """Refurbed: URLs com ?brand= devolvem iPhones na mesma SPA — filtrar pelo título."""
    allowed = CFG.get("category_brand_filters", {}).get(category)
    if not allowed:
        return cards
    allowed_lower = {b.lower() for b in allowed}
    before = len(cards)
    filtered = [
        c
        for c in cards
        if (detect_brand(c.get("model", "")) or "").lower() in allowed_lower
    ]
    if before != len(filtered):
        logger.info(
            "%s: filtrados %s cartões fora de marca %s (%s restantes)",
            category,
            before - len(filtered),
            ", ".join(allowed),
            len(filtered),
        )
    return filtered


def scrape_category_listing(page: Page, category_url: str) -> list[dict[str, Any]]:
    """
    Recolhe todos os cartões via load-more (botão 'Mais') na mesma página SPA.
    Para quando não há produtos novos ou o botão desaparece.
    """
    logger.info("Listagem: %s", category_url)
    page.goto(category_url, wait_until="domcontentloaded", timeout=60_000)
    human_delay(CFG["delays"], "after_navigation")
    page_wait_ms(CFG["delays"], "page_load")
    dismiss_cookie_banner(page)

    seen_product_urls: set[str] = set()
    all_cards: list[dict[str, Any]] = []
    load_round = 0
    max_loads = CFG.get("max_pages", 50)

    while load_round < max_loads:
        load_round += 1
        _scroll_listing(page)
        cards = collect_listing_cards(page, CFG["base_url"])
        new_cards = [
            c for c in cards if c.get("url", "").rstrip("/") not in seen_product_urls
        ]
        for c in new_cards:
            seen_product_urls.add(c["url"].rstrip("/"))

        logger.info(
            "Ronda %s: %s cartões visíveis (%s novos, total %s)",
            load_round,
            len(cards),
            len(new_cards),
            len(all_cards) + len(new_cards),
        )

        all_cards.extend(new_cards)

        if not _click_load_more(page):
            logger.info("Sem botão load-more — fim da listagem.")
            break
        if not new_cards:
            logger.info("Load-more sem produtos novos — fim da listagem.")
            break

    return all_cards


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
    page_wait_ms(CFG["delays"], "page_load")
    dismiss_cookie_banner(page)

    model = card["model"]
    try:
        title = page.locator(SEL["detail_title"]).first.inner_text(timeout=5000).strip()
        if title:
            model = title.split("\n")[0].strip()
    except Exception:
        pass

    image_url = _detail_image(page, card.get("image_url"))
    product_url = page.url.rstrip("/") + "/"
    seller_rating = card.get("seller_rating")

    original_price = None
    try:
        srp = page.locator(SEL["detail_original_price"]).first
        if srp.count():
            original_price = parse_original_price_eur(srp.inner_text())
    except Exception:
        pass

    items = page.locator(SEL["detail_variant_item"]).evaluate_all(
        """(nodes, sel) => nodes.map((el) => ({
            storage: el.querySelector(sel.storage)?.innerText?.trim() || null,
            grade: el.querySelector(sel.grade)?.innerText?.trim() || null,
            price: el.querySelector(sel.price)?.innerText?.trim() || null,
            color: el.querySelector(sel.color)?.innerText?.trim() || null,
        }))""",
        {
            "storage": SEL["detail_variant_storage"],
            "grade": SEL["detail_variant_grade"],
            "price": SEL["detail_variant_price"],
            "color": SEL["detail_variant_color"],
        },
    )

    records: list[dict[str, Any]] = []
    if items:
        for item in items:
            price = parse_price_eur(item.get("price"))
            if price is None:
                continue
            records.append(
                normalize_record(
                    category=category,
                    url=product_url,
                    model=model,
                    price=price,
                    image_url=image_url,
                    source_page=source_page,
                    scraped_at=scraped_at,
                    storage=extract_storage(item.get("storage") or ""),
                    grade=normalize_grade_refurbed(item.get("grade")),
                    color=item.get("color"),
                    original_price=original_price or card.get("original_price"),
                    seller_rating=seller_rating,
                )
            )
        return records

    # Fallback: preço único na ficha
    price_raw = None
    try:
        price_raw = page.locator(SEL["detail_price"]).first.inner_text(timeout=5000)
    except Exception:
        pass
    price = parse_price_eur(price_raw) or card.get("listing_price")
    if price is None:
        return []

    subtitle = ""
    try:
        subtitle = page.locator(SEL["detail_title"]).first.inner_text(timeout=3000)
    except Exception:
        pass

    return [
        normalize_record(
            category=category,
            url=product_url,
            model=model,
            price=price,
            image_url=image_url,
            source_page=source_page,
            scraped_at=scraped_at,
            storage=extract_storage(subtitle),
            original_price=original_price or card.get("original_price"),
            seller_rating=seller_rating,
        )
    ]


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
                logger.warning("Categoria '%s' indisponível na Refurbed — ignorada.", category)
                stats["by_category"][category] = 0
                continue

            logger.info("=== Categoria: %s ===", category)

            if category in CFG.get("replace_on_scrape_categories", ()):
                before = len(products)
                products = [p for p in products if p.get("category") != category]
                known_ids = {p["product_id"] for p in products if p.get("product_id")}
                logger.info(
                    "%s: removidos %s produtos antigos da categoria (restam %s no total)",
                    category,
                    before - len(products),
                    len(products),
                )

            cards = scrape_category_listing(page, category_url)
            cards = _filter_cards_by_brand(cards, category)

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
    parser = argparse.ArgumentParser(description="riCycle — scraper Refurbed")
    parser.add_argument("--mode", choices=("full", "incremental"), default="full")
    parser.add_argument(
        "--categories",
        default="",
        help="Lista separada por vírgulas (default: todas). Ex: iphones,laptops",
    )
    return parser.parse_args()


def main() -> dict[str, Any]:
    setup_logging(CFG["log_file"])
    args = parse_args()
    cats = [c.strip() for c in args.categories.split(",") if c.strip()] or None
    logger.info("riCycle Refurbed — modo %s | categorias %s", args.mode, cats or "todas")
    return run_scraper(args.mode, cats)


if __name__ == "__main__":
    main()
