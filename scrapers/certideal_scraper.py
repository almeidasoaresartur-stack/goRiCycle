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
    page_indicates_out_of_stock,
    page_wait_ms,
    parse_price_eur,
    remove_products_by_url,
    launch_chromium,
    setup_logging,
    text_indicates_out_of_stock,
    validate_listing_card,
)
from config import CATEGORY_KEYS, CERTIDEAL_CONFIG, CERTIDEAL_URLS

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

            if text_indicates_out_of_stock(text):
                logger.info("Cartão ignorado (sem stock): %s", model)
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

    if page_indicates_out_of_stock(
        page,
        stock_areas="#buy_block, .product-information, .box-info-product, .content_prices",
    ):
        logger.info("Produto sem stock (Certideal): %s", model)
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


def open_listing_url(page: Page, url: str) -> int | None:
    """Abre URL e devolve o status HTTP, ou None se a navegação falhar."""
    try:
        response = page.goto(url, wait_until="domcontentloaded", timeout=60_000)
    except Exception as exc:
        logger.error("Erro ao abrir %s: %s", url, exc)
        return None
    return response.status if response else None


def scrape_category_listing(
    page: Page,
    category_url: str,
    *,
    page_ready: bool = False,
) -> list[dict[str, Any]]:
    all_cards: list[dict[str, Any]] = []
    seen_urls: set[str] = set()
    url: str | None = category_url

    while url:
        logger.info("Listagem: %s", url)
        if not page_ready:
            status = open_listing_url(page, url)
            if status != 200:
                logger.warning("URL %s retornou HTTP %s — a saltar.", url, status or "desconhecido")
                break

            human_delay(CFG["delays"], "after_navigation")
            page_wait_ms(CFG["delays"], "page_load")
            dismiss_cookie_banner(page)
        else:
            page_ready = False

        page_cards = collect_listing_cards(
            page, CFG["base_url"], strict_wait=False
        )
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


def scrape_family_listing(
    page: Page,
    family_url: str,
    family_model: str,
    category: str,
) -> list[dict[str, Any]]:
    """Scrape uma família (ex. iPhone 16). Se não houver SKUs com preço, tenta sub-páginas hub."""
    status = open_listing_url(page, family_url)
    if status != 200:
        logger.warning(
            "Família '%s' indisponível (%s) — HTTP %s, a saltar.",
            family_model,
            family_url,
            status or "desconhecido",
        )
        return []

    human_delay(CFG["delays"], "after_navigation")
    page_wait_ms(CFG["delays"], "page_load")
    dismiss_cookie_banner(page)

    cards = scrape_category_listing(page, family_url, page_ready=True)
    if cards:
        for card in cards:
            card.setdefault("source_page", family_url)
        return cards

    hub_items = collect_listing_cards(
        page, CFG["base_url"], require_price=False, strict_wait=False
    )
    if not hub_items:
        detail = fetch_detail_product(page, family_url)
        if detail:
            detail["source_page"] = family_url
            return [detail]
        logger.info("Família '%s' sem listagem de produtos.", family_model)
        return []

    logger.info("Hub '%s': %s sub-página(s) a explorar.", family_model, len(hub_items))
    all_cards: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    for index, hub in enumerate(hub_items, start=1):
        sub_url = hub.get("url")
        if not sub_url or sub_url == family_url or sub_url in seen_urls:
            continue
        seen_urls.add(sub_url)

        if category == "samsung_phones" and detect_brand(hub.get("model", "")) != "Samsung":
            continue

        logger.info("  [%s/%s] Sub-página: %s", index, len(hub_items), hub.get("model"))
        sub_cards = scrape_category_listing(page, sub_url)
        if sub_cards:
            for card in sub_cards:
                card["source_page"] = sub_url
            all_cards.extend(sub_cards)
            continue

        detail = fetch_detail_product(page, sub_url)
        if detail:
            detail["source_page"] = sub_url
            all_cards.append(detail)

    return all_cards


def certideal_variant_key(model: str | None, storage: str | None) -> str:
    """Chave de deduplicação: modelo + capacidade (ignora estado/grade)."""
    model_norm = (model or "").strip().lower()
    storage_norm = (storage or "").strip().lower()
    return f"{model_norm}|{storage_norm}"


