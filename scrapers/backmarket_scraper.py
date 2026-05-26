#!/usr/bin/env python3
"""
riCycle — scraper Back Market (backmarket.pt).

Uso:
    python scrapers/backmarket_scraper.py --mode full
    python scrapers/backmarket_scraper.py --categories iphones
"""

from __future__ import annotations

import argparse
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin

from playwright.sync_api import Page, sync_playwright

_SCRAPERS_DIR = Path(__file__).resolve().parent
if str(_SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRAPERS_DIR))

from common import (
    build_normalized_product,
    human_delay,
    page_wait_ms,
    parse_original_price_eur,
    parse_price_eur,
    resolve_image_url,
    setup_logging,
)
from config import CATEGORY_KEYS, BACK_MARKET_CONFIG

CFG = BACK_MARKET_CONFIG
SEL = CFG["selectors"]
logger = logging.getLogger(__name__)


def dismiss_cookie_banner(page: Page) -> None:
    try:
        for key in ("cookie_accept", "cookie_accept_alt"):
            btn = page.locator(SEL[key])
            if btn.count():
                btn.first.click(force=True, timeout=3000)
                human_delay(CFG["delays"], "after_cookie_dismiss")
                return
    except Exception:
        pass


def _scroll_to_load(page: Page) -> None:
    """Scroll incremental (lazy loading) antes de extrair cartões."""
    page.evaluate(
        """() => {
            const step = window.innerHeight * 0.85;
            let y = 0;
            const max = document.body.scrollHeight;
            while (y < max) {
                y += step;
                window.scrollTo(0, y);
            }
            window.scrollTo(0, document.body.scrollHeight);
        }"""
    )
    human_delay(CFG["delays"], "scroll_pause" if "scroll_pause" in CFG["delays"] else "between_pages")

    rounds = CFG.get("max_scroll_rounds", 15)
    pause_key = "scroll_pause" if "scroll_pause" in CFG["delays"] else "between_pages"
    prev_count = 0
    for i in range(rounds):
        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        human_delay(CFG["delays"], pause_key)
        page_wait_ms(CFG["delays"], "page_load")
        count = page.locator(SEL["product_card"]).count()
        logger.info("Scroll %s: %s cartões", i + 1, count)
        if count == prev_count and count > 0:
            break
        prev_count = count


def create_browser_context(playwright: Any) -> tuple[Any, Any]:
    """Browser + contexto com headers e bypass anti-bot."""
    launch_kwargs: dict[str, Any] = {"headless": CFG["headless"]}
    slow_mo = CFG.get("slow_mo") or 0
    if slow_mo > 0:
        launch_kwargs["slow_mo"] = slow_mo
        logger.info("Browser com slow_mo=%s ms", slow_mo)

    browser = playwright.chromium.launch(**launch_kwargs)
    context = browser.new_context(
        user_agent=CFG["user_agent"],
        locale="pt-PT",
        viewport={"width": 1920, "height": 1080},
        bypass_csp=True,
        extra_http_headers=CFG.get("http_headers", {}),
    )
    return browser, context


def collect_listing_cards(page: Page, base_url: str) -> list[dict[str, Any]]:
    _scroll_to_load(page)
    cards: list[dict[str, Any]] = []
    elements = page.locator(SEL["product_card"])
    total = elements.count()

    if total == 0:
        logger.warning(
            "Nenhum cartão Back Market encontrado (possível bloqueio anti-bot). "
            "Selector: %s | title=%r",
            SEL["product_card"],
            page.title(),
        )
        return []

    for index in range(total):
        try:
            card = elements.nth(index)
            link_el = card.locator(SEL["product_link"]).first
            href = link_el.get_attribute("href") if link_el.count() else None
            if not href:
                href = card.locator("a").first.get_attribute("href")
            if href and not href.startswith("http"):
                href = urljoin(base_url, href)

            name = ""
            name_el = card.locator(SEL["product_name"]).first
            if name_el.count():
                name = name_el.inner_text(timeout=3000).strip()

            price_raw = ""
            price_el = card.locator(SEL["product_price"]).first
            if price_el.count():
                price_raw = price_el.inner_text(timeout=3000)

            image_url = None
            img = card.locator(SEL["product_image"]).first
            if img.count():
                image_url = resolve_image_url(img)

            price = parse_price_eur(price_raw)
            if not href or not name or price is None:
                continue

            cards.append(
                {
                    "model": name,
                    "listing_price": price,
                    "original_price": parse_original_price_eur(price_raw),
                    "image_url": image_url,
                    "url": href,
                }
            )
        except Exception as exc:
            logger.warning("Cartão %s/%s ignorado: %s", index + 1, total, exc)

    return cards


