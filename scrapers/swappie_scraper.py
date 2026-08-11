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
import time
from collections import defaultdict
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
    filter_monotonic_storage_prices,
    human_delay,
    min_price_for_model,
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


def accept_swappie_price(price: float | None, model: str | None) -> float | None:
    """Rejeita preços fora do intervalo ou abaixo do mínimo plausível por modelo."""
    price = clean_price(price)
    if price is None:
        return None
    min_price = min_price_for_model(model)
    if price < min_price:
        logger.warning(
            "Preço abaixo do mínimo plausível rejeitado: %s€ < %s€ (%s)",
            price,
            min_price,
            model,
        )
        return None
    return price


def _storage_slug(storage_key: str) -> str:
    """Normaliza '512 GB' / '512GB' → '512gb' para comparar com a URL."""
    return re.sub(r"\s+", "", (storage_key or "").lower())


def _storage_slugs_in_url(url: str) -> list[str]:
    """Extrai slugs de capacidade presentes na URL (ex. ['128gb'])."""
    return [f"{n}gb" for n in re.findall(r"(\d+)\s*gb", (url or "").lower())]


def _url_matches_storage(url: str, storage_key: str) -> bool:
    """
    Consistência URL↔storage:
    - A URL tem de conter o slug da capacidade clicada (ex. '512gb').
    - URL /modelo/ sem slug → False (não aceitar cegamente; o chamador
      pode confirmar via UI antes de aceitar o preço).
    """
    slug = _storage_slug(storage_key)
    if not slug or not url:
        return False
    found = _storage_slugs_in_url(url)
    if not found:
        return False
    return slug in found


def _storage_ui_selected(page: Page, storage_key: str, mode: str) -> bool:
    """True se o DOM indica que a capacidade clicada está seleccionada."""
    line = storage_key.split("\n")[0].strip()
    slug = _storage_slug(line)
    return bool(
        page.evaluate(
            """([line, slug, mode]) => {
              const norm = (t) => (t || "").replace(/\\s+/g, "").toLowerCase();
              if (mode === "radio") {
                const inputs = [...document.querySelectorAll('input[name="storage"]')];
                const input = inputs.find((el) => (el.value || "").trim() === line);
                return !!(input && input.checked && !input.disabled);
              }
              const buttons = [...document.querySelectorAll("button[class*='ListItem']")];
              for (const btn of buttons) {
                const first = (btn.innerText || "").trim().split("\\n")[0].trim();
                if (norm(first) !== slug) continue;
                const aria =
                  btn.getAttribute("aria-pressed") === "true" ||
                  btn.getAttribute("aria-checked") === "true" ||
                  btn.getAttribute("aria-selected") === "true";
                const cls = (btn.className || "").toString().toLowerCase();
                const classSelected = /selected|active|checked|pressed|current/.test(cls);
                if (aria || classSelected) return true;
              }
              // Fallback: resumo do modelo (ex. "512 GB | Azul | …")
              const summaryNodes = document.querySelectorAll(
                "[class*='ModelSummary'], [class*='summaryWithBadge'], " +
                "[class*='StyledModelSummary'], [class*='FinePrint'], h1"
              );
              for (const node of summaryNodes) {
                const text = norm(node.innerText || "");
                if (text.includes(slug)) return true;
              }
              return false;
            }""",
            [line, slug, mode],
        )
    )


def _wait_storage_ui_confirmed(
    page: Page,
    storage_key: str,
    mode: str,
    *,
    timeout_ms: int = 5000,
) -> bool:
    """
    Espera confirmação de que a capacidade clicada está activa.
    Aceita: (a) estado seleccionado no DOM / resumo, ou (b) slug na URL.
    Sem nenhum dos dois até ao timeout → False.
    """
    deadline = time.monotonic() + (timeout_ms / 1000)
    while time.monotonic() < deadline:
        try:
            if _storage_ui_selected(page, storage_key, mode):
                return True
            if _url_matches_storage(page.url, storage_key):
                return True
        except Exception:
            pass
        page.wait_for_timeout(200)
    return False


