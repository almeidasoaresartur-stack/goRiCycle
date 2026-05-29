"""
Utilitários partilhados pelos scrapers riCycle.
"""

from __future__ import annotations

import logging
import random
import re
import time
from typing import Any
from urllib.parse import urlparse

from playwright.sync_api import Browser, Locator, Playwright

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
) -> dict[str, Any]:
    """Schema único riCycle com campos de afiliado."""
    model = normalize_model_name(model)
    storage_norm = storage or extract_storage(model)
    grade_norm = grade or extract_grade(model, extra_grade_keywords)

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
        **affiliate_fields_from_config(cfg),
    }
    return record


def estimate_per_conversion(cfg: dict[str, Any]) -> float | None:
    aff = cfg.get("affiliate", {})
    pct = aff.get("commission_pct")
    basket = aff.get("avg_basket_eur")
    if pct is None or basket is None:
        return None
    return round(basket * pct / 100.0, 2)
