"""
Utilitários partilhados pelos scrapers riCycle.
"""

from __future__ import annotations

import json
import logging
import random
import re
import time
from typing import Any
from urllib.parse import urlparse

from playwright.sync_api import Browser, Locator, Page, Playwright

from config import (
    AFFILIATE_PLACEHOLDER,
    GRADE_KEYWORDS,
    IMAGE_SRC_ATTRIBUTES,
    REFURBED_GRADE_KEYWORDS,
    STORAGE_REGEX,
    SWAPPIE_GRADE_KEYWORDS,
)

logger = logging.getLogger(__name__)

# Estabilidade em CI / ambientes com pouca RAM (ex.: GitHub Actions)
CHROMIUM_LAUNCH_ARGS: tuple[str, ...] = (
    "--disable-dev-shm-usage",
    "--no-sandbox",
)

CATEGORY_URL_MARKERS = ("/c/", "/cat/")


def launch_chromium(
    playwright: Playwright,
    *,
    headless: bool = True,
    slow_mo: int = 0,
) -> Browser:
    """Lança Chromium com argumentos de estabilidade para scrapers."""
    kwargs: dict[str, Any] = {
        "headless": headless,
        "args": list(CHROMIUM_LAUNCH_ARGS),
    }
    if slow_mo > 0:
        kwargs["slow_mo"] = slow_mo
    return playwright.chromium.launch(**kwargs)

# Marcas detectáveis a partir do nome do modelo (ordem importa — Apple primeiro)
BRAND_PATTERNS: tuple[tuple[str, tuple[str, ...]], ...] = (
    ("Apple", ("apple watch", "apple", "iphone", "ipad", "macbook", "imac", "mac ")),
    ("Samsung", ("samsung", "galaxy")),
    ("Lenovo", ("lenovo", "thinkpad")),
    ("HP", ("hp ", "hewlett")),
    ("Dell", ("dell", "xps", "latitude")),
    ("Asus", ("asus", "zenbook")),
    ("Microsoft", ("microsoft", "surface")),
    ("Huawei", ("huawei", "matepad")),
    ("Google", ("google pixel", "pixel ")),
    ("OnePlus", ("oneplus", "one plus")),
    ("Xiaomi", ("xiaomi", "redmi")),
)

ALLOWED_BRANDS = {"apple", "samsung", "google"}

ALLOWED_BRAND_KEYWORDS: tuple[str, ...] = (
    "iphone",
    "ipad",
    "macbook",
    "airpods",
    "samsung",
    "galaxy",
    "google",
    "pixel",
)


def is_allowed_brand(model: str | None) -> bool:
    """Verifica se o modelo pertence a uma marca permitida (Apple, Samsung, Google)."""
    model_lower = (model or "").lower()
    return any(kw in model_lower for kw in ALLOWED_BRAND_KEYWORDS)


def product_dedup_key(product: dict[str, Any]) -> str:
    """
    Chave de deduplicação por loja: loja-modelo-armazenamento-estado.
    Usa `source`/`grade` do schema actual (equivalente a loja/condition).
    """
    loja = (product.get("loja") or product.get("source") or "").strip()
    model = (product.get("model") or "").strip()
    storage = (product.get("storage") or "").strip().upper()
    condition = (product.get("condition") or product.get("grade") or "").strip()
    return f"{loja}-{model}-{storage}-{condition}"


def _product_debug_blob(product: dict[str, Any]) -> str:
    return " ".join(
        str(product.get(field) or "")
        for field in ("model", "url", "product_id", "source")
    ).lower()