def scrape_category_listing(page: Page, category_url: str) -> list[dict[str, Any]]:
    logger.info("Listagem: %s", category_url)
    page.goto(category_url, wait_until="domcontentloaded", timeout=90_000)
    human_delay(CFG["delays"], "after_navigation")
    post_wait = CFG.get("post_goto_wait_ms", 5000)
    page.wait_for_timeout(post_wait)
    logger.info("Espera pós-goto: %s ms (JS)", post_wait)
    dismiss_cookie_banner(page)
    return collect_listing_cards(page, CFG["base_url"])


def extract_product(
    card: dict[str, Any],
    category: str,
    source_page: str,
    scraped_at: str,
) -> list[dict[str, Any]] | None:
    try:
        price = card.get("listing_price")
        if price is None:
            return []
        return [
            build_normalized_product(
                CFG,
                category=category,
                url=card["url"],
                model=card["model"],
                price=price,
                image_url=card.get("image_url"),
                source_page=source_page,
                scraped_at=scraped_at,
                original_price=card.get("original_price"),
            )
        ]
    except Exception as exc:
        logger.error("Falha %s: %s", card.get("url"), exc, exc_info=True)
        return None


def load_existing_products(path: Path) -> tuple[list[dict[str, Any]], set[str]]:
    if not path.exists():
        return [], set()
    with path.open(encoding="utf-8") as fh:
        data = json.load(fh)
    products = data.get("products", [])
    return products, {p["product_id"] for p in products if p.get("product_id")}


def save_products(products: list[dict[str, Any]], path: Path, meta: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as fh:
        json.dump({**meta, "total_products": len(products), "products": products}, fh, ensure_ascii=False, indent=2)
    logger.info("JSON guardado: %s (%s produtos)", path, len(products))


def run_scraper(mode: str = "full", categories: list[str] | None = None) -> dict[str, Any]:
    scraped_at = datetime.now(timezone.utc).isoformat()
    selected = categories or list(CATEGORY_KEYS)
    stats: dict[str, Any] = {"total": 0, "by_category": {}, "errors": 0}

    if mode == "full":
        products: list[dict[str, Any]] = []
        known_ids: set[str] = set()
    else:
        products, known_ids = load_existing_products(CFG["output_json"])

    with sync_playwright() as playwright:
        browser, context = create_browser_context(playwright)
        page = context.new_page()

        for category in selected:
            category_url = CFG["categories"].get(category)
            if not category_url:
                logger.warning("Categoria '%s' indisponível na Back Market.", category)
                stats["by_category"][category] = 0
                continue

            logger.info("=== Categoria: %s ===", category)
            cards = scrape_category_listing(page, category_url)
            cat_count = 0

            for index, card in enumerate(cards, start=1):
                logger.info("[%s/%s] %s", index, len(cards), card.get("model"))
                result = extract_product(card, category, page.url, scraped_at)
                if result is None:
                    stats["errors"] += 1
                    continue
                for record in result:
                    if mode == "incremental" and record["product_id"] in known_ids:
                        continue
                    products.append(record)
                    known_ids.add(record["product_id"])
                    cat_count += 1
                human_delay(CFG["delays"], "between_products")

            stats["by_category"][category] = cat_count
            stats["total"] += cat_count

        browser.close()

    save_products(
        products,
        CFG["output_json"],
        {"source": CFG["source"], "categories": selected, "scraped_at": scraped_at},
    )
    return stats


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="riCycle — scraper Back Market")
    parser.add_argument("--mode", choices=("full", "incremental"), default="full")
    parser.add_argument("--categories", default="")
    return parser.parse_args()


def main() -> dict[str, Any]:
    setup_logging(CFG["log_file"])
    args = parse_args()
    cats = [c.strip() for c in args.categories.split(",") if c.strip()] or None
    return run_scraper(args.mode, cats)


if __name__ == "__main__":
    main()