def _reject_equal_prices_across_storages(
    records: list[dict[str, Any]],
    model: str | None,
) -> list[dict[str, Any]]:
    """
    No mesmo modelo+grau, se duas ou mais capacidades tiverem o preço exacto,
    rejeita todas essas variantes (preço não é fiável).
    """
    by_grade: dict[str | None, list[dict[str, Any]]] = defaultdict(list)
    for record in records:
        by_grade[record.get("grade")].append(record)

    kept: list[dict[str, Any]] = []
    for grade, items in by_grade.items():
        price_to_storages: dict[float, set[str | None]] = defaultdict(set)
        for record in items:
            price = record.get("price")
            if isinstance(price, (int, float)):
                price_to_storages[float(price)].add(record.get("storage"))

        bad_prices = {
            price
            for price, storages in price_to_storages.items()
            if len(storages) >= 2
        }
        for record in items:
            price = record.get("price")
            if isinstance(price, (int, float)) and float(price) in bad_prices:
                logger.warning(
                    "Preço idêntico em capacidades diferentes — variante rejeitada "
                    "para revisão: %s / %s / %s @ %s€ (modelo+grau com preço partilhado)",
                    model,
                    record.get("storage"),
                    grade,
                    price,
                )
                continue
            kept.append(record)

        if bad_prices:
            logger.warning(
                "Revisão manual: %s grade=%s — preço(s) %s partilhados por "
                "capacidades distintas; variantes afectadas descartadas",
                model,
                grade,
                sorted(bad_prices),
            )

    return kept


def _apply_monotonic_storage_prices(
    records: list[dict[str, Any]],
    model: str | None,
) -> list[dict[str, Any]]:
    """Rejeita capacidades maiores com preço ≤ capacidade menor (mesmo modelo+grau)."""
    kept, rejected = filter_monotonic_storage_prices(records)
    for record in rejected:
        logger.warning(
            "Preço não monotónico por capacidade — variante rejeitada: "
            "%s / %s / %s @ %s€ (capacidade maior não pode custar ≤ que menor)",
            model or record.get("model"),
            record.get("storage"),
            record.get("grade"),
            record.get("price"),
        )
    return kept


def dismiss_cookie_banner(page: Page) -> None:
    try:
        btn = page.locator(SEL["cookie_accept"])
        if btn.count():
            btn.first.click(force=True, timeout=2000)
            human_delay(CFG["delays"], "after_cookie_dismiss")
    except Exception:
        pass


def dismiss_page_overlays(page: Page) -> None:
    """Remove overlays que bloqueiam cliques (newsletter Braze, etc.)."""
    try:
        page.evaluate(
            """() => {
              document.querySelectorAll(
                '.ab-iam-root, [class*="ab-iam-root"], [class*="ab-iam "]'
              ).forEach((el) => el.remove());
            }"""
        )
    except Exception:
        pass


def _listing_card_fully_out_of_stock(root) -> bool:
    """
    True só se o modelo inteiro estiver esgotado.
    Nos cartões ModelCard2025, '(Esgotado)' aparece por capacidade — não
    rejeitar o modelo se ainda houver pelo menos uma capacidade disponível.
    """
    chips = root.locator("[class*='ModelCard2025__PropertyChipRoot']")
    chip_count = chips.count()
    if chip_count:
        available = 0
        for index in range(chip_count):
            text = chips.nth(index).inner_text(timeout=2000)
            if extract_storage(text) and not text_indicates_out_of_stock(text):
                available += 1
        return available == 0

    # Layout legado: só rejeitar se o texto do cartão indicar OOS global.
    try:
        card_text = root.inner_text(timeout=3000)
    except Exception:
        return False
    return text_indicates_out_of_stock(card_text)