def filter_refurbed_min_per_storage(
    products: list[dict[str, Any]],
    *,
    log: logging.Logger | None = None,
) -> tuple[list[dict[str, Any]], int]:
    """
    Refurbed: uma entrada por modelo + armazenamento (preço mínimo entre graus/cores).
    O URL /p/slug/ não fixa variante — o comparador deve reflectir o mínimo real.
    """
    refurbed_best: dict[str, dict[str, Any]] = {}
    others: list[dict[str, Any]] = []

    for product in products:
        if (product.get("source") or "").strip() != "refurbed":
            others.append(product)
            continue

        model = (product.get("model") or "").strip()
        storage = (product.get("storage") or "").strip().upper()
        key = f"{model}|{storage}"
        price = product.get("price")
        if not isinstance(price, (int, float)):
            continue

        existing = refurbed_best.get(key)
        if existing is None or price < existing.get("price", float("inf")):
            refurbed_best[key] = product

    refurbed_kept = list(refurbed_best.values())
    before = sum(1 for product in products if (product.get("source") or "").strip() == "refurbed")
    removed = before - len(refurbed_kept)
    if removed and log:
        log.info(
            "Refurbed min/armazenamento: removidos %s duplicados (%s únicos)",
            removed,
            len(refurbed_kept),
        )
    return others + refurbed_kept, removed


def filter_best_price_per_store(
    products: list[dict[str, Any]],
    *,
    log: logging.Logger | None = None,
    debug_match: str | None = None,
    debug_label: str = "",
) -> tuple[list[dict[str, Any]], int]:
    """
    Mantém apenas a oferta mais barata por loja + modelo + armazenamento + estado.
    Ex.: 3 lojas → no máximo 3 entradas para 'iPhone 13 128GB Bom' (uma por loja).
    """
    best: dict[str, dict[str, Any]] = {}
    prefix = f"[{debug_label}] " if debug_label else ""

    def _matches_debug(product: dict[str, Any]) -> bool:
        return bool(debug_match) and debug_match.lower() in _product_debug_blob(product)

    for product in products:
        key = product_dedup_key(product)
        price = product.get("price")
        if not isinstance(price, (int, float)):
            if _matches_debug(product) and log:
                log.warning(
                    "%sDEDUP skip (preço inválido): chave=%s | %s",
                    prefix,
                    key,
                    product.get("url", "?")[:80],
                )
            continue

        existing = best.get(key)
        if _matches_debug(product) and log:
            if existing is None:
                log.info(
                    "%sDEDUP candidato inicial: chave=%s | €%s | %s",
                    prefix,
                    key,
                    price,
                    product.get("url", "?")[:80],
                )
            elif price < existing.get("price", float("inf")):
                log.info(
                    "%sDEDUP substitui vencedor: chave=%s | novo €%s vence €%s",
                    prefix,
                    key,
                    price,
                    existing.get("price"),
                )
                log.info("         perdedor: %s", existing.get("url", "?")[:80])
                log.info("         vencedor: %s", product.get("url", "?")[:80])
            else:
                log.info(
                    "%sDEDUP descartado (mais caro): chave=%s | €%s perde para €%s",
                    prefix,
                    key,
                    price,
                    existing.get("price"),
                )
                log.info("         descartado: %s", product.get("url", "?")[:80])
                log.info("         vencedor:   %s", existing.get("url", "?")[:80])

        if existing is None or price < existing.get("price", float("inf")):
            best[key] = product

    kept = list(best.values())
    removed = len(products) - len(kept)
    if removed and log:
        log.info(
            "%sDeduplicação por loja: removidos %s duplicados (%s únicos)",
            prefix,
            removed,
            len(kept),
        )
    return kept, removed


def human_delay(delays: dict[str, tuple[float, float]], key: str) -> None:
    low, high = delays[key]
    time.sleep(random.uniform(low, high))


def page_wait_ms(delays: dict[str, Any], key: str = "page_load") -> None:
    """Espera fixa configurável (ms) — usada após navegação quando o site é SPA."""
    ms = delays.get(key)
    if isinstance(ms, (int, float)) and ms > 0:
        time.sleep(ms / 1000.0)


def count_model_words(model: str) -> int:
    """Conta palavras significativas no nome do modelo (ex.: 'iPhone 13' → 2)."""
    if not model:
        return 0
    return len([word for word in re.split(r"\s+", model.strip()) if word])


def is_valid_product_model(model: str | None) -> bool:
    """Rejeita rótulos de categoria ('Samsung', 'Apple') — exige ≥2 palavras."""
    return count_model_words(model or "") >= 2


def is_valid_listing_price(price: float | None) -> bool:
    return price is not None and price > 0


