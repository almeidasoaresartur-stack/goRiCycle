#!/usr/bin/env python3
"""
riCycle — scraper Swappie.com/pt (iPhones e iPads).

Uso:
    python scrapers/swappie_scraper.py --mode full
    python scrapers/swappie_scraper.py --categories iphones
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

from playwright.sync_api import Page, sync_playwright

_SCRAPERS_DIR = Path(__file__).resolve().parent
if str(_SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRAPERS_DIR))

from common import (
    build_normalized_product,
    extract_storage,
    human_delay,
    normalize_grade_swappie,
    page_wait_ms,
    parse_swappie_price_eur,
    remove_products_by_url,
    resolve_image_url,
    launch_chromium,
    setup_logging,
    text_indicates_out_of_stock,
)
from config import CATEGORY_KEYS, SWAPPIE_CONFIG

CFG = SWAPPIE_CONFIG
SEL = CFG["selectors"]
logger = logging.getLogger(__name__)

_VARIANT_BUTTON = SEL.get("variant_button", "button[class*='ListItem']")
_GRADE_LINE_RE = re.compile(r"^(Satisfatório|Satisfatorio|Muito Bom|Excelente|Premium|Bom)$", re.I)
_STORAGE_LINE_RE = re.compile(r"^\d+\s*GB$", re.I)


def swappie_variant_key(model: str | None, storage: str | None) -> str:
    """Chave de deduplicação: modelo + capacidade (ignora estado/grade)."""
    model_norm = (model or "").strip().lower()
    storage_norm = (storage or "").strip().upper()
    return f"{model_norm}|{storage_norm}"


def dedupe_swappie_products(products: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Mantém só o mais barato por modelo + capacidade."""
    best: dict[str, dict[str, Any]] = {}
    for product in products:
        key = swappie_variant_key(product.get("model"), product.get("storage"))
        price = product.get("price")
        if not isinstance(price, (int, float)):
            continue
        existing = best.get(key)
        if existing is None or price < (existing.get("price") or 9999):
            best[key] = product
    return list(best.values())


def swappie_product_page_missing(page: Page, response: Any | None = None) -> bool:
    """Deteta páginas 404 ou modelo removido (listagem ainda pode mostrar o cartão)."""
    if response is not None and response.status >= 400:
        return True

    try:
        title = (page.title() or "").lower()
        if any(marker in title for marker in ("não encontrada", "nao encontrada", "not found", "404")):
            return True
    except Exception:
        pass

    try:
        has_price = page.locator(SEL["detail_price"]).count() > 0
        has_title = page.locator(SEL["detail_title"]).count() > 0
        if not has_price and not has_title:
            return True
    except Exception:
        pass

    return False


def page_indicates_out_of_stock(page: Page, stock_areas: str | None = None) -> bool:
    """
    Verifica se O MODELO INTEIRO está sem stock.
    Não marca como esgotado se apenas ALGUMAS variantes estiverem esgotadas.
    """
    # Verifica se existe pelo menos 1 botão de compra activo
    # Se existir, o modelo tem stock em alguma configuração
    buy_button_selectors = [
        "[class*='AddToCart']:not([disabled])",
        "[class*='BuyButton']:not([disabled])",
        "button[class*='add-to-cart']:not([disabled])",
        "[class*='purchase']:not([disabled])",
        "[class*='Order']:not([disabled])",
    ]
    for sel in buy_button_selectors:
        try:
            if page.locator(sel).count() > 0:
                return False  # Tem pelo menos 1 botão activo — há stock
        except Exception:
            pass

    # Verifica se existe preço visível na zona principal
    price_selectors = [
        "[class*='ModelPrice']",
        "[class*='PriceTag']",
        "[class*='product-price']",
        "[class*='Price__']",
    ]
    has_price = False
    for sel in price_selectors:
        try:
            loc = page.locator(sel)
            if loc.count() > 0:
                price_text = loc.first.inner_text(timeout=3000)
                # Verifica se tem um número real (preço)
                if re.search(r"\d+[,.]?\d*\s*€", price_text):
                    has_price = True
                    break
        except Exception:
            pass

    if not has_price:
        return True  # Sem preço visível = sem stock

    # Verifica marcadores de esgotado APENAS na zona de compra
    # (não no main inteiro — evita falsos positivos de variantes esgotadas)
    out_of_stock_markers = [
        "avisem-me quando",
        "avise-me quando",
        "notify me when",
        "esgotado",
        "out of stock",
        "indisponível",
        "unavailable",
        "sem stock",
    ]
    try:
        # Usa zona específica em vez do main inteiro
        zone = page.locator(
            "[class*='ModelInfo'], [class*='ModelPrice'], "
            "[class*='PurchaseBox'], [class*='BuyBox']"
        )
        if zone.count() > 0:
            zone_text = zone.first.inner_text(timeout=3000).lower()
            if any(marker in zone_text for marker in out_of_stock_markers):
                # Só marca esgotado se não tiver preço real na zona
                if not re.search(r"\d+[,.]?\d*\s*€", zone_text):
                    return True
    except Exception:
        pass

    return False  # Por defeito assume que tem stock


