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
import re
import signal
import sys
import time
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import urljoin, urlparse

import httpx
from playwright.sync_api import Page, sync_playwright

_SCRAPERS_DIR = Path(__file__).resolve().parent
if str(_SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRAPERS_DIR))

from common import (
    build_normalized_product,
    detect_brand,
    extract_storage,
    filter_best_price_per_store,
    filter_refurbed_min_per_storage,
    human_delay,
    is_allowed_brand,
    log_discarded_listing,
    normalize_grade_refurbed,
    page_indicates_out_of_stock,
    page_wait_ms,
    parse_original_price_eur,
    parse_price_eur,
    parse_rating,
    remove_products_by_url,
    resolve_image_url,
    launch_chromium,
    setup_logging,
    text_indicates_out_of_stock,
    validate_listing_card,
)
from config import CATEGORY_KEYS, REFURBED_CONFIG

CFG = REFURBED_CONFIG
SEL = CFG["selectors"]
logger = logging.getLogger(__name__)


class ProductExtractionTimeout(Exception):
    """Produto excedeu o tempo máximo de extracção."""


class ProductExtractionBudget:
    """Prazo por produto — verificado entre variantes e operações longas."""

    def __init__(self, timeout_sec: float, model: str) -> None:
        self.timeout_sec = timeout_sec
        self.model = model
        self.start = time.monotonic()
        self.deadline = self.start + timeout_sec

    def check(self, label: str) -> None:
        if time.monotonic() > self.deadline:
            raise ProductExtractionTimeout(
                f"Timeout {self.timeout_sec:.0f}s em {label!r} ({self.model})"
            )

    def elapsed(self) -> float:
        return time.monotonic() - self.start


@contextmanager
def product_extraction_timeout(seconds: int, model: str):
    """
    Alarme SIGALRM (Unix) para interromper chamadas Playwright bloqueadas.
    Em plataformas sem SIGALRM, só o budget explícito actua.
    """
    if not hasattr(signal, "SIGALRM"):
        yield
        return

    def _handler(signum, frame) -> None:
        raise ProductExtractionTimeout(f"Timeout {seconds}s ao extrair {model!r}")

    previous = signal.signal(signal.SIGALRM, _handler)
    signal.alarm(max(1, seconds))
    try:
        yield
    finally:
        signal.alarm(0)
        signal.signal(signal.SIGALRM, previous)


def _configure_page_timeouts(page: Page) -> None:
    page.set_default_timeout(30_000)
    page.set_default_navigation_timeout(60_000)


def _recreate_page(context, page: Page) -> Page:
    """Recria a página após timeout — a instância anterior pode ficar inconsistente."""
    try:
        page.close()
    except Exception:
        pass
    fresh = context.new_page()
    _configure_page_timeouts(fresh)
    return fresh


def check_link_status_200(url: str) -> bool:
    """
    Verifica se o URL do produto responde HTTP 200.
    Refurbed devolve 404 a HEAD mas 200 a GET — fallback automático.
    """
    try:
        r = httpx.head(url, timeout=8, follow_redirects=True)
        if r.status_code != 200:
            r = httpx.get(url, timeout=8, follow_redirects=True)

        if r.status_code != 200:
            return False

        final_url = str(r.url)
        bad_patterns = ["/search/", "search_query=", "/c/", "?q=", "/procurar"]
        if any(p in final_url for p in bad_patterns):
            return False

        return True

    except Exception:
        return False


FINANCING_TEXT_RE = re.compile(
    r"/\s*m[eê]s|/\s*mes\b|\bmensal\b|installment|parcela|financiamento|"
    r"pay\s*later|paga\s*depois|presta(?:ç|c)[ãa]o",
    re.I,
)

VARIANT_DELTA_PRICE_RE = re.compile(r"^\s*[+\-−–—]")

REFURBED_MIN_PRICE_DEFAULT = 100
REFURBED_MODEL_MIN_PRICE = {
    "iphone": 100,
    "ipad": 80,
}


def is_financing_price_text(text: str | None) -> bool:
    if not text:
        return False
    return bool(FINANCING_TEXT_RE.search(text))


def is_variant_delta_price_text(text: str | None) -> bool:
    """Diferença de preço entre variantes (ex. '-84 €', '+52 €') — não é preço total."""
    if not text:
        return False
    normalized = text.replace("\xa0", " ").strip()
    return bool(VARIANT_DELTA_PRICE_RE.match(normalized))


def refurbed_min_price_for_model(model: str | None) -> float:
    model_lower = (model or "").lower()
    for keyword, min_price in REFURBED_MODEL_MIN_PRICE.items():
        if keyword in model_lower:
            return min_price
    return REFURBED_MIN_PRICE_DEFAULT


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