# Mínimos plausíveis por família de produto (partilhado — ex. Refurbed / Swappie).
MODEL_MIN_PRICE_DEFAULT = 100
MODEL_MIN_PRICE: dict[str, float] = {
    "iphone": 100,
    "ipad": 80,
}


def min_price_for_model(model: str | None) -> float:
    """Preço mínimo plausível por modelo (iPhone ≥ 100€, iPad ≥ 80€, resto ≥ 100€)."""
    model_lower = (model or "").lower()
    for keyword, min_price in MODEL_MIN_PRICE.items():
        if keyword in model_lower:
            return min_price
    return MODEL_MIN_PRICE_DEFAULT


def is_category_url(url: str | None, source: str | None = None) -> bool:
    """
    Detecta URLs de categoria/hub em vez de produto individual.
    Regras base: /c/, /cat/, URL demasiado curto.
    """
    if not url:
        return True

    cleaned = url.strip()
    if len(cleaned) < 15:
        return True

    lower = cleaned.lower()
    if any(marker in lower for marker in CATEGORY_URL_MARKERS):
        return True

    path = urlparse(cleaned).path.strip("/")
    if not path:
        return True

    segments = [segment for segment in path.split("/") if segment]

    if source == "certideal" and len(segments) == 1:
        slug = segments[0].lower()
        # Listagens de categoria (plural): ipad-recondicionados-118
        if re.search(r"-recondicionados-\d+$", slug):
            return True
        # Hubs de modelo sem SKU: iphone-16-545, iphone-15-pro-416
        if re.search(r"-\d{2,4}$", slug) and "recondicionado" not in slug:
            return True

    if source == "refurbed" and "/c/" in lower and "/p/" not in lower:
        return True

    return False


def validate_listing_card(
    *,
    model: str | None,
    url: str | None,
    price: float | None,
    source: str | None = None,
    require_price: bool = True,
) -> tuple[bool, str]:
    """Valida cartão de listagem. Devolve (ok, motivo_rejeição)."""
    if not url:
        return False, "sem URL"
    if is_category_url(url, source):
        return False, "URL de categoria/hub"
    if not is_valid_product_model(model):
        return False, "modelo inválido (categoria, não produto)"
    if require_price and not is_valid_listing_price(price):
        return False, "preço ausente ou inválido"
    return True, ""


def log_discarded_listing(
    log: logging.Logger,
    reason: str,
    *,
    model: str | None = None,
    url: str | None = None,
    price: float | None = None,
    index: int | None = None,
    total: int | None = None,
) -> None:
    prefix = f"Cartão {index}/{total} " if index is not None and total is not None else ""
    log.info(
        "%sdescartado (%s): model=%r url=%r price=%s",
        prefix,
        reason,
        model,
        url,
        price,
    )


def normalize_model_name(name: str) -> str:
    """
    Normaliza nomes de modelo para consistência entre fontes.
    Aplica a TODOS os scrapers.
    """
    if not name:
        return name
    replacements = {
        " mini": " Mini",
        " plus": " Plus",
        " pro max": " Pro Max",
        " pro": " Pro",
        " max": " Max",
    }
    result = name.strip()
    for old, new in replacements.items():
        result = re.sub(re.escape(old), new, result, flags=re.IGNORECASE)
    return result


def _normalize_price_text(text: str) -> str:
    return text.replace("\xa0", " ").replace("\u202f", " ").strip()


def _pt_amount_to_float(raw: str) -> float | None:
    """Converte '1.139,00', '1 139,00' ou '1139,00' para float."""
    cleaned = raw.strip()
    if not cleaned:
        return None
    # Remove separadores de milhar (espaço ou ponto antes de grupos de 3 dígitos)
    cleaned = re.sub(r"(?<=\d)[.\s](?=\d{3}(?:[,\s]|$))", "", cleaned)
    cleaned = cleaned.replace(",", ".")
    try:
        return float(cleaned)
    except ValueError:
        return None


def parse_pt_eur_amount(text: str | None) -> float | None:
    """Extrai o último valor monetário PT/EUR de um texto."""
    if not text:
        return None
    cleaned = _normalize_price_text(text)
    pattern = re.compile(
        r"\d{1,3}(?:[.\s]\d{3})+,\d{2}|\d+,\d{2}|\d{1,3}(?:[.\s]\d{3})+(?!\d)|\d+(?:\.\d{2})?"
    )
    amounts: list[float] = []
    for match in pattern.finditer(cleaned):
        value = _pt_amount_to_float(match.group(0))
        if value is not None:
            amounts.append(value)
    return amounts[-1] if amounts else None