def clean_price(price: float | None) -> float | None:
    if price is not None and (price < 30 or price > 3000):
        logger.warning("Preço rejeitado por estar fora do intervalo válido: %s", price)
        return None
    if price is not None and 2010 <= price <= 2035 and abs(price - round(price)) < 0.01:
        logger.warning("Preço rejeitado por parecer um ano: %s", price)
        return None
    return price


def dismiss_cookie_banner(page: Page) -> None:
    try:
        btn = page.locator(SEL["cookie_accept"])
        if btn.count():
            btn.first.click(force=True, timeout=2000)
            human_delay(CFG["delays"], "after_cookie_dismiss")
    except Exception:
        pass


def collect_model_cards(page: Page, base_url: str) -> list[dict[str, Any]]:
    page.wait_for_selector(SEL["product_card"], timeout=60_000)
    page_wait_ms(CFG["delays"], "page_load")

    cards: list[dict[str, Any]] = []
    links = page.locator(SEL["product_link"])
    total = links.count()

    for index in range(total):
        try:
            link = links.nth(index)
            href = link.get_attribute("href")
            if not href or "/modelo/" not in href:
                continue
            if not href.startswith("http"):
                href = urljoin(base_url, href)

            name_el = link.locator(SEL["product_name"]).first
            name = name_el.inner_text(timeout=3000).strip() if name_el.count() else ""
            price_raw = ""
            price_el = link.locator(SEL["product_price"]).first
            if price_el.count():
                price_raw = price_el.inner_text(timeout=3000)

            image_url = None
            img = link.locator(SEL["product_image"]).first
            if img.count():
                image_url = resolve_image_url(img)

            storage_badges = link.locator(SEL["product_storage_badge"]).all_inner_texts()
            storages = [extract_storage(s) for s in storage_badges if extract_storage(s)]

            if not name:
                continue

            card_text = link.inner_text(timeout=3000)
            if text_indicates_out_of_stock(card_text):
                logger.info("Modelo ignorado (sem stock): %s", name)
                continue

            cards.append(
                {
                    "model": name,
                    "url": href.rstrip("/") + "/",
                    "listing_price": clean_price(parse_swappie_price_eur(price_raw)),
                    "image_url": image_url,
                    "storages_hint": storages,
                }
            )
        except Exception as exc:
            logger.warning("Modelo %s/%s ignorado: %s", index + 1, total, exc)

    return cards


def _collect_variant_labels(page: Page) -> tuple[list[str], list[str]]:
    """Variantes do configurador Swappie (botões ListItem — capacidade e condição)."""
    data = page.evaluate(
        """() => {
          const buttons = [...document.querySelectorAll("button[class*='ListItem']")];
          const firstLine = (text) => text.trim().split("\\n")[0].trim();
          const storage = [];
          const grades = [];
          const gradeRe = /^(Satisfatório|Satisfatorio|Muito Bom|Excelente|Premium|Bom)$/i;
          const storageRe = /^\\d+\\s*GB$/i;
          for (const btn of buttons) {
            const raw = btn.innerText.trim();
            const line = firstLine(raw);
            if (storageRe.test(line)) storage.push(raw);
            else if (gradeRe.test(line)) grades.push(raw);
          }
          const uniq = (items) => [...new Set(items)];
          return { storage: uniq(storage), grades: uniq(grades) };
        }"""
    )
    storage_labels = data.get("storage") or []
    grade_labels = data.get("grades") or []

    if not grade_labels:
        grade_labels = ["Satisfatório"]

    return storage_labels, grade_labels