def extract_product(
    card: dict[str, Any],
    category: str,
    source_page: str,
    scraped_at: str,
    variant_registry: dict[str, dict[str, Any]] | None = None,
    removed_product_ids: set[str] | None = None,
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
        if not record:
            return []

        if variant_registry is not None:
            key = certideal_variant_key(record.get("model"), record.get("storage"))
            price_val = record.get("price")
            if not isinstance(price_val, (int, float)):
                return []

            existing = variant_registry.get(key)
            if existing is not None:
                existing_price = existing.get("price")
                if isinstance(existing_price, (int, float)) and price_val >= existing_price:
                    return []
                old_id = existing.get("product_id")
                if old_id and removed_product_ids is not None:
                    removed_product_ids.add(old_id)
            variant_registry[key] = record

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


def init_variant_registry(products: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    """Registo inicial: 1 entrada por modelo+capacidade (mais barata)."""
    registry: dict[str, dict[str, Any]] = {}
    for product in products:
        key = certideal_variant_key(product.get("model"), product.get("storage"))
        price = product.get("price")
        if not isinstance(price, (int, float)):
            continue
        existing = registry.get(key)
        if existing is None or price < (existing.get("price") or 9999):
            registry[key] = product
    return registry


def run_scraper(mode: str = "full", categories: list[str] | None = None) -> dict[str, Any]:
    scraped_at = datetime.now(timezone.utc).isoformat()
    selected = categories or [c for c in CATEGORY_KEYS if c in CERTIDEAL_URLS]
    stats: dict[str, Any] = {"total": 0, "by_category": {}, "errors": 0, "removed_out_of_stock": 0}

    if mode == "full":
        products: list[dict[str, Any]] = []
        known_ids: set[str] = set()
    else:
        products, known_ids = load_existing_products(CFG["output_json"])

    variant_registry = init_variant_registry(products)
    removed_product_ids: set[str] = set()

    with sync_playwright() as playwright:
        browser = launch_chromium(playwright, headless=CFG["headless"])
        page = browser.new_context(user_agent=CFG["user_agent"], locale="pt-PT").new_page()

        for category in selected:
            families = CFG.get("product_urls", {}).get(category) or CERTIDEAL_URLS.get(category, [])
            if not families:
                logger.warning("Sem famílias configuradas para '%s'.", category)
                stats["by_category"][category] = 0
                continue

            logger.info("=== Categoria: %s (%s famílias) ===", category, len(families))

            replace_cats = CFG.get("replace_on_scrape_categories", ())
            if category in replace_cats:
                products, known_ids = purge_category(products, known_ids, category)
                variant_registry = init_variant_registry(products)

            cat_count = 0

            for index, family in enumerate(families, start=1):
                family_model = family.get("model") or "Modelo"
                family_url = family.get("url")
                if not family_url:
                    continue

                logger.info(
                    "[%s/%s] Família: %s — %s",
                    index,
                    len(families),
                    family_model,
                    family_url,
                )

                cards = scrape_family_listing(page, family_url, family_model, category)
                if not cards:
                    continue

                for card_index, card in enumerate(cards, start=1):
                    if card_index % 20 == 1:
                        logger.info("[%s/%s] %s", card_index, len(cards), card.get("model"))
                    result = extract_product(
                        card,
                        category,
                        card.get("source_page") or family_url,
                        scraped_at,
                        variant_registry,
                        removed_product_ids,
                    )
                    if result is None:
                        stats["errors"] += 1
                        continue
                    if removed_product_ids:
                        products = [
                            p for p in products if p.get("product_id") not in removed_product_ids
                        ]
                        known_ids -= removed_product_ids
                        removed_product_ids.clear()
                    if not result:
                        products, n_removed = remove_products_by_url(products, card.get("url"))
                        if n_removed:
                            known_ids = {p["product_id"] for p in products if p.get("product_id")}
                            stats["removed_out_of_stock"] += n_removed
                            logger.info(
                                "Removidos %s registo(s) sem stock: %s",
                                n_removed,
                                card.get("model"),
                            )
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

    products = list(variant_registry.values())

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