def parse_price_eur(text: str | None) -> float | None:
    return parse_pt_eur_amount(text)


def parse_swappie_price_eur(text: str | None) -> float | None:
    """Preço actual Swappie — ignora preço Apple e trata milhares PT (ex. 1 139,00 €)."""
    if not text:
        return None
    cleaned = re.split(r"Preço de lançamento|Apple\s*:", text, maxsplit=1, flags=re.I)[0]
    return parse_pt_eur_amount(cleaned)


def parse_original_price_eur(text: str | None) -> float | None:
    if not text:
        return None
    numbers = re.findall(r"\d+[,.]?\d*", text.replace("\xa0", " "))
    if len(numbers) < 2:
        return None
    valor = numbers[0].replace(".", "").replace(",", ".")
    try:
        return float(valor)
    except ValueError:
        return None


def parse_rating(text: str | None) -> float | None:
    """Converte '4,9' ou aria-label '4.94 out of 5' para float."""
    if not text:
        return None
    match = re.search(r"(\d+[,.]?\d*)", text.replace("\xa0", " "))
    if not match:
        return None
    try:
        value = float(match.group(1).replace(",", "."))
        return value if value <= 5 else None
    except ValueError:
        return None


def extract_storage(text: str | None) -> str | None:
    if not text:
        return None
    match = re.search(STORAGE_REGEX, text, re.IGNORECASE)
    if not match:
        return None
    return f"{match.group(1)}GB"


def extract_grade(text: str | None, extra_keywords: tuple[tuple[str, str], ...] = ()) -> str | None:
    if not text:
        return None
    keywords = GRADE_KEYWORDS + extra_keywords
    lowered = text.lower()
    for needle, normalized in keywords:
        if needle.lower() in lowered:
            return normalized
    return None


def detect_brand(model: str | None) -> str | None:
    if not model:
        return None
    lowered = model.lower()
    for brand, patterns in BRAND_PATTERNS:
        for pattern in patterns:
            if pattern in lowered:
                return brand
    return None


CURATION_CUTOFF_YEAR = 2022
# Tab S8 → 2022, Tab S7 → 2021 (geração N ≈ 2014 + N)
_TAB_S_BASE_YEAR = 2014
_GALAXY_S_LEGACY_YEARS: dict[int, int] = {
    10: 2019,
    9: 2018,
    8: 2017,
    7: 2016,
    6: 2015,
    5: 2014,
}


def _extract_explicit_year(text: str) -> int | None:
    match = re.search(r"\((20\d{2})\)", text)
    if match:
        return int(match.group(1))
    match = re.search(r"(?<![0-9])(20\d{2})(?![0-9])", text)
    if match:
        return int(match.group(1))
    return None


def infer_model_year(model_name: str, brand: str | None = None) -> int | None:
    """Infere o ano de lançamento a partir do nome do modelo (Samsung/Google)."""
    text = (model_name or "").strip()
    if not text:
        return None

    explicit = _extract_explicit_year(text)
    if explicit is not None:
        return explicit

    lower = text.lower()
    brand_lower = (brand or detect_brand(text) or "").lower()

    if brand_lower == "google" or "pixel" in lower:
        match = re.search(r"pixel\s*(\d+)", lower)
        if match:
            return 2015 + int(match.group(1))
        if re.search(r"\bpixel\b", lower):
            return 2016

    if brand_lower == "samsung" or "galaxy" in lower or "samsung" in lower:
        match = re.search(r"tab\s*s(\d+)", lower)
        if match:
            return _TAB_S_BASE_YEAR + int(match.group(1))

        match = re.search(r"(?:galaxy\s*)?s(\d{2})\b", lower)
        if match:
            generation = int(match.group(1))
            if generation >= 20:
                return 2000 + generation
            return _GALAXY_S_LEGACY_YEARS.get(generation)

        # Galaxy A-series: A53→2022, A55→2024, A56→2025, A17→2025 (GSMArena/Wikipedia)
        match = re.search(r"(?:galaxy\s*)?a(\d{2})\b", lower)
        if match:
            generation = int(match.group(1))
            if 50 <= generation <= 59:
                return 2019 + (generation - 50)
            if 14 <= generation <= 19:
                return 2008 + generation

        # Z Fold 7→2025, Z Fold6→2024 (espaço opcional: "Z Fold 7")
        match = re.search(r"(?:z\s*(?:galaxy\s*)?)?(?:fold|flip)\s*(\d+)", lower)
        if match:
            return 2018 + int(match.group(1))

    return None


