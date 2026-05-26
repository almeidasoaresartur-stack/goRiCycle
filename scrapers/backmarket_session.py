"""
Gestão de sessão Back Market — cookies manuais e Playwright storage_state.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

CF_COOKIE_NAMES = frozenset({"cf_clearance", "__cf_bm", "_cfuvid"})


def load_json(path: Path) -> dict[str, Any] | list[Any]:
    with path.open(encoding="utf-8") as fh:
        return json.load(fh)


def storage_state_exists(path: Path) -> bool:
    return path.is_file() and path.stat().st_size > 10


def cookie_names(storage_path: Path) -> list[str]:
    data = load_json(storage_path)
    if not isinstance(data, dict):
        return []
    return [c.get("name", "?") for c in data.get("cookies", []) if isinstance(c, dict)]


def has_cloudflare_cookies(storage_path: Path) -> bool:
    if not storage_state_exists(storage_path):
        return False
    data = load_json(storage_path)
    if not isinstance(data, dict):
        return False
    names = {c.get("name") for c in data.get("cookies", []) if isinstance(c, dict)}
    return bool(names & CF_COOKIE_NAMES)


def _same_site(value: Any) -> str:
    if not value:
        return "Lax"
    mapping = {"no_restriction": "None", "lax": "Lax", "strict": "Strict", "none": "None"}
    if isinstance(value, str):
        return mapping.get(value.lower(), "Lax")
    return "Lax"


def cookie_editor_to_storage_state(raw: dict[str, Any] | list[Any]) -> dict[str, Any]:
    """Converte export Cookie-Editor (array) ou Playwright storage_state (dict)."""
    if isinstance(raw, dict) and "cookies" in raw:
        return raw

    if not isinstance(raw, list):
        raise ValueError("Formato de cookies não reconhecido — esperado array ou storage_state Playwright.")

    cookies: list[dict[str, Any]] = []
    for item in raw:
        if not isinstance(item, dict) or "name" not in item or "value" not in item:
            continue
        domain = item.get("domain") or ".backmarket.pt"
        expires = item.get("expires") or item.get("expirationDate") or -1
        cookies.append(
            {
                "name": item["name"],
                "value": item["value"],
                "domain": domain,
                "path": item.get("path", "/"),
                "expires": float(expires) if expires else -1,
                "httpOnly": bool(item.get("httpOnly", False)),
                "secure": bool(item.get("secure", True)),
                "sameSite": _same_site(item.get("sameSite")),
            }
        )
    return {"cookies": cookies, "origins": []}


def ensure_storage_state(storage_path: Path, cookies_fallback: Path | None = None) -> Path:
    """Garante storage_state — importa cookies JSON se necessário."""
    if storage_state_exists(storage_path):
        return storage_path

    if cookies_fallback and storage_state_exists(cookies_fallback):
        raw = load_json(cookies_fallback)
        state = cookie_editor_to_storage_state(raw)
        storage_path.parent.mkdir(parents=True, exist_ok=True)
        with storage_path.open("w", encoding="utf-8") as fh:
            json.dump(state, fh, ensure_ascii=False, indent=2)
        return storage_path

    raise FileNotFoundError(
        f"Sessão Back Market não encontrada: {storage_path}\n"
        "Corre primeiro:\n"
        "  python scrapers/backmarket_probe.py capture\n"
        "ou importa cookies:\n"
        "  python scrapers/backmarket_probe.py import-cookies data/backmarket_cookies.json"
    )