def _parse_listing_card(
    root,
    *,
    href: str | None,
    base_url: str,
) -> dict[str, Any] | None:
    """Extrai modelo/preço/imagem a partir de um cartão (link legado ou frame 2025)."""
    if not href or "/modelo/" not in href:
        return None
    if not href.startswith("http"):
        href = urljoin(base_url, href)

    name_el = root.locator(SEL["product_name"]).first
    name = name_el.inner_text(timeout=3000).strip() if name_el.count() else ""
    if not name:
        return None
    # ModelCard2025 Title: "iPad Air 7 2025 13″ recondicionado"
    name = re.sub(r"\s+recondicionado\s*$", "", name, flags=re.I).strip()

    price_raw = ""
    price_el = root.locator(SEL["product_price"]).first
    if price_el.count():
        price_raw = price_el.inner_text(timeout=3000)

    image_url = None
    img = root.locator(SEL["product_image"]).first
    if img.count():
        image_url = resolve_image_url(img)

    storage_badges = root.locator(SEL["product_storage_badge"]).all_inner_texts()
    storages = [extract_storage(s) for s in storage_badges if extract_storage(s)]

    if _listing_card_fully_out_of_stock(root):
        logger.info("Modelo ignorado (sem stock): %s", name)
        return None

    # Sem preço de listagem e sem capacidades detectadas → pouco fiável
    listing_price = clean_price(parse_swappie_price_eur(price_raw))
    if listing_price is None and not storages:
        logger.info("Modelo ignorado (sem preço/capacidades): %s", name)
        return None

    return {
        "model": name,
        "url": href.rstrip("/") + "/",
        "listing_price": listing_price,
        "image_url": image_url,
        "storages_hint": storages,
    }


def collect_model_cards(page: Page, base_url: str) -> list[dict[str, Any]]:
    page.wait_for_selector(SEL["product_card"], timeout=60_000)
    page_wait_ms(CFG["delays"], "page_load")

    cards: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    # Layout legado (iPhones): o <a> contém nome/preço.
    links = page.locator(SEL["product_link"])
    total = links.count()
    for index in range(total):
        try:
            link = links.nth(index)
            card = _parse_listing_card(link, href=link.get_attribute("href"), base_url=base_url)
            if not card or card["url"] in seen_urls:
                continue
            seen_urls.add(card["url"])
            cards.append(card)
        except Exception as exc:
            logger.warning("Modelo legado %s/%s ignorado: %s", index + 1, total, exc)

    # Layout ModelCard2025 (iPads): título/preço no frame; link é StretchedAnchor.
    frames = page.locator(SEL.get("product_card_2025", "[class*='ModelCard2025__CardFrame']"))
    total_f = frames.count()
    link_sel = SEL.get("product_link_2025", "a[class*='ModelCard2025__StretchedAnchor']")
    for index in range(total_f):
        try:
            frame = frames.nth(index)
            anchor = frame.locator(f"{link_sel}, a[href*='/modelo/']").first
            href = anchor.get_attribute("href") if anchor.count() else None
            card = _parse_listing_card(frame, href=href, base_url=base_url)
            if not card or card["url"] in seen_urls:
                continue
            seen_urls.add(card["url"])
            cards.append(card)
        except Exception as exc:
            logger.warning("Modelo 2025 %s/%s ignorado: %s", index + 1, total_f, exc)

    return cards