def accept_refurbed_price(
    price: float | None,
    model: str | None,
    *,
    price_raw: str | None = None,
) -> float | None:
    """Rejeita preços de financiamento ou abaixo do mínimo plausível por modelo."""
    if price_raw and is_financing_price_text(price_raw):
        logger.warning(
            "Preço de financiamento rejeitado (%r) — produto descartado (%s)",
            price_raw[:80],
            model,
        )
        return None

    if price_raw and is_variant_delta_price_text(price_raw):
        logger.warning(
            "Diferença de variante rejeitada (%r) — produto descartado (%s)",
            price_raw[:80],
            model,
        )
        return None

    price = clean_price(price)
    if price is None:
        return None

    min_price = refurbed_min_price_for_model(model)
    if price < min_price:
        logger.warning(
            "Preço suspeito (possível financiamento) rejeitado: %s€ — produto descartado (%s)",
            price,
            model,
        )
        return None

    return price


def parse_refurbed_price_eur(text: str | None) -> float | None:
    """Preço PT com separador de milhares (ex. 1.131,99 €) — evita prestações mensais."""
    if not text:
        return None
    if is_financing_price_text(text):
        return None
    if is_variant_delta_price_text(text):
        return None
    cleaned = re.split(
        r"/\s*m[eê]s|refurbed\+|installment|financiamento|mensal",
        text,
        maxsplit=1,
        flags=re.I,
    )[0]
    cleaned = cleaned.replace("\xa0", " ").strip()
    match = re.search(r"(\d{1,3}(?:\.\d{3})*,\d{2}|\d+,\d{2})", cleaned)
    if match:
        try:
            return float(match.group(1).replace(".", "").replace(",", "."))
        except ValueError:
            return None
    return clean_price(parse_price_eur(cleaned))


def _locator_is_in_recommended_section(locator) -> bool:
    if not locator.count():
        return False
    try:
        return bool(
            locator.first.evaluate(
                """el => {
                    let node = el;
                    for (let depth = 0; depth < 12 && node; depth++) {
                        const test = node.getAttribute?.('data-test') || '';
                        if (test.startsWith('recommended-product')) return true;
                        node = node.parentElement;
                    }
                    return false;
                }"""
            )
        )
    except Exception:
        return False


def _price_context_is_financing(locator) -> bool:
    if not locator.count():
        return True
    try:
        context = locator.first.evaluate(
            """el => {
                let node = el;
                const parts = [];
                for (let depth = 0; depth < 5 && node; depth++) {
                    parts.push(node.innerText || '');
                    const testId = node.getAttribute?.('data-test') || '';
                    if (testId) parts.push(testId);
                    node = node.parentElement;
                }
                return parts.join(' ');
            }"""
        )
        return is_financing_price_text(context)
    except Exception:
        return False


def _read_price_locator(locator, model: str | None) -> float | None:
    if not locator.count():
        return None
    if _locator_is_in_recommended_section(locator):
        return None
    if _price_context_is_financing(locator):
        return None
    price_raw = locator.first.inner_text(timeout=5000).strip()
    if is_variant_delta_price_text(price_raw):
        return None
    return accept_refurbed_price(
        parse_refurbed_price_eur(price_raw),
        model,
        price_raw=price_raw,
    )


def _read_detail_price(page: Page, model: str | None) -> float | None:
    """Preço total no bloco principal — exclui carrossel de variantes sugeridas."""
    selectors = (
        SEL["detail_price_main_mobile"],
        SEL["detail_price_main"],
        SEL["detail_price_displayed"],
    )
    for selector in selectors:
        locator = page.locator(selector)
        if _locator_is_in_recommended_section(locator):
            continue
        price = _read_price_locator(locator, model)
        if price is not None:
            return price

    # Fallback: price-component com preço riscado (SRP) ao lado — padrão da ficha principal
    try:
        price_raw = page.evaluate(
            """() => {
                const blocks = [
                    document.querySelector('[data-test="price-component-mobile"]'),
                    document.querySelector('[data-test="price-component"]'),
                ].filter(Boolean);
                for (const block of blocks) {
                    const priceEl = block.querySelector(
                        '[data-test="product-price"][data-test-displayed-price]'
                    );
                    if (!priceEl) continue;
                    const srp = block.querySelector('[data-test="price-srp"]');
                    if (srp) return priceEl.innerText.trim();
                }
                return null;
            }"""
        )
        if price_raw:
            return accept_refurbed_price(
                parse_refurbed_price_eur(price_raw),
                model,
                price_raw=price_raw,
            )
    except Exception:
        pass

    return None