def is_model_relevant(model_name: str, brand: str | None) -> bool:
    """
    Curadoria por antiguidade: Samsung e Google só a partir de 2022.
    Apple (e outras marcas) passam sempre.
    """
    brand_norm = (brand or detect_brand(model_name) or "").strip()
    if not brand_norm or brand_norm.lower() == "apple":
        return True
    if brand_norm.lower() not in {"samsung", "google"}:
        return True

    year = infer_model_year(model_name, brand_norm)
    if year is None:
        return True
    return year >= CURATION_CUTOFF_YEAR


OUT_OF_STOCK_MARKERS: tuple[str, ...] = (
    "sem stock",
    "produto indisponível",
    "produto indisponivel",
    "brevemente disponível",
    "brevemente disponivel",
    "out of stock",
    "sold out",
    "esgotado",
    "indisponível",
    "indisponivel",
    "currently unavailable",
    "not available",
    "avisem-me quando",
    "avise-me quando",
    "notify me when",
    "temporarily unavailable",
)


def text_indicates_out_of_stock(text: str | None) -> bool:
    """Deteta indicadores textuais de produto/variante sem stock."""
    if not text:
        return False
    normalized = re.sub(r"\s+", " ", text.lower()).strip()
    return any(marker in normalized for marker in OUT_OF_STOCK_MARKERS)


def product_indicates_unavailable(product: dict[str, Any]) -> bool:
    """True se o produto deve ser marcado como indisponível."""
    if product.get("is_available") is False:
        return True

    for field in ("status", "availability", "stock_status"):
        value = product.get(field)
        if value is not None and text_indicates_out_of_stock(str(value)):
            return True

    return False


def apply_availability_flags(products: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    """
    Normaliza is_available em cada produto com base em status/availability.
    Por omissão is_available=True; produtos esgotados ficam com is_available=False.
    """
    marked_unavailable = 0

    for product in products:
        unavailable = product_indicates_unavailable(product)
        if unavailable:
            if product.get("is_available") is not False:
                marked_unavailable += 1
            product["is_available"] = False
        elif "is_available" not in product:
            product["is_available"] = True
        else:
            product["is_available"] = bool(product["is_available"])

    return products, marked_unavailable


def filter_unavailable_products(products: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], int]:
    """Remove produtos com is_available=False."""
    kept = [product for product in products if product.get("is_available", True)]
    return kept, len(products) - len(kept)


def parse_shopify_variants_availability(html: str) -> dict[str, bool]:
    """Extrai disponibilidade por variant_id do JSON embutido numa página Shopify."""
    variant_map: dict[str, bool] = {}

    for match in re.finditer(
        r'<script[^>]*type="application/json"[^>]*>(\{.*?"variants"\s*:\s*\[.*?\].*?\})</script>',
        html,
        re.DOTALL | re.IGNORECASE,
    ):
        try:
            data = json.loads(match.group(1))
        except json.JSONDecodeError:
            continue
        for variant in data.get("variants", []):
            variant_id = str(variant.get("id", "")).strip()
            if variant_id:
                variant_map[variant_id] = bool(variant.get("available", True))

    return variant_map