def _collect_variant_labels(page: Page) -> tuple[list[str], list[str], str]:
    """
    Variantes do configurador Swappie.
    Retorna (storage_labels, grade_labels, mode) onde mode é 'listitem' | 'radio'.
    - iPhones: botões ListItem
    - iPads: radios input[name=storage|grade] (Selector__)
    """
    # Preferir ListItem quando existir (iPhones).
    listitem_data = page.evaluate(
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
    if listitem_data.get("storage") or listitem_data.get("grades"):
        storage_labels = listitem_data.get("storage") or []
        grade_labels = listitem_data.get("grades") or ["Satisfatório"]
        return storage_labels, grade_labels, "listitem"

    # Configurador radio (iPads / ModelCard2025 detail).
    radio_data = page.evaluate(
        """() => {
          const enabledValues = (name) =>
            [...document.querySelectorAll(`input[name="${name}"]`)]
              .filter((input) => !input.disabled)
              .map((input) => (input.value || "").trim())
              .filter(Boolean);
          const uniq = (items) => [...new Set(items)];
          return {
            storage: uniq(enabledValues("storage")),
            grades: uniq(enabledValues("grade")),
          };
        }"""
    )
    storage_labels = radio_data.get("storage") or []
    grade_labels = radio_data.get("grades") or []
    if storage_labels or grade_labels:
        if not grade_labels:
            grade_labels = ["Satisfatório"]
        return storage_labels, grade_labels, "radio"

    return [], ["Satisfatório"], "listitem"


def _click_list_item(page: Page, label: str) -> bool:
    line = label.split("\n")[0].strip()
    pattern = re.compile(rf"^{re.escape(line)}(?:\s*\n|\s*$|[+\-])", re.I)
    btn = page.locator(_VARIANT_BUTTON).filter(has_text=pattern)
    if not btn.count():
        return False
    dismiss_page_overlays(page)
    btn.first.click(force=True, timeout=5000)
    human_delay(CFG["delays"], "between_variants")
    try:
        page.locator(SEL["detail_price"]).first.wait_for(state="attached", timeout=5000)
    except Exception:
        pass
    page_wait_ms(CFG["delays"], "after_variant_select")
    return True


def _click_radio_option(page: Page, input_name: str, value: str) -> bool:
    """Selecciona opção do configurador radio (iPads). Clique via JS para evitar overlays."""
    dismiss_page_overlays(page)
    line = value.split("\n")[0].strip()
    clicked = page.evaluate(
        """([name, value]) => {
          const inputs = [...document.querySelectorAll(`input[name="${name}"]`)];
          const input = inputs.find((el) => (el.value || "").trim() === value);
          if (!input || input.disabled) return false;
          input.click();
          return true;
        }""",
        [input_name, line],
    )
    if not clicked:
        return False
    human_delay(CFG["delays"], "between_variants")
    try:
        page.locator(SEL["detail_price"]).first.wait_for(state="attached", timeout=5000)
    except Exception:
        pass
    page_wait_ms(CFG["delays"], "after_variant_select")
    return True


def _click_variant(page: Page, label: str, *, mode: str, kind: str) -> bool:
    """kind: 'storage' | 'grade'."""
    if mode == "radio":
        return _click_radio_option(page, kind, label)
    return _click_list_item(page, label)


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
    dismiss_page_overlays(page)

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

    dismiss_page_overlays(page)

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

    # Esperar configurador radio (iPads) se ListItem ainda não existir.
    try:
        page.wait_for_selector(
            "button[class*='ListItem'], input[name='storage'], label[class*='Selector__SelectorLabel']",
            timeout=15_000,
        )
    except Exception:
        pass

    storage_labels, grade_labels, variant_mode = _collect_variant_labels(page)
    if not storage_labels:
        storage_labels = ["128 GB"]
    logger.debug(
        "%s: configurador=%s storages=%s grades=%s",
        model,
        variant_mode,
        storage_labels,
        grade_labels,
    )

    records: list[dict[str, Any]] = []

    for storage_lbl in storage_labels[:4]:
        storage_key = storage_lbl.split("\n")[0].strip()
        if not _STORAGE_LINE_RE.match(storage_key):
            continue
        if not _click_variant(page, storage_key, mode=variant_mode, kind="storage"):
            logger.debug("Capacidade não clicável: %s (%s)", storage_key, card.get("url"))
            continue

        # Confirmação UI obrigatória antes de confiar no preço / URL.
        if not _wait_storage_ui_confirmed(page, storage_key, variant_mode, timeout_ms=5000):
            logger.warning(
                "UI não confirmou capacidade após clique — variante rejeitada: "
                "%s (mode=%s) url=%s",
                storage_key,
                variant_mode,
                page.url,
            )
            continue

        storage_slug = _storage_slug(storage_key)
        try:
            page.wait_for_url(
                lambda url, slug=storage_slug: slug in url.lower(),
                timeout=3000,
            )
        except Exception:
            pass

        variant_url = page.url.rstrip("/") + "/"
        url_ok = _url_matches_storage(variant_url, storage_key)
        url_slugs = _storage_slugs_in_url(variant_url)

        if not url_ok:
            if url_slugs:
                # URL tem capacidade diferente da clicada → rejeitar sempre.
                logger.warning(
                    "Mismatch URL↔storage — variante rejeitada: storage=%s "
                    "(esperado slug %r, URL tem %s) url=%s",
                    storage_key,
                    storage_slug,
                    url_slugs,
                    variant_url,
                )
                continue
            # URL sem slug: só segue porque a UI já confirmou a capacidade.
            logger.info(
                "URL sem slug de capacidade (%s) — aceite via confirmação UI: %s",
                storage_key,
                variant_url,
            )

        for grade_lbl in grade_labels[:4]:
            grade_key = grade_lbl.split("\n")[0].strip()
            if not _GRADE_LINE_RE.match(grade_key):
                continue
            if not _click_variant(page, grade_key, mode=variant_mode, kind="grade"):
                logger.debug("Condição não clicável: %s (%s)", grade_key, card.get("url"))
                continue

            if page_indicates_out_of_stock(page):
                logger.debug("Variante sem stock: %s / %s", storage_key, grade_key)
                continue

            # Reconfirma capacidade na UI após cliques de grade.
            if not _wait_storage_ui_confirmed(page, storage_key, variant_mode, timeout_ms=3000):
                logger.warning(
                    "UI perdeu confirmação de capacidade após grade — variante rejeitada: "
                    "%s / %s url=%s",
                    storage_key,
                    grade_key,
                    page.url,
                )
                continue

            current_url = page.url.rstrip("/") + "/"
            url_ok_after = _url_matches_storage(current_url, storage_key)
            url_slugs_after = _storage_slugs_in_url(current_url)
            if not url_ok_after and url_slugs_after:
                logger.warning(
                    "Mismatch URL↔storage após grade — variante rejeitada: "
                    "%s / %s (URL tem %s) url=%s",
                    storage_key,
                    grade_key,
                    url_slugs_after,
                    current_url,
                )
                continue
            if not url_ok_after and not url_slugs_after:
                # Sem slug na URL: só OK com UI já confirmada acima.
                pass

            detail_price = _read_detail_price(page)
            if detail_price is None:
                logger.warning(
                    "Sem preço confiável (detalhe em falta) — variante rejeitada: "
                    "%s / %s / %s (listing_price NÃO usado como fallback)",
                    model,
                    storage_key,
                    grade_key,
                )
                continue

            price = accept_swappie_price(detail_price, model)
            if price is None:
                continue

            record = build_normalized_product(
                CFG,
                category=category,
                url=current_url,
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

    records = _reject_equal_prices_across_storages(records, model)
    records = _apply_monotonic_storage_prices(records, model)

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

            try:
                page.goto(category_url, wait_until="domcontentloaded", timeout=60_000)
                human_delay(CFG["delays"], "after_navigation")
                dismiss_cookie_banner(page)
                cards = collect_model_cards(page, CFG["base_url"])
            except Exception as exc:
                logger.error("Falha ao listar categoria %s: %s", category, exc, exc_info=True)
                stats["errors"] += 1
                stats["by_category"][category] = 0
                continue

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
