#!/usr/bin/env python3
"""
riCycle — scraper Certideal.pt (multi-categoria).

Uso:
    python scrapers/certideal_scraper.py --mode full
    python scrapers/certideal_scraper.py --mode incremental --categories iphones
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
from urllib.parse import urljoin, urlparse

from playwright.sync_api import Page, sync_playwright

_SCRAPERS_DIR = Path(__file__).resolve().parent
if str(_SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRAPERS_DIR))

from common import (
    build_normalized_product,
    detect_brand,
    extract_grade,
    extract_storage,
    human_delay,
    log_discarded_listing,
    page_wait_ms,
    parse_price_eur,
    setup_logging,
    validate_listing_card,
)
from config import CATEGORY_KEYS, CERTIDEAL_CONFIG

CFG = CERTIDEAL_CONFIG
SEL = CFG["selectors"]
logger = logging.getLogger(__name__)

COLOR_WORDS = (
    "preto",
    "branco",
    "azul",
    "vermelho",
    "verde",
    "roxo",
    "dourado",
    "prateado",
    "rosa",
    "amarelo",
    "meia-noite",
    "grafite",
    "ouro",
    "correto",
    "premium",
)


def dismiss_cookie_banner(page: Page) -> None:
    try:
        for key in ("cookie_accept",):
            btn = page.locator(SEL[key])
            if btn.count():
                btn.first.click(force=True, timeout=2000)
                human_delay(CFG["delays"], "after_cookie_dismiss")
                return
    except Exception:
        pass


def parse_certideal_listing_text(text: str) -> dict[str, Any]:
    """Extrai modelo, storage, cor e grade do texto do cartão PrestaShop."""
    lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
    model = lines[0] if lines else ""
    price = None
    grade = None
    color = None

    for ln in lines:
        if "€" in ln:
            price = parse_price_eur(ln)
        g = extract_grade(ln)
        if g:
            grade = g
        low = ln.lower()
        if any(c in low for c in COLOR_WORDS) and len(ln) < 40:
            color = ln

    storage = extract_storage(text)
    return {
        "model": model,
        "price": price,
        "grade": grade,
        "color": color,
        "storage": storage,
    }


def collect_listing_cards(
    page: Page,
    base_url: str,
    *,
    require_price: bool = True,
    strict_wait: bool = True,
) -> list[dict[str, Any]]:
    grid_timeout = 60_000 if strict_wait else 10_000
    try:
        page.wait_for_selector(SEL["listing_grid"], timeout=grid_timeout)
    except Exception:
        if strict_wait:
            raise
        return []
    card_timeout = 60_000 if strict_wait else 5_000
    try:
        page.wait_for_selector(SEL["product_card"], state="attached", timeout=card_timeout)
        if page.locator(SEL["product_card"]).count() == 0:
            return []
        page.locator(SEL["product_card"]).first.wait_for(state="visible", timeout=card_timeout)
    except Exception:
        if strict_wait:
            raise
        return []
    page_wait_ms(CFG["delays"], "page_load")

    cards: list[dict[str, Any]] = []
    elements = page.locator(SEL["product_card"])
    total = elements.count()

    for index in range(total):
        try:
            card = elements.nth(index)
            link_el = card.locator(SEL["product_link"]).first
            href = link_el.get_attribute("href") or link_el.get_attribute("data-url")
            if href and not href.startswith("http"):
                href = urljoin(base_url, href)

            text = card.inner_text(timeout=5000)
            parsed = parse_certideal_listing_text(text)
            image_loc = card.locator(SEL["product_image"]).first
            image_url = None
            if image_loc.count():
                image_url = image_loc.get_attribute("data-src") or image_loc.get_attribute("src")

            price = parsed.get("price")
            model = parsed.get("model")
            ok, reason = validate_listing_card(
                model=model,
                url=href,
                price=price,
                source=CFG["source"],
                require_price=require_price,
            )
            if not ok:
                log_discarded_listing(
                    logger,
                    reason,
                    model=model,
                    url=href,
                    price=price,
                    index=index + 1,
                    total=total,
                )
                continue

            cards.append(
                {
                    "model": model,
                    "listing_price": price,
                    "storage": parsed.get("storage"),
                    "grade": parsed.get("grade"),
                    "color": parsed.get("color"),
                    "image_url": image_url,
                    "url": href,
                }
            )
        except Exception as exc:
            logger.warning("Cartão %s/%s ignorado: %s", index + 1, total, exc)

    return cards


def collect_hub_model_links(page: Page, base_url: str) -> list[dict[str, Any]]:
    """Cartões hub (ex. Samsung): modelo + link, sem preço na listagem."""
    return collect_listing_cards(page, base_url, require_price=False)


def fetch_detail_product(page: Page, url: str) -> dict[str, Any] | None:
    """Extrai preço e metadados de uma página de produto Certideal."""
    page.goto(url, wait_until="domcontentloaded", timeout=60_000)
    human_delay(CFG["delays"], "after_navigation")
    page_wait_ms(CFG["delays"], "page_load")
    dismiss_cookie_banner(page)

    title_el = page.locator(SEL["detail_title"]).first
    if not title_el.count():
        return None
    model = title_el.inner_text(timeout=5000).strip()

    price = None
    for sel in (SEL["detail_price"], "#our_price_display", ".current-price"):
        loc = page.locator(sel)
        if loc.count():
            price = parse_price_eur(loc.first.inner_text(timeout=3000))
            if price is not None:
                break
    if price is None:
        for line in page.inner_text("body").split("\n"):
            line = line.strip()
            if "€" not in line or "novo" in line.lower():
                continue
            price = parse_price_eur(line)
            if price is not None:
                break

    if price is None:
        return None

    image_url = None
    img = page.locator(SEL["detail_image"]).first
    if img.count():
        image_url = img.get_attribute("src") or img.get_attribute("data-src")
    if not image_url:
        og = page.locator(SEL["detail_og_image"]).first
        if og.count():
            image_url = og.get_attribute("content")

    parsed = parse_certideal_listing_text(model)
    return {
        "model": model,
        "listing_price": price,
        "storage": parsed.get("storage") or extract_storage(model),
        "grade": parsed.get("grade") or extract_grade(model),
        "color": parsed.get("color"),
        "image_url": image_url,
        "url": url,
    }


def scrape_samsung_hub(page: Page, hub_url: str) -> list[dict[str, Any]]:
    """
    Samsung Certideal: hub de modelos → subpáginas com SKUs (se existirem).
    Ignora cartões que não sejam Samsung (algumas URLs redireccionam para iPhones).
    """
    logger.info("Hub Samsung: %s", hub_url)
    page.goto(hub_url, wait_until="domcontentloaded", timeout=60_000)
    human_delay(CFG["delays"], "after_navigation")
    page_wait_ms(CFG["delays"], "page_load")
    dismiss_cookie_banner(page)

    hub_models = collect_hub_model_links(page, CFG["base_url"])
    logger.info("Modelos no hub: %s", len(hub_models))

    all_cards: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    for index, hub in enumerate(hub_models, start=1):
        model_url = hub.get("url")
        if not model_url:
            continue
        logger.info("[%s/%s] Subpágina: %s", index, len(hub_models), hub.get("model"))

        page.goto(model_url, wait_until="domcontentloaded", timeout=60_000)
        human_delay(CFG["delays"], "after_navigation")
        page_wait_ms(CFG["delays"], "page_load")
        dismiss_cookie_banner(page)

        skus = collect_listing_cards(
            page, CFG["base_url"], require_price=True, strict_wait=False
        )
        added = 0
        for card in skus:
            if detect_brand(card.get("model", "")) != "Samsung":
                continue
            card_url = card.get("url")
            if not card_url or card_url in seen_urls:
                continue
            seen_urls.add(card_url)
            card["source_page"] = model_url
            all_cards.append(card)
            added += 1

        if added:
            logger.info("  → %s SKU(s) Samsung", added)
            continue

        # Sem grid de SKUs — tentar página de detalhe se URL parecer produto (dois segmentos)
        path = urlparse(model_url).path.strip("/")
        if path.count("/") >= 1 and "€" not in (hub.get("model") or ""):
            detail = fetch_detail_product(page, model_url)
            if detail and detect_brand(detail.get("model", "")) == "Samsung":
                card_url = detail.get("url")
                if card_url and card_url not in seen_urls:
                    seen_urls.add(card_url)
                    detail["source_page"] = hub_url
                    all_cards.append(detail)
                    logger.info("  → 1 produto (detalhe)")

    if not all_cards:
        logger.warning(
            "Nenhum SKU Samsung com preço encontrado no hub (%s modelos visitados). "
            "A Certideal pode não ter stock Samsung listado de momento.",
            len(hub_models),
        )
    return all_cards


def purge_category(
    products: list[dict[str, Any]],
    known_ids: set[str],
    category: str,
) -> tuple[list[dict[str, Any]], set[str]]:
    """Remove produtos de uma categoria (ex. dados errados de scrape anterior)."""
    removed_ids = {
        p["product_id"] for p in products if p.get("category") == category and p.get("product_id")
    }
    kept = [p for p in products if p.get("category") != category]
    known_ids -= removed_ids
    if removed_ids:
        logger.info("Removidos %s produto(s) antigos da categoria '%s'.", len(removed_ids), category)
    return kept, known_ids


def is_hub_category(category: str) -> bool:
    return category in CFG.get("hub_categories", ())


def get_next_listing_url(page: Page, current_url: str) -> str | None:
    """PrestaShop usa ?p=N; o link «próximo» em hash (#/página-N) não carrega nova listagem."""
    loc = page.locator("#pagination a[href*='?p=']")
    if loc.count() == 0:
        return None

    current_page = 1
    m = re.search(r"[?&]p=(\d+)", current_url)
    if m:
        current_page = int(m.group(1))

    next_page = current_page + 1
    for i in range(loc.count()):
        href = loc.nth(i).get_attribute("href") or ""
        if f"?p={next_page}" in href or f"&p={next_page}" in href:
            return urljoin(current_url, href)

    return None


def scrape_category_listing(page: Page, category_url: str) -> list[dict[str, Any]]:
    all_cards: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    url: str | None = category_url

    while url:
        logger.info("Listagem: %s", url)
        page.goto(url, wait_until="domcontentloaded", timeout=60_000)
        human_delay(CFG["delays"], "after_navigation")
        page_wait_ms(CFG["delays"], "page_load")
        dismiss_cookie_banner(page)

        page_cards = collect_listing_cards(page, CFG["base_url"])
        new_count = 0
        for card in page_cards:
            card_url = card.get("url")
            if not card_url or card_url in seen_urls:
                continue
            seen_urls.add(card_url)
            all_cards.append(card)
            new_count += 1

        if new_count == 0:
            logger.info("Sem produtos novos nesta página — fim da paginação.")
            break

        next_url = get_next_listing_url(page, url)
        if next_url and next_url != url:
            url = next_url
            human_delay(CFG["delays"], "between_pages")
        else:
            url = None

    return all_cards


def extract_product(
    card: dict[str, Any],
    category: str,
    source_page: str,
    scraped_at: str,
) -> list[dict[str, Any]] | None:
    try:
        price = card.get("listing_price")
        model = card.get("model")
        url = card.get("url")

        ok, reason = validate_listing_card(
            model=model,
            url=url,
            price=price,
            source=CFG["source"],
            require_price=True,
        )
        if not ok:
            log_discarded_listing(logger, reason, model=model, url=url, price=price)
            return []

        record = build_normalized_product(
            CFG,
            category=category,
            url=url,
            model=model,
            price=price,
            image_url=card.get("image_url"),
            source_page=card.get("source_page") or source_page,
            scraped_at=scraped_at,
            storage=card.get("storage"),
            grade=card.get("grade"),
            color=card.get("color"),
        )
        return [record]
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
        browser = playwright.chromium.launch(headless=CFG["headless"])
        page = browser.new_context(user_agent=CFG["user_agent"], locale="pt-PT").new_page()

        for category in selected:
            category_url = CFG["categories"].get(category)
            if not category_url:
                logger.warning("Categoria '%s' indisponível na Certideal.", category)
                stats["by_category"][category] = 0
                continue

            logger.info("=== Categoria: %s ===", category)

            replace_cats = CFG.get("replace_on_scrape_categories", ())
            if category in replace_cats:
                products, known_ids = purge_category(products, known_ids, category)

            if is_hub_category(category):
                cards = scrape_samsung_hub(page, category_url)
            else:
                cards = scrape_category_listing(page, category_url)
            cat_count = 0

            for index, card in enumerate(cards, start=1):
                if index % 20 == 1:
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
    parser = argparse.ArgumentParser(description="riCycle — scraper Certideal")
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
