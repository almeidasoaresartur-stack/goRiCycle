#!/usr/bin/env python3
"""
riCycle — teste gratuito Back Market (sessão manual + descoberta de API).

Passo 1 — Capturar sessão (browser visível, passar Cloudflare):
    python scrapers/backmarket_probe.py capture

Passo 2 — Probe com sessão guardada:
    python scrapers/backmarket_probe.py probe --categories iphones

Alternativa — importar cookies Cookie-Editor:
    python scrapers/backmarket_probe.py import-cookies data/backmarket_cookies.json

Ficheiros gerados (gitignored):
    data/backmarket_storage_state.json
    data/backmarket_probe_results.json
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

from playwright.sync_api import Response, sync_playwright

_SCRAPERS_DIR = Path(__file__).resolve().parent
if str(_SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRAPERS_DIR))

from backmarket_session import (
    cookie_editor_to_storage_state,
    cookie_names,
    ensure_storage_state,
    has_cloudflare_cookies,
    load_json,
    storage_state_exists,
)
from backmarket_scraper import SEL, collect_listing_cards, create_browser_context, dismiss_cookie_banner
from common import setup_logging
from config import BACK_MARKET_CONFIG, CATEGORY_KEYS

CFG = BACK_MARKET_CONFIG
logger = logging.getLogger(__name__)

CAPTURE_INSTRUCTIONS = """
╔══════════════════════════════════════════════════════════════════╗
║  Back Market — captura de sessão                                   ║
╠══════════════════════════════════════════════════════════════════╣
║  1. Abre-se um browser na homepage Back Market                     ║
║  2. Passa Cloudflare / cookies se aparecer                         ║
║  3. Clica em iPhone ou Smartphones — vê produtos com preços        ║
║  4. Podes FECHAR o browser                                         ║
║  5. Volta ao Terminal e prime ENTER (só Enter — não escrevas nada!)  ║
╚══════════════════════════════════════════════════════════════════╝
"""


def _matches_api_pattern(url: str, patterns: tuple[str, ...]) -> bool:
    low = url.lower()
    if "backmarket" not in low:
        return False
    if any(ext in low for ext in (".js", ".css", ".png", ".svg", ".woff", ".jpg", ".webp")):
        return False
    return any(re.search(pat, url, re.I) for pat in patterns)


def _looks_like_product(node: dict[str, Any]) -> bool:
    keys = {k.lower() for k in node.keys()}
    has_price = bool(keys & {"price", "amount", "listing_price", "min_price", "price_amount", "raw_price"})
    has_name = bool(keys & {"title", "name", "model", "product_name", "product_title"})
    return has_price and has_name


def _find_product_nodes(obj: Any, found: list[dict[str, Any]], depth: int = 0) -> None:
    if depth > 10 or len(found) >= 20:
        return
    if isinstance(obj, dict):
        if _looks_like_product(obj):
            found.append(obj)
        for value in obj.values():
            _find_product_nodes(value, found, depth + 1)
    elif isinstance(obj, list):
        for item in obj[:100]:
            _find_product_nodes(item, found, depth + 1)


def capture_session(category: str = "iphones") -> Path:
    """Browser visível — utilizador passa Cloudflare; guarda storage_state."""
    listing_url = CFG["categories"].get(category)
    if not listing_url:
        raise ValueError(f"Categoria inválida: {category}")
    # Homepage (200) — evita 404 se a listagem falhar; utilizador pode navegar manualmente
    start_url = CFG.get("homepage_url") or listing_url

    storage_path: Path = CFG["storage_state_path"]
    profile_dir: Path = CFG["browser_profile_dir"]
    profile_dir.mkdir(parents=True, exist_ok=True)
    storage_path.parent.mkdir(parents=True, exist_ok=True)

    print(CAPTURE_INSTRUCTIONS)
    print(f"Página inicial: {start_url}", flush=True)
    print(f"Listagem iPhones (quando passares CF): {listing_url}\n", flush=True)

    with sync_playwright() as playwright:
        context = playwright.chromium.launch_persistent_context(
            user_data_dir=str(profile_dir),
            headless=False,
            locale="pt-PT",
            viewport={"width": 1920, "height": 1080},
            bypass_csp=True,
            user_agent=CFG["user_agent"],
            extra_http_headers=CFG.get("http_headers", {}),
        )
        page = context.pages[0] if context.pages else context.new_page()
        page.goto(start_url, wait_until="domcontentloaded", timeout=90_000)

        print("\n" + "─" * 60, flush=True)
        print("  ⚠️  NESTA LINHA só prime ENTER — não coles outros comandos!", flush=True)
        print("─" * 60, flush=True)
        input("\n>>> Já viste produtos? (podes ter fechado o browser) Prime ENTER... ")

        try:
            context.storage_state(path=str(storage_path))
        except Exception:
            pass
        try:
            context.close()
        except Exception:
            pass

    # Cookies ficam no perfil mesmo se o browser foi fechado antes do Enter
    print("\nA guardar sessão a partir do perfil do browser...", flush=True)
    export_profile(category, headed=True)
    return storage_path


def import_cookies(source: Path, dest: Path | None = None) -> Path:
    dest = dest or CFG["storage_state_path"]
    raw = load_json(source)
    state = cookie_editor_to_storage_state(raw)
    dest.parent.mkdir(parents=True, exist_ok=True)
    with dest.open("w", encoding="utf-8") as fh:
        json.dump(state, fh, ensure_ascii=False, indent=2)
    logger.info("Importados %s cookies → %s", len(state["cookies"]), dest)
    return dest


def probe_category(category: str, storage_path: Path) -> dict[str, Any]:
    """Carrega listagem com sessão guardada; captura XHR e tenta replay via APIRequest."""
    category_url = CFG["categories"].get(category)
    if not category_url:
        raise ValueError(f"Categoria inválida: {category}")

    patterns = CFG.get("api_url_patterns", ())
    captured: list[dict[str, Any]] = []
    result: dict[str, Any] = {
        "category": category,
        "url": category_url,
        "probed_at": datetime.now(timezone.utc).isoformat(),
        "storage_state": str(storage_path),
        "has_cf_cookies": has_cloudflare_cookies(storage_path),
        "dom_cards": 0,
        "listing_cards_parsed": 0,
        "api_candidates": [],
        "api_replay": [],
        "sample_products_from_api": [],
    }

    def on_response(response: Response) -> None:
        try:
            url = response.url
            if not _matches_api_pattern(url, patterns):
                return
            entry: dict[str, Any] = {
                "url": url,
                "status": response.status,
                "content_type": response.headers.get("content-type", ""),
            }
            if "json" in entry["content_type"]:
                try:
                    body = response.json()
                    entry["json_keys"] = list(body.keys())[:15] if isinstance(body, dict) else type(body).__name__
                    products: list[dict[str, Any]] = []
                    _find_product_nodes(body, products)
                    if products:
                        entry["product_samples"] = len(products)
                        for sample in products[:3]:
                            result["sample_products_from_api"].append(
                                {k: sample[k] for k in list(sample.keys())[:12]}
                            )
                except Exception:
                    entry["json_error"] = True
            captured.append(entry)
        except Exception:
            pass

    with sync_playwright() as playwright:
        browser, _ = create_browser_context(playwright)
        context = browser.new_context(
            storage_state=str(storage_path),
            user_agent=CFG["user_agent"],
            locale="pt-PT",
            viewport={"width": 1920, "height": 1080},
            bypass_csp=True,
            extra_http_headers=CFG.get("http_headers", {}),
        )
        page = context.new_page()
        page.on("response", on_response)

        logger.info("Probe listagem: %s", category_url)
        page.goto(category_url, wait_until="domcontentloaded", timeout=90_000)
        post_wait = CFG.get("post_goto_wait_ms", 5000)
        page.wait_for_timeout(post_wait)
        dismiss_cookie_banner(page)

        result["page_title"] = page.title()
        result["final_url"] = page.url
        result["dom_cards"] = page.locator(SEL["product_card"]).count()

        cards = collect_listing_cards(page, CFG["base_url"]) if result["dom_cards"] else []
        result["listing_cards_parsed"] = len(cards)
        if cards:
            result["sample_listing_cards"] = cards[:3]

        seen: set[str] = set()
        for entry in captured:
            url = entry["url"]
            if url in seen:
                continue
            seen.add(url)
            result["api_candidates"].append(entry)

        request_ctx = context.request
        for entry in result["api_candidates"]:
            if entry.get("status") != 200 or "json" not in entry.get("content_type", ""):
                continue
            if not entry.get("product_samples"):
                continue
            replay: dict[str, Any] = {"url": entry["url"], "method": "GET"}
            try:
                resp = request_ctx.get(entry["url"], timeout=30_000)
                replay["status"] = resp.status
                if resp.ok:
                    data = resp.json()
                    products: list[dict[str, Any]] = []
                    _find_product_nodes(data, products)
                    replay["products_found"] = len(products)
                    if products:
                        replay["sample"] = {k: products[0][k] for k in list(products[0].keys())[:10]}
            except Exception as exc:
                replay["error"] = str(exc)
            result["api_replay"].append(replay)
            if len(result["api_replay"]) >= 5:
                break

        context.close()
        browser.close()

    return result


def run_probe(categories: list[str] | None = None) -> dict[str, Any]:
    storage_path = ensure_storage_state(
        CFG["storage_state_path"],
        CFG.get("cookies_json_path"),
    )
    selected = categories or ["iphones"]
    report: dict[str, Any] = {
        "probed_at": datetime.now(timezone.utc).isoformat(),
        "storage_state": str(storage_path),
        "has_cf_cookies": has_cloudflare_cookies(storage_path),
        "categories": {},
    }

    for category in selected:
        logger.info("=== Probe: %s ===", category)
        cat_result = probe_category(category, storage_path)
        report["categories"][category] = cat_result
        logger.info(
            "Resultado %s: dom_cards=%s parsed=%s api_candidates=%s",
            category,
            cat_result["dom_cards"],
            cat_result["listing_cards_parsed"],
            len(cat_result["api_candidates"]),
        )

    out_path: Path = CFG["probe_results_path"]
    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as fh:
        json.dump(report, fh, ensure_ascii=False, indent=2)
    logger.info("Relatório: %s", out_path)
    return report


def print_summary(report: dict[str, Any]) -> None:
    print("\n=== Back Market Probe — Resumo ===")
    print(f"Sessão CF cookies: {report.get('has_cf_cookies')}")
    for cat, data in report.get("categories", {}).items():
        print(f"\n[{cat}]")
        print(f"  URL: {data.get('url')}")
        print(f"  Título página: {data.get('page_title')!r}")
        print(f"  Cartões DOM: {data.get('dom_cards')}")
        print(f"  Cartões parseados: {data.get('listing_cards_parsed')}")
        print(f"  APIs capturadas: {len(data.get('api_candidates', []))}")
        if data.get("api_candidates"):
            print("  Top APIs:")
            for entry in data["api_candidates"][:5]:
                extra = f" (+{entry['product_samples']} produtos JSON)" if entry.get("product_samples") else ""
                print(f"    [{entry['status']}] {entry['url'][:100]}{extra}")
        if data.get("sample_listing_cards"):
            sample = data["sample_listing_cards"][0]
            print(f"  Exemplo: {sample.get('model')} — {sample.get('listing_price')}€")
    print(f"\nRelatório completo: {CFG['probe_results_path']}")


def cmd_status() -> None:
    storage: Path = CFG["storage_state_path"]
    cookies: Path = CFG["cookies_json_path"]
    print(f"storage_state: {'OK' if storage_state_exists(storage) else 'MISSING'} ({storage})")
    print(f"cookies_json:  {'OK' if storage_state_exists(cookies) else 'MISSING'} ({cookies})")
    if storage_state_exists(storage):
        print(f"CF cookies: {has_cloudflare_cookies(storage)}")
        names = cookie_names(storage)
        print(f"Cookies ({len(names)}): {', '.join(names[:12])}{'…' if len(names) > 12 else ''}")


def export_profile(category: str = "iphones", *, headed: bool = True) -> Path:
    """
    Guarda sessão a partir do perfil browser (sem precisar de Enter no capture).
    Usa depois de veres produtos no browser do `capture` — podes fechar o browser antes.
    """
    url = CFG["categories"].get(category)
    if not url:
        raise ValueError(f"Categoria inválida: {category}")

    profile_dir: Path = CFG["browser_profile_dir"]
    storage_path: Path = CFG["storage_state_path"]
    if not profile_dir.is_dir():
        raise FileNotFoundError(
            f"Perfil browser não encontrado: {profile_dir}\n"
            "Corre primeiro: python scrapers/backmarket_probe.py capture"
        )

    print(f"A ler cookies do perfil e a testar: {url}", flush=True)

    with sync_playwright() as playwright:
        context = playwright.chromium.launch_persistent_context(
            user_data_dir=str(profile_dir),
            headless=not headed,
            locale="pt-PT",
            viewport={"width": 1920, "height": 1080},
            bypass_csp=True,
            user_agent=CFG["user_agent"],
            extra_http_headers=CFG.get("http_headers", {}),
        )
        page = context.pages[0] if context.pages else context.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=90_000)
        page.wait_for_timeout(CFG.get("post_goto_wait_ms", 5000))
        dismiss_cookie_banner(page)

        cards = page.locator(SEL["product_card"]).count()
        title = page.title()
        print(f"Título: {title!r}", flush=True)
        print(f"Cartões visíveis: {cards}", flush=True)

        context.storage_state(path=str(storage_path))
        context.close()

    print(f"\nSessão guardada: {storage_path}", flush=True)
    if cards == 0:
        print(
            "AVISO: 0 cartões — abre o browser com `capture`, vê produtos, fecha o browser,\n"
            "       e corre outra vez: python scrapers/backmarket_probe.py save",
            flush=True,
        )
    else:
        print("OK! Seguinte: python scrapers/backmarket_probe.py probe --categories iphones", flush=True)
    return storage_path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="riCycle — probe Back Market (sessão manual)")
    sub = parser.add_subparsers(dest="command", required=True)

    sub.add_parser("capture", help="Abre browser — navega até ver produtos")
    sub.add_parser("save", help="Guarda sessão do perfil (sem Enter) — corre DEPOIS do capture")
    sub.add_parser("status", help="Verificar se existe sessão guardada")

    p_probe = sub.add_parser("probe", help="Testar listagem + APIs com sessão guardada")
    p_probe.add_argument("--categories", default="iphones")

    p_import = sub.add_parser("import-cookies", help="Converter export Cookie-Editor → storage_state")
    p_import.add_argument("source", type=Path)
    p_import.add_argument("--dest", type=Path, default=None)

    return parser.parse_args()


def main() -> None:
    setup_logging(CFG["probe_log_path"])
    args = parse_args()

    if args.command == "capture":
        capture_session()
        return

    if args.command == "save":
        export_profile()
        return

    if args.command == "status":
        cmd_status()
        return

    if args.command == "import-cookies":
        dest = import_cookies(args.source, args.dest)
        print(f"Importado → {dest}")
        return

    if args.command == "probe":
        cats = [c.strip() for c in args.categories.split(",") if c.strip()]
        invalid = [c for c in cats if c not in CATEGORY_KEYS]
        if invalid:
            raise ValueError(f"Categorias inválidas: {invalid}")
        report = run_probe(cats)
        print_summary(report)
        return


if __name__ == "__main__":
    main()