def _click_list_item(page: Page, label: str) -> bool:
    line = label.split("\n")[0].strip()
    pattern = re.compile(rf"^{re.escape(line)}(?:\s*\n|\s*$|[+\-])", re.I)
    btn = page.locator(_VARIANT_BUTTON).filter(has_text=pattern)
    if not btn.count():
        return False
    btn.first.click(force=True, timeout=5000)
    human_delay(CFG["delays"], "between_variants")
    try:
        page.locator(SEL["detail_price"]).first.wait_for(state="attached", timeout=5000)
    except Exception:
        pass
    page_wait_ms(CFG["delays"], "after_variant_select")
    return True


def _read_detail_price(page: Page) -> float | None:
    try:
        price_raw = page.locator(SEL["detail_price"]).first.inner_text(timeout=5000)
    except Exception:
        return None
    return clean_price(parse_swappie_price_eur(price_raw))


def _extract_variant_url(page: Page, product_url: str, base_url: str) -> str:
    variant_url: str | None = None

    try:
        canonical = page.locator("link[rel='canonical']").first
        if canonical.count():
            variant_url = canonical.get_attribute("href")
    except Exception:
        pass

    if not variant_url:
        try:
            buy_link = page.locator(
                "a[href*='/iphone/'], a[href*='/android/'], a[href*='/ipad/']"
            ).first
            if buy_link.count():
                variant_url = buy_link.get_attribute("href")
        except Exception:
            pass

    if not variant_url or "/modelo/" in variant_url:
        variant_url = product_url

    if variant_url and not variant_url.startswith("http"):
        variant_url = urljoin(base_url, variant_url)

    return variant_url.rstrip("/") + "/"


def _variants_from_model_page(
    page: Page,
    card: dict[str, Any],
    category: str,
    source_page: str,
    scraped_at: str,
) -> tuple[list[dict[str, Any]], bool]:
    response = page.goto(card["url"], wait_until="domcontentloaded", timeout=60_000)
    human_delay(CFG["delays"], "after_navigation")
    page_wait_ms(CFG["delays"], "page_load")
    dismiss_cookie_banner(page)

    if swappie_product_page_missing(page, response):
        logger.info("Página inválida/404 (Swappie): %s", card.get("url"))
        return [], True

    try:
        page.locator(SEL["detail_price"]).first.wait_for(state="attached", timeout=60_000)
    except Exception:
        if swappie_product_page_missing(page):
            logger.info("Página inválida/404 (Swappie): %s", card.get("url"))
            return [], True
        raise

    if page_indicates_out_of_stock(page):
        logger.info("Modelo sem stock (Swappie): %s", card.get("model"))
        return [], False

    model = card["model"]
    try:
        h1 = page.locator(SEL["detail_title"]).first.inner_text(timeout=5000).strip()
        if h1:
            model = h1.split("\n")[0].strip()
    except Exception:
        pass

    image_url = card.get("image_url")
    try:
        img = page.locator(SEL["detail_image"]).first
        if img.count():
            image_url = resolve_image_url(img) or image_url
    except Exception:
        pass

    storage_labels, grade_labels = _collect_variant_labels(page)
    if not storage_labels:
        storage_labels = ["128 GB"]

    records: list[dict[str, Any]] = []
    product_url = page.url.rstrip("/") + "/"

    for storage_lbl in storage_labels[:4]:
        storage_key = storage_lbl.split("\n")[0].strip()
        if not _STORAGE_LINE_RE.match(storage_key):
            continue
        if not _click_list_item(page, storage_key):
            logger.debug("Capacidade não clicável: %s (%s)", storage_key, card.get("url"))
            continue

        try:
            page.wait_for_url(
                lambda url: storage_key.lower().replace(" ", "") in url.lower(),
                timeout=3000,
            )
        except Exception:
            pass

        variant_url = page.url.rstrip("/") + "/"

        if "/modelo/" in variant_url:
            variant_url = product_url

        for grade_lbl in grade_labels[:4]:
            grade_key = grade_lbl.split("\n")[0].strip()
            if not _GRADE_LINE_RE.match(grade_key):
                continue
            if not _click_list_item(page, grade_key):
                logger.debug("Condição não clicável: %s (%s)", grade_key, card.get("url"))
                continue

            if page_indicates_out_of_stock(page):
                logger.debug("Variante sem stock: %s / %s", storage_key, grade_key)
                continue

            price = clean_price(_read_detail_price(page) or card.get("listing_price"))
            if price is None:
                continue

            record = build_normalized_product(
                CFG,
                category=category,
                url=variant_url,
                model=model,
                price=price,
                image_url=image_url,
                source_page=source_page,
                scraped_at=scraped_at,
                storage=extract_storage(storage_key),
                grade=normalize_grade_swappie(grade_key),
                extra_grade_keywords=(),
            )
            if record:
                records.append(record)

    deduped = dedupe_swappie_products(records)
    if len(deduped) < len(records):
        logger.debug(
            "%s: %s → %s registo(s) após dedup modelo+capacidade",
            card.get("model"),
            len(records),
            len(deduped),
        )
    return deduped, False