def _read_listing_price(card, model: str | None) -> float | None:
    for selector in (SEL["product_price_displayed"], SEL["product_price"]):
        price = _read_price_locator(card.locator(selector), model)
        if price is not None:
            return price
    return None


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
) -> dict[str, Any] | None:
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
    if record is None:
        return None
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
            listing_price = _read_listing_price(card, name)
            price_raw = None
            try:
                price_loc = card.locator(SEL["product_price_displayed"])
                if not price_loc.count():
                    price_loc = card.locator(SEL["product_price"])
                if price_loc.count():
                    price_raw = price_loc.first.inner_text(timeout=5000)
            except Exception:
                pass
            image_loc = card.locator(SEL["product_image"]).first
            image_url = resolve_image_url(image_loc) if image_loc.count() else None
            seller_rating = _listing_rating(card)

            ok, reason = validate_listing_card(
                model=name,
                url=href,
                price=listing_price,
                source=CFG["source"],
                require_price=True,
            )
            if not ok:
                log_discarded_listing(
                    logger,
                    reason,
                    model=name,
                    url=href,
                    price=listing_price,
                    index=index + 1,
                    total=total,
                )
                continue

            if not is_allowed_brand(name):
                logger.debug("Marca não permitida ignorada: %s", name)
                continue

            card_text = card.inner_text(timeout=3000)
            if text_indicates_out_of_stock(card_text):
                logger.info("Cartão ignorado (sem stock): %s", name)
                continue

            cards.append(
                {
                    "model": name,
                    "listing_price": listing_price,
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
    """Filtra cartões: apenas Apple, Samsung e Google (via config + guard global)."""
    allowed = CFG.get("category_brand_filters", {}).get(category)
    before = len(cards)

    if allowed:
        allowed_lower = {b.lower() for b in allowed}
        cards = [
            c
            for c in cards
            if (detect_brand(c.get("model", "")) or "").lower() in allowed_lower
        ]

    # Guard global — rejeita qualquer marca fora de Apple/Samsung/Google
    cards = [c for c in cards if is_allowed_brand(c.get("model", ""))]

    if before != len(cards):
        logger.info(
            "%s: filtrados %s cartões fora de marca permitida (%s restantes)",
            category,
            before - len(cards),
            len(cards),
        )
    return cards


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


def _parse_detail_title(title: str) -> tuple[str | None, str | None]:
    """Extrai armazenamento e cor do título da ficha (ex. 'iPhone 12 128 GB | … | preto')."""
    storage = extract_storage(title)
    color = None
    parts = [part.strip() for part in title.split("|") if part.strip()]
    if len(parts) >= 2:
        color = parts[-1].lower()
    return storage, color


def _active_grade_from_page(page: Page) -> str | None:
    """Estado/cosmetic grade seleccionado no configurador principal."""
    try:
        grade = page.evaluate(
            """() => {
                const selectors = [
                    '[data-test*="appearance"] [aria-checked="true"]',
                    '[data-test*="appearance"] button[aria-pressed="true"]',
                    '[data-test*="grade"] [aria-selected="true"]',
                    '[data-test*="grade"] button[aria-pressed="true"]',
                ];
                for (const sel of selectors) {
                    const el = document.querySelector(sel);
                    const text = el?.textContent?.trim();
                    if (text) return text;
                }
                return null;
            }"""
        )
        return normalize_grade_refurbed(grade) if grade else None
    except Exception:
        return None


def _is_generic_refurbed_product_url(url: str) -> bool:
    """URL genérico de modelo (/p/iphone-14/) sem ID de variante."""
    parts = [p for p in urlparse(url).path.split("/") if p]
    return len(parts) == 2 and parts[0] == "p"


def _variant_url_from_page(page: Page, fallback_url: str) -> str:
    url = page.url.rstrip("/") + "/"
    if _is_generic_refurbed_product_url(url):
        return fallback_url.rstrip("/") + "/"
    return url


def _click_recommended_variant(page: Page, index: int) -> str | None:
    """Clica numa variante sugerida; devolve href relativo/absoluto ou None."""
    item = page.locator(SEL["detail_variant_item"]).nth(index)
    link = item.locator("a").first
    try:
        if link.count():
            href = link.get_attribute("href")
            link.scroll_into_view_if_needed()
            link.click(force=True, timeout=5000)
            return href
        item.scroll_into_view_if_needed()
        item.click(force=True, timeout=5000)
        return None
    except Exception:
        return None


def _default_variant_from_detail_page(page: Page, model: str) -> dict[str, Any] | None:
    """Preço da configuração activa (cabeçalho) — frequentemente o mínimo real."""
    try:
        title = page.locator(SEL["detail_title"]).first.inner_text(timeout=5000).strip()
        price = _read_detail_price(page, model or title)
        if price is None or not title:
            return None

        storage, color = _parse_detail_title(title)
        grade = _active_grade_from_page(page)
        return {
            "storage": storage,
            "grade": grade,
            "price": price,
            "color": color,
        }
    except Exception:
        return None


def _variants_from_detail_page(
    page: Page,
    card: dict[str, Any],
    category: str,
    source_page: str,
    scraped_at: str,
    budget: ProductExtractionBudget | None = None,
) -> list[dict[str, Any]]:
    model_label = card.get("model") or "?"
    if budget:
        budget.check("início da ficha")

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

    if page_indicates_out_of_stock(page):
        logger.info("Produto sem stock (Refurbed): %s", model)
        return []

    original_price = None
    try:
        srp = page.locator(SEL["detail_original_price"]).first
        if srp.count():
            original_price = parse_original_price_eur(srp.inner_text(timeout=5000))
    except Exception:
        pass

    if budget:
        budget.check("carrossel de variantes")

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

    default_variant = _default_variant_from_detail_page(page, model)
    if default_variant:
        record = normalize_record(
            category=category,
            url=_variant_url_from_page(page, product_url),
            model=model,
            price=default_variant["price"],
            image_url=image_url,
            source_page=source_page,
            scraped_at=scraped_at,
            storage=default_variant.get("storage"),
            grade=default_variant.get("grade"),
            color=default_variant.get("color"),
            original_price=original_price or card.get("original_price"),
            seller_rating=seller_rating,
        )
        if record:
            records.append(record)
            logger.info(
                "  %s: variante activa → %.2f€ %s (%.1fs)",
                model,
                record["price"],
                record.get("url", "")[-35:],
                budget.elapsed() if budget else 0.0,
            )

    if items:
        logger.info("  %s: %s variantes sugeridas no carrossel", model, len(items))
        listing_url = product_url
        for index, item in enumerate(items):
            variant_label = f"variante {index + 1}/{len(items)}"
            if budget:
                budget.check(variant_label)

            storage_hint = item.get("storage")
            grade_hint = item.get("grade")
            carousel_price = item.get("price")
            logger.info(
                "  %s %s: storage=%s grade=%s preço_carousel=%s",
                model,
                variant_label,
                storage_hint,
                grade_hint,
                carousel_price,
            )

            if index > 0:
                page.goto(listing_url, wait_until="domcontentloaded", timeout=60_000)
                human_delay(CFG["delays"], "after_navigation")
                page_wait_ms(CFG["delays"], "page_load")
                dismiss_cookie_banner(page)

            clicked_href = _click_recommended_variant(page, index)
            if clicked_href:
                variant_token = clicked_href.rstrip("/").split("/")[-1]
                try:
                    page.wait_for_url(
                        lambda url: variant_token in url,
                        timeout=5000,
                    )
                except Exception:
                    pass
                page_wait_ms(CFG["delays"], "page_load")

            variant_url = _variant_url_from_page(page, product_url)

            price = _read_detail_price(page, model)
            if price is None:
                variant_price_raw = item.get("price")
                if variant_price_raw and is_variant_delta_price_text(variant_price_raw):
                    logger.info("  %s %s → omitida (delta de preço: %s)", model, variant_label, variant_price_raw)
                    continue
                if variant_price_raw and is_financing_price_text(variant_price_raw):
                    logger.info("  %s %s → omitida (preço de financiamento)", model, variant_label)
                    continue
                price = accept_refurbed_price(
                    parse_refurbed_price_eur(variant_price_raw),
                    model,
                    price_raw=variant_price_raw,
                )
            if price is None:
                logger.info("  %s %s → omitida (preço inválido)", model, variant_label)
                continue
            record = normalize_record(
                category=category,
                url=variant_url,
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
            if record:
                records.append(record)
                logger.info(
                    "  %s %s → %.2f€ %s (%.1fs)",
                    model,
                    variant_label,
                    record["price"],
                    variant_url[-35:],
                    budget.elapsed() if budget else 0.0,
                )
        return records

    if records:
        return records

    price = _read_detail_price(page, model)
    if price is None:
        fallback_raw = card.get("listing_price")
        price = accept_refurbed_price(fallback_raw, model) if fallback_raw is not None else None
    if price is None:
        return []

    subtitle = ""
    try:
        subtitle = page.locator(SEL["detail_title"]).first.inner_text(timeout=3000)
    except Exception:
        pass

    record = normalize_record(
        category=category,
        url=_variant_url_from_page(page, product_url),
        model=model,
        price=price,
        image_url=image_url,
        source_page=source_page,
        scraped_at=scraped_at,
        storage=extract_storage(subtitle),
        original_price=original_price or card.get("original_price"),
        seller_rating=seller_rating,
    )
    return [record] if record else []


def extract_product(
    page: Page,
    card: dict[str, Any],
    category: str,
    source_page: str,
    scraped_at: str,
    budget: ProductExtractionBudget | None = None,
) -> list[dict[str, Any]] | None:
    try:
        ok, reason = validate_listing_card(
            model=card.get("model"),
            url=card.get("url"),
            price=card.get("listing_price"),
            source=CFG["source"],
            require_price=True,
        )
        if not ok:
            log_discarded_listing(
                logger,
                reason,
                model=card.get("model"),
                url=card.get("url"),
                price=card.get("listing_price"),
            )
            return []

        records = _variants_from_detail_page(
            page, card, category, source_page, scraped_at, budget=budget
        )
        if records:
            elapsed = budget.elapsed() if budget else 0.0
            logger.info(
                "%s [%s]: %s registo(s) (%.1fs)",
                card.get("model"),
                category,
                len(records),
                elapsed,
            )
        else:
            logger.warning("Sem registos: %s", card.get("url"))
        return records
    except ProductExtractionTimeout:
        raise
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
    stats: dict[str, Any] = {
        "total": 0,
        "by_category": {},
        "errors": 0,
        "timeouts": 0,
        "removed_out_of_stock": 0,
    }

    if mode == "full":
        products: list[dict[str, Any]] = []
        known_ids: set[str] = set()
        # Não apagar o JSON antes do scrape — se falhar a meio, mantemos a
        # versão anterior. O save no fim reescreve o ficheiro completo.
        logger.info("Modo full: recriação completa do JSON")
    elif mode == "incremental":
        products, known_ids = load_existing_products(CFG["output_json"])
        logger.info("Modo incremental: %s produtos, %s product_ids", len(products), len(known_ids))
    else:
        raise ValueError(f"Modo inválido: {mode}")

    with sync_playwright() as playwright:
        browser = launch_chromium(playwright, headless=CFG["headless"])
        context = browser.new_context(
            user_agent=CFG["user_agent"],
            locale="pt-PT",
            base_url=CFG["base_url"],
        )
        page = context.new_page()
        _configure_page_timeouts(page)
        product_timeout_sec = int(CFG.get("product_extraction_timeout_sec", 300))

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
                model_name = card.get("model") or "?"
                budget = ProductExtractionBudget(product_timeout_sec, model_name)
                try:
                    with product_extraction_timeout(product_timeout_sec, model_name):
                        result = extract_product(
                            page, card, category, source_page, scraped_at, budget=budget
                        )
                except ProductExtractionTimeout as exc:
                    logger.error("Timeout ao extrair %s (%s): %s", model_name, card.get("url"), exc)
                    stats["timeouts"] += 1
                    stats["errors"] += 1
                    page = _recreate_page(context, page)
                    human_delay(CFG["delays"], "between_products")
                    continue

                if result is None:
                    stats["errors"] += 1
                    human_delay(CFG["delays"], "between_products")
                    continue

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
                    human_delay(CFG["delays"], "between_products")
                    continue

                products, n_replaced = remove_products_by_url(products, card.get("url"))
                if n_replaced:
                    known_ids = {p["product_id"] for p in products if p.get("product_id")}
                    logger.debug(
                        "Actualizados %s registo(s) anteriores: %s",
                        n_replaced,
                        card.get("model"),
                    )

                for record in result:
                    pid = record["product_id"]
                    product_url = record.get("url")
                    if product_url and not check_link_status_200(product_url):
                        logger.warning("Link morto removido: %s", product_url)
                        continue
                    products.append(record)
                    known_ids.add(pid)
                    cat_count += 1

                human_delay(CFG["delays"], "between_products")

            stats["by_category"][category] = cat_count

        browser.close()

    before_dedup = len(products)
    products, dedup_removed = filter_best_price_per_store(products, log=logger)
    products, refurbed_dedup_removed = filter_refurbed_min_per_storage(products, log=logger)
    stats["dedup_removed"] = dedup_removed + refurbed_dedup_removed
    stats["total"] = len(products)
    stats["by_category"] = {}
    for product in products:
        cat = product.get("category", "unknown")
        stats["by_category"][cat] = stats["by_category"].get(cat, 0) + 1

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
