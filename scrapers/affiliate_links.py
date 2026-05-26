"""
riCycle — transformação de URLs de produto em links de afiliado.

Uso futuro pela interface web. Os IDs reais de afiliado devem ser
configurados em scrapers/config.py (campo affiliate.base_tag) ou via
variáveis de ambiente — nunca commitar IDs reais no repositório.
"""

from __future__ import annotations

from typing import Any
from urllib.parse import quote

from config import AFFILIATE_PLACEHOLDER, SOURCE_CONFIGS


def _is_placeholder(tag: str | None) -> bool:
    return not tag or tag.strip().upper() == AFFILIATE_PLACEHOLDER.upper()


def make_affiliate_url(product: dict[str, Any], configs: dict[str, dict[str, Any]] | None = None) -> str:
    """
    Recebe um produto do schema normalizado e devolve a URL
    com o tag de afiliado aplicado, se disponível.

    Se affiliate_enabled=False ou base_tag não estiver definido (ou for PLACEHOLDER),
    devolve a URL original sem alteração.
    """
    original = product.get("url") or ""
    if not original:
        return original

    source = product.get("source", "")
    cfg_map = configs or SOURCE_CONFIGS
    cfg = cfg_map.get(source, {})
    aff = cfg.get("affiliate", {})

    if not aff.get("enabled", False):
        return original

    base_tag = aff.get("base_tag")
    if _is_placeholder(str(base_tag) if base_tag is not None else None):
        return original

    template = aff.get("url_template") or "{product_url}"
    try:
        return template.format(product_url=original, base_tag=quote(str(base_tag), safe=""))
    except (KeyError, ValueError):
        return original