def extract_product(
    page: Page,
    card: dict[str, Any],
    category: str,
    source_page: str,
    scraped_at: str,
) -> tuple[list[dict[str, Any]], bool] | None:
    try:
        records, remove_stale = _variants_from_model_page(
            page, card, category, source_page, scraped_at
        )
        if records:
            logger.info("%s [%s]: %s registo(s)", card.get("model"), category, len(records))
        return records, remove_stale
    except Exception as exc:
        logger.error("Falha %s: %s", card.get("url"), exc, exc_info=True)
        try:
            if swappie_product_page_missing(page):
                return [], True
        except Exception:
            pass
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
    selected = categories or [c for c in CATEGORY_KEYS if CFG["categories"].get(c)]
    stats: dict[str, Any] = {"total": 0, "by_category": {}, "errors": 0, "removed_out_of_stock": 0}

    if mode == "full":
        products: list[dict[str, Any]] = []
        known_ids: set[str] = set()
    else:
        products, known_ids = load_existing_products(CFG["output_json"])

    with sync_playwright() as playwright:
        browser = launch_chromium(playwright, headless=CFG["headless"])
        page = browser.new_context(user_agent=CFG["user_agent"], locale="pt-PT").new_page()

        for category in selected:
            category_url = CFG["categories"].get(category)
            if not category_url:
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

            page.goto(category_url, wait_until="domcontentloaded", timeout=60_000)
            human_delay(CFG["delays"], "after_navigation")
            dismiss_cookie_banner(page)

            cards = collect_model_cards(page, CFG["base_url"])
            cat_count = 0

            for index, card in enumerate(cards, start=1):
                logger.info("[%s/%s] %s", index, len(cards), card.get("model"))
                outcome = extract_product(page, card, category, category_url, scraped_at)
                if outcome is None:
                    stats["errors"] += 1
                    human_delay(CFG["delays"], "between_products")
                    continue

                result, remove_stale = outcome
                if not result:
                    if remove_stale:
                        products, n_removed = remove_products_by_url(products, card.get("url"))
                        if n_removed:
                            known_ids = {p["product_id"] for p in products if p.get("product_id")}
                            stats["removed_out_of_stock"] += n_removed
                            logger.info(
                                "Removidos %s registo(s) — página 404/inexistente: %s",
                                n_removed,
                                card.get("model"),
                            )
                    else:
                        logger.info(
                            "Sem resultados para %s — mantendo dados anteriores (possível falso positivo de stock)",
                            card.get("model"),
                        )
                    human_delay(CFG["delays"], "between_products")
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

    products = dedupe_swappie_products(products)

    save_products(
        products,
        CFG["output_json"],
        {"source": CFG["source"], "categories": selected, "scraped_at": scraped_at},
    )
    return stats


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="riCycle — scraper Swappie")
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