def html_indicates_callphone_out_of_stock(html: str) -> bool:
    """
    Deteta etiqueta 'Esgotado' / sold-out no DOM Shopify da Callphone.
    Complementa variant.available da API JSON.
    """
    if not html:
        return False

    html_lower = html.lower()

    if re.search(
        r'class="[^"]*\b(sold-out|product-sold-out|badge--sold-out|product-form__sold-out)\b[^"]*"',
        html,
        re.IGNORECASE,
    ):
        if "esgotado" in html_lower or "sold out" in html_lower or "out of stock" in html_lower:
            return True

    if re.search(r">\s*esgotado\s*<", html, re.IGNORECASE):
        return True

    if 'data-product-available="false"' in html_lower:
        return True

    if re.search(
        r'"availability"\s*:\s*"https://schema\.org/OutOfStock"',
        html,
        re.IGNORECASE,
    ):
        return True

    return False


def is_schema_availability_out_of_stock(value: str | None) -> bool:
    if not value:
        return False
    return "outofstock" in value.lower().replace("-", "")


def normalize_product_url(url: str | None) -> str:
    """Normaliza URL de produto para comparação (path sem query)."""
    if not url:
        return ""
    parsed = urlparse(url.strip())
    path = parsed.path.rstrip("/").lower()
    return path or url.strip().lower().rstrip("/")


def parse_embedded_out_of_stock_urls(html: str) -> set[str]:
    """Extrai URLs de produtos OutOfStock em JSON-LD/schema.org embutido."""
    oos_urls: set[str] = set()
    # Liga cada Product ao seu url (não ao primeiro url no bloco — listagens iServices
    # empacotam vários produtos no mesmo troço HTML).
    for match in re.finditer(
        r'"@type"\s*:\s*"Product"[\s\S]*?"url"\s*:\s*"([^"]+)"'
        r'[\s\S]{0,600}?"availability"\s*:\s*"https://schema.org/OutOfStock"',
        html,
        flags=re.IGNORECASE,
    ):
        oos_urls.add(normalize_product_url(match.group(1)))
    return oos_urls


def remove_products_by_url(
    products: list[dict[str, Any]],
    url: str | None,
) -> tuple[list[dict[str, Any]], int]:
    """Remove ofertas cujo URL base coincide (ex.: produto passou a sem stock)."""
    base = normalize_product_url(url)
    if not base:
        return products, 0
    kept = [
        product
        for product in products
        if normalize_product_url(product.get("url")) != base
    ]
    return kept, len(products) - len(kept)


def page_indicates_out_of_stock(
    page: Page,
    *,
    availability_badge: str = ".availability-badge",
    stock_areas: str = ".product-add-to-cart, .product-actions, .product-prices, .product-information",
    out_of_stock_selectors: str = (
        ".out-of-stock, .product-out-of-stock, .unavailable, "
        "#product-availability .out-of-stock, .availability:has-text('Sem stock')"
    ),
) -> bool:
    """
    Verifica se a ficha de produto indica indisponibilidade.
    iServices: '.availability-badge' + 'Sem stock' / 'Brevemente Disponível'.
    """
    try:
        badge = page.locator(availability_badge)
        if badge.count():
            text = badge.first.inner_text(timeout=3000).strip()
            classes = (badge.first.get_attribute("class") or "").lower()
            if text_indicates_out_of_stock(text):
                return True
            if "success" in classes and re.search(r"\bem stock\b", text, re.I):
                return False
    except Exception:
        pass

    for selector in out_of_stock_selectors.split(","):
        selector = selector.strip()
        if not selector:
            continue
        try:
            loc = page.locator(selector)
            if loc.count() and loc.first.is_visible():
                if text_indicates_out_of_stock(loc.first.inner_text(timeout=2000)):
                    return True
        except Exception:
            continue

    for area_selector in stock_areas.split(","):
        area_selector = area_selector.strip()
        if not area_selector:
            continue
        try:
            area = page.locator(area_selector)
            if area.count() and text_indicates_out_of_stock(area.first.inner_text(timeout=2000)):
                return True
        except Exception:
            continue

    try:
        cart_btn = page.locator(
            "button.add-to-cart, [data-button-action='add-to-cart'], #add-to-cart-or-refresh button"
        )
        if cart_btn.count():
            btn = cart_btn.first
            label = btn.inner_text(timeout=2000).strip()
            if text_indicates_out_of_stock(label):
                return True
            if btn.is_disabled() and text_indicates_out_of_stock(
                page.locator(".product-add-to-cart, .product-actions").first.inner_text(timeout=2000)
            ):
                return True
    except Exception:
        pass

    return False


