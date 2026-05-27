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

from playwright.sync_api import Locator

from config import (
    AFFILIATE_PLACEHOLDER,
    GRADE_KEYWORDS,
    IMAGE_SRC_ATTRIBUTES,
    REFURBED_GRADE_KEYWORDS,
    STORAGE_REGEX,
    SWAPPIE_GRADE_KEYWORDS,
)

logger = logging.getLogger(__name__)

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


def parse_price_eur(text: str | None) -> float | None:
    if not text:
        return None
    numbers = re.findall(r"\d+[,.]?\d*", text.replace("\xa0", " "))
    if not numbers:
        return None
    valor = numbers[-1].replace(".", "").replace(",", ".")
    try:
        return float(valor)
    except ValueError:
        return None


def parse_swappie_price_eur(text: str | None) -> float | None:
    """Preço actual Swappie — ignora o preço de lançamento Apple no mesmo bloco."""
    if not text:
        return None
    cleaned = re.split(r"Preço de lançamento|Apple\s*:", text, maxsplit=1, flags=re.I)[0]
    numbers = re.findall(r"\d+[,.]?\d*", cleaned.replace("\xa0", " "))
    if not numbers:
        return None
    valor = numbers[0].replace(".", "").replace(",", ".")
    try:
        return float(valor)
    except ValueError:
        return None


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
