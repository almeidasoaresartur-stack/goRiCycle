#!/usr/bin/env python3
"""
goRiCycle — Validador e limpador pós-scrape.

Corre depois do scrape completo e remove produtos inválidos dos JSONs.
Uso: python scrapers/validate_and_clean.py
     python scrapers/validate_and_clean.py --dry-run   (só mostra, não apaga)
     python scrapers/validate_and_clean.py --source refurbed  (só uma fonte)
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

_SCRAPERS_DIR = Path(__file__).resolve().parent
if str(_SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRAPERS_DIR))

from config import DATA_DIR
from common import text_indicates_out_of_stock

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

REPORT_PATH = DATA_DIR / "validate_and_clean_report.json"

SOURCES = {
    "iservices": DATA_DIR / "iservices_produtos.json",
    "refurbed": DATA_DIR / "refurbed_produtos.json",
    "swappie": DATA_DIR / "swappie_produtos.json",
    "certideal": DATA_DIR / "certideal_produtos.json",
    "callphone": DATA_DIR / "callphone_produtos.json",
}

# URLs que indicam página genérica/pesquisa — produto inválido
INVALID_URL_PATTERNS = [
    "/search/",
    "search_query=",
    "/procurar",
    "/c/",
    "/cat",
    "/categoria",
    "?q=",
    "/collections/all",
    "/collections/smartphones",
]

# Padrões no URL final (após redirect) que indicam que não é produto
REDIRECT_INVALID_PATTERNS = [
    "/search",
    "?q=",
    "/procurar",
    "/c/",
    "/collections/",
    "404",
    "/not-found",
]

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Upgrade-Insecure-Requests": "1",
}

# Respostas de bloqueio/limitação (Cloudflare, WAF, rate limit): não provam que a
# oferta morreu. A 11/10/2026 a Swappie respondeu 403 a 86/86 pedidos vindos do
# runner do GitHub Actions (na box os mesmos URLs dão 200) e a validação apagou
# a loja inteira. Estes códigos passam a ser «inconclusivos»: a oferta mantém-se.
INCONCLUSIVE_STATUS = frozenset({401, 403, 407, 429, 503})
RETRY_STATUS = frozenset({429, 503})
LIVE_RETRIES = 2
# Se mais de metade das verificações live de uma loja falhar (removível ou
# inconclusiva), não se remove nada por motivo live: é bloqueio, não catálogo.
MASS_FAILURE_RATIO = 0.5
MASS_FAILURE_MIN_CHECKS = 5
# Depois de N inconclusivos seguidos deixa de verificar a loja (poupa tempo e pedidos).
INCONCLUSIVE_STREAK_STOP = 10
INCONCLUSIVE_PREFIX = "Inconclusivo"

REQUEST_DELAY = 0.5
REQUEST_TIMEOUT = 12


def url_looks_valid(url: str) -> bool:
    """Verificação rápida sem fazer request — descarta URLs obviamente errados."""
    if not url or not url.startswith("http"):
        return False
    if len(url) < 20:
        return False
    for pattern in INVALID_URL_PATTERNS:
        if pattern in url:
            log.debug("URL rejeitado por padrão '%s': %s", pattern, url)
            return False
    return True


def page_has_price_hint(html: str) -> bool:
    """Heurística: página de produto costuma mostrar preço em EUR."""
    if "€" in html:
        return True
    lowered = html.lower()
    if "our_price" in lowered or "product-price" in lowered or "current-price" in lowered:
        return True
    return False


def iservices_html_out_of_stock(html: str) -> bool:
    """Deteta ficha iServices sem stock em HTML estático (SSR)."""
    lower = html.lower()
    if re.search(r"\bem stock\b", lower):
        return False
    if "brevemente dispon" in lower and "sem stock" in lower:
        return True
    if text_indicates_out_of_stock(html) and (
        "avisem-me quando" in lower or "avise-me quando" in lower or "product-add-to-cart" in lower
    ):
        return True
    return False


def verify_url_live(url: str, client: httpx.Client, *, source: str = "") -> tuple[bool, str]:
    """
    Faz GET à URL e verifica:
    - Resposta 200 (não 404, não 500)
    - URL final após redirect não é página genérica
    - Indícios de preço na página
    Devolve (válido, motivo_se_inválido)
    """
    try:
        response = client.get(url, timeout=REQUEST_TIMEOUT, follow_redirects=True)
        for attempt in range(LIVE_RETRIES):
            if response.status_code not in RETRY_STATUS:
                break
            retry_after = response.headers.get("Retry-After", "")
            time.sleep(min(float(retry_after), 30.0) if retry_after.isdigit() else 3.0 * (attempt + 1))
            response = client.get(url, timeout=REQUEST_TIMEOUT, follow_redirects=True)

        if response.status_code in INCONCLUSIVE_STATUS or response.headers.get("cf-mitigated"):
            return False, f"{INCONCLUSIVE_PREFIX}: HTTP {response.status_code} (bloqueio/limite)"

        if response.status_code == 404:
            return False, "404 Not Found"
        if response.status_code >= 400:
            return False, f"HTTP {response.status_code}"

        final_url = str(response.url)
        for pattern in REDIRECT_INVALID_PATTERNS:
            if pattern in final_url and pattern not in url:
                return False, f"Redirecionou para página genérica: {final_url}"

        original_domain = url.split("/")[2]
        final_domain = final_url.split("/")[2] if "//" in final_url else ""
        if original_domain != final_domain and final_domain:
            return False, f"Redirecionou para domínio diferente: {final_domain}"

        if not page_has_price_hint(response.text):
            return False, "Página sem indício de preço (possível categoria ou erro)"

        if source == "iservices" and iservices_html_out_of_stock(response.text):
            return False, "Sem stock (iServices)"

        return True, ""

    except httpx.TimeoutException:
        return False, f"{INCONCLUSIVE_PREFIX}: Timeout"
    except httpx.RequestError as exc:
        return False, f"{INCONCLUSIVE_PREFIX}: erro de rede ({type(exc).__name__})"


def is_inconclusive(reason: str) -> bool:
    return reason.startswith(INCONCLUSIVE_PREFIX)


def validate_price(product: dict) -> tuple[bool, str]:
    """Verifica se o preço está dentro de um intervalo realista."""
    price = product.get("price") or product.get("listing_price")
    if price is None:
        return False, "Sem preço"
    try:
        parsed = float(price)
    except (TypeError, ValueError):
        return False, f"Preço inválido: {price}"
    if parsed < 30:
        return False, f"Preço demasiado baixo: {parsed}€ (possível placeholder)"
    if parsed > 3000:
        return False, f"Preço demasiado alto: {parsed}€ (possível erro de scrape)"
    return True, ""


def validate_model(product: dict) -> tuple[bool, str]:
    """Verifica se o nome do modelo parece um produto real."""
    model = product.get("model") or product.get("name") or ""
    if not model:
        return False, "Sem modelo"

    title_lower = model.lower()
    tablet_keywords = ["ipad", "galaxy tab", "tab s", "tab a", "lenovo tab"]
    if any(k in title_lower for k in tablet_keywords):
        return True, ""

    if len(model.split()) < 2:
        return False, f"Modelo com apenas uma palavra: '{model}' (provavelmente categoria)"
    category_words = [
        "smartphones",
        "iphones",
        "laptops",
        "portáteis",
        "tablets",
        "wearables",
        "apple",
        "samsung",
        "recondicionados",
    ]
    if model.lower().strip() in category_words:
        return False, f"Modelo é nome de categoria: '{model}'"
    return True, ""


def load_json(path: Path) -> dict | list:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(data: dict | list, path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")


def validate_source(
    source_name: str,
    path: Path,
    *,
    dry_run: bool = False,
    check_live: bool = True,
) -> dict:
    """Valida todos os produtos de uma fonte. Devolve estatísticas do que foi removido."""
    data = load_json(path)
    if not data:
        log.warning("[%s] Ficheiro não encontrado ou vazio: %s", source_name, path)
        return {"total": 0, "kept": 0, "removed": 0, "reasons": {}, "removed_items": []}

    if isinstance(data, list):
        products = data
        is_list_format = True
    else:
        products = data.get("products", [])
        is_list_format = False

    log.info("\n%s", "=" * 50)
    log.info("Fonte: %s — %s produtos", source_name, len(products))

    kept: list[dict] = []
    removed: list[dict] = []
    removed_items: list[dict] = []
    reasons: dict[str, int] = {}
    inconclusive: dict[str, int] = {}
    live_checked = 0
    live_failed = 0
    inconclusive_streak = 0
    live_stopped = False
    # Candidatos a remoção por motivo live: só se removem no fim, se não houver
    # falha em massa.
    live_removals: list[tuple[dict, str]] = []

    with httpx.Client(headers=HEADERS, follow_redirects=True) as client:
        for index, product in enumerate(products):
            url = product.get("url", "")
            model = product.get("model") or product.get("name") or "?"

            model_ok, model_reason = validate_model(product)
            if not model_ok:
                removed.append(product)
                reasons[model_reason] = reasons.get(model_reason, 0) + 1
                removed_items.append({"model": model, "url": url, "reason": model_reason})
                log.debug("[REMOVE] %s — %s", model, model_reason)
                continue

            price_ok, price_reason = validate_price(product)
            if not price_ok:
                removed.append(product)
                reasons[price_reason] = reasons.get(price_reason, 0) + 1
                removed_items.append({"model": model, "url": url, "reason": price_reason})
                log.debug("[REMOVE] %s — %s", model, price_reason)
                continue

            if not url_looks_valid(url):
                reason = f"URL inválido: {url[:60]}"
                removed.append(product)
                reasons[reason] = reasons.get(reason, 0) + 1
                removed_items.append({"model": model, "url": url, "reason": reason})
                log.debug("[REMOVE] %s — %s", model, reason)
                continue

            if check_live and not live_stopped:
                if (index + 1) % 10 == 0:
                    log.info("  Verificando %s/%s...", index + 1, len(products))
                live_ok, live_reason = verify_url_live(url, client, source=source_name)
                live_checked += 1
                time.sleep(REQUEST_DELAY)
                if not live_ok:
                    live_failed += 1
                    if is_inconclusive(live_reason):
                        inconclusive[live_reason] = inconclusive.get(live_reason, 0) + 1
                        inconclusive_streak += 1
                        log.info("[MANTER] %s — %s", model[:50], live_reason)
                        if inconclusive_streak >= INCONCLUSIVE_STREAK_STOP:
                            live_stopped = True
                            log.warning(
                                "[%s] %s verificações inconclusivas seguidas — verificação live "
                                "suspensa para esta loja (provável bloqueio do IP).",
                                source_name,
                                inconclusive_streak,
                            )
                    else:
                        inconclusive_streak = 0
                        live_removals.append((product, live_reason))
                    kept.append(product)
                    continue
                inconclusive_streak = 0

            kept.append(product)

    mass_failure = (
        live_checked >= MASS_FAILURE_MIN_CHECKS
        and live_failed / live_checked > MASS_FAILURE_RATIO
    )
    live_aborted = bool(live_removals) and (mass_failure or live_stopped)
    if live_aborted:
        log.warning(
            "[%s] Falha em massa na verificação live (%s/%s falharam%s) — "
            "remoção de %s oferta(s) por motivo live ABORTADA.",
            source_name,
            live_failed,
            live_checked,
            ", verificação suspensa" if live_stopped else "",
            len(live_removals),
        )
    else:
        removal_ids = {id(product) for product, _ in live_removals}
        kept = [product for product in kept if id(product) not in removal_ids]
        for product, reason in live_removals:
            model = product.get("model") or product.get("name") or "?"
            removed.append(product)
            reasons[reason] = reasons.get(reason, 0) + 1
            removed_items.append({"model": model, "url": product.get("url", ""), "reason": reason})
            log.info("[REMOVE] %s — %s", model[:50], reason)

    log.info("\n  Resultado %s:", source_name)
    log.info("  ✅ Mantidos:  %s", len(kept))
    log.info("  ❌ Removidos: %s", len(removed))
    if reasons:
        log.info("  Motivos de remoção:")
        for reason, count in sorted(reasons.items(), key=lambda item: -item[1]):
            log.info("    - %s: %s", reason, count)

    if not dry_run:
        if is_list_format:
            save_json(kept, path)
        else:
            data["products"] = kept
            data["total_products"] = len(kept)
            data["validated_at"] = datetime.now(timezone.utc).isoformat()
            save_json(data, path)
        log.info("  💾 JSON actualizado: %s", path)
    elif dry_run:
        log.info("  [DRY RUN] Nenhuma alteração guardada.")

    return {
        "total": len(products),
        "kept": len(kept),
        "removed": len(removed),
        "reasons": reasons,
        "removed_items": removed_items,
        "live_checked": live_checked,
        "live_failed": live_failed,
        "inconclusive": inconclusive,
        "live_check_stopped": live_stopped,
        "live_removal_aborted": live_aborted,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="goRiCycle — validador pós-scrape")
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Mostra o que seria removido sem alterar os ficheiros",
    )
    parser.add_argument(
        "--source",
        default="",
        help="Validar só uma fonte (ex: refurbed)",
    )
    parser.add_argument(
        "--no-live-check",
        action="store_true",
        help="Salta a verificação HTTP live (mais rápido, menos rigoroso)",
    )
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    check_live = not args.no_live_check

    sources_to_check = (
        {args.source: SOURCES[args.source]}
        if args.source and args.source in SOURCES
        else SOURCES
    )

    if args.dry_run:
        log.info("🔍 MODO DRY RUN — nenhum ficheiro será alterado\n")

    if not check_live:
        log.info("⚡ Verificação live desactivada — só validações locais\n")

    total_stats = {"total": 0, "kept": 0, "removed": 0}
    report: dict = {
        "validated_at": datetime.now(timezone.utc).isoformat(),
        "dry_run": args.dry_run,
        "check_live": check_live,
        "sources": {},
    }

    for source_name, path in sources_to_check.items():
        stats = validate_source(
            source_name,
            path,
            dry_run=args.dry_run,
            check_live=check_live,
        )
        total_stats["total"] += stats["total"]
        total_stats["kept"] += stats["kept"]
        total_stats["removed"] += stats["removed"]
        report["sources"][source_name] = stats

    report["summary"] = total_stats

    if not args.dry_run:
        save_json(report, REPORT_PATH)
        log.info("📄 Relatório guardado: %s", REPORT_PATH)

    log.info("\n%s", "=" * 50)
    log.info("TOTAL GERAL:")
    log.info("  Produtos verificados: %s", total_stats["total"])
    log.info("  ✅ Válidos e mantidos: %s", total_stats["kept"])
    log.info("  ❌ Removidos:          %s", total_stats["removed"])
    taxa = (total_stats["kept"] / total_stats["total"] * 100) if total_stats["total"] else 0
    log.info("  Taxa de qualidade:    %.1f%%", taxa)

    if total_stats["removed"] > 0 and not args.dry_run:
        log.info("\n✅ JSONs limpos e prontos para deploy.")
    elif total_stats["removed"] == 0:
        log.info("\n✅ Todos os produtos são válidos — nada removido.")


if __name__ == "__main__":
    main()