def slug_from_product_url(url: str) -> str:
    path = urlparse(url).path.strip("/")
    if not path:
        return "unknown"
    segments = [s for s in path.split("/") if s]
    return segments[-1] if segments else "unknown"


def build_product_id(
    source: str,
    url: str,
    storage: str | None,
    grade: str | None,
    color: str | None = None,
) -> str:
    base = slug_from_product_url(url)
    parts = [source, base]
    if storage:
        parts.append(storage.lower().replace(" ", ""))
    if grade:
        parts.append(grade.lower().replace(" ", "_"))
    if color:
        parts.append(re.sub(r"[^a-z0-9]+", "_", color.lower()).strip("_"))
    return "_".join(parts)


def resolve_image_url(locator: Locator) -> str | None:
    for attr in IMAGE_SRC_ATTRIBUTES:
        value = locator.get_attribute(attr)
        if value and value.strip() and not value.startswith("data:"):
            return value.strip()
    srcset = locator.get_attribute("srcset")
    if srcset:
        first = srcset.split(",")[0].strip().split(" ")[0]
        if first and not first.startswith("data:"):
            return first
    return None


def setup_logging(log_file: Any, name: str = "ricycle") -> logging.Logger:
    log_file.parent.mkdir(parents=True, exist_ok=True)
    formatter = logging.Formatter("%(asctime)s [%(levelname)s] %(message)s")

    root = logging.getLogger()
    root.setLevel(logging.INFO)
    root.handlers.clear()

    console = logging.StreamHandler()
    console.setFormatter(formatter)
    root.addHandler(console)

    file_handler = logging.FileHandler(log_file, encoding="utf-8")
    file_handler.setFormatter(formatter)
    root.addHandler(file_handler)

    return logging.getLogger(name)


def normalize_grade_refurbed(text: str | None) -> str | None:
    return extract_grade(text, REFURBED_GRADE_KEYWORDS)


def normalize_grade_swappie(text: str | None) -> str | None:
    return extract_grade(text, SWAPPIE_GRADE_KEYWORDS)


def affiliate_fields_from_config(cfg: dict[str, Any]) -> dict[str, Any]:
    """Campos de afiliado copiados da config da fonte."""
    aff = cfg.get("affiliate", {})
    enabled = bool(aff.get("enabled", False))
    return {
        "affiliate_enabled": enabled,
        "affiliate_network": aff.get("network") if enabled else None,
    }


def build_normalized_product(
    cfg: dict[str, Any],
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
    extra_grade_keywords: tuple[tuple[str, str], ...] = (),
    is_available: bool = True,
    availability: str | None = None,
    status: str | None = None,
) -> dict[str, Any] | None:
    """Schema único riCycle com campos de afiliado."""
    model = normalize_model_name(model)
    if not is_allowed_brand(model):
        logger.debug("Marca não permitida ignorada: %s", model)
        return None
    storage_norm = storage or extract_storage(model)
    grade_norm = grade or extract_grade(model, extra_grade_keywords)

    available = is_available
    if availability and text_indicates_out_of_stock(availability):
        available = False
    if status and text_indicates_out_of_stock(status):
        available = False

    record: dict[str, Any] = {
        "source": cfg["source"],
        "scraped_at": scraped_at,
        "product_id": build_product_id(cfg["source"], url, storage_norm, grade_norm, color),
        "category": category,
        "brand": detect_brand(model),
        "model": model,
        "storage": storage_norm,
        "color": color,
        "grade": grade_norm,
        "price": price,
        "original_price": original_price,
        "currency": cfg["currency"],
        "warranty_months": cfg["warranty_months"],
        "url": url,
        "image_url": image_url,
        "source_page": source_page,
        "is_available": available,
        **affiliate_fields_from_config(cfg),
    }
    if availability:
        record["availability"] = availability
    if status:
        record["status"] = status
    return record


def estimate_per_conversion(cfg: dict[str, Any]) -> float | None:
    aff = cfg.get("affiliate", {})
    pct = aff.get("commission_pct")
    basket = aff.get("avg_basket_eur")
    if pct is None or basket is None:
        return None
    return round(basket * pct / 100.0, 2)
