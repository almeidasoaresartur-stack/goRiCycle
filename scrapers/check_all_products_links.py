#!/usr/bin/env python3
"""
goRiCycle — Manutenção: verificação HTTP de amostra do catálogo.

Lê data/all_products.json, selecciona um lote aleatório de produtos
e verifica se cada URL responde HTTP 200. Links mortos são registados
em data/log_erros.txt (sem IA, só status HTTP).

Uso:
    python scrapers/check_all_products_links.py
    python scrapers/check_all_products_links.py --batch-size 50
    python scrapers/check_all_products_links.py --build-catalog   # gera all_products.json
    python scrapers/check_all_products_links.py --seed 42         # amostra reprodutível
"""

from __future__ import annotations

import argparse
import json
import logging
import random
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import httpx

_SCRAPERS_DIR = Path(__file__).resolve().parent
if str(_SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRAPERS_DIR))

from config import DATA_DIR
from merge_and_clean import SOURCES, merge_all_sources, save_json

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger(__name__)

ALL_PRODUCTS_JSON = DATA_DIR / "all_products.json"
LOG_ERROS_TXT = DATA_DIR / "log_erros.txt"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
}

REQUEST_TIMEOUT = 12.0
REQUEST_DELAY = 0.4


def load_catalog(path: Path) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(
            f"Catálogo não encontrado: {path}\n"
            "Corre com --build-catalog ou executa merge_and_clean.py primeiro."
        )

    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return data
    products = data.get("products", [])
    if not isinstance(products, list):
        raise ValueError(f"Formato inválido em {path}: campo 'products' em falta")
    return products


def build_and_save_catalog() -> list[dict]:
    """Gera all_products.json a partir das fontes individuais."""
    products, _removed, _relevance_removed, _corrections = merge_all_sources(SOURCES)
    payload = {
        "merged_at": datetime.now(timezone.utc).isoformat(),
        "total_products": len(products),
        "products": products,
    }
    save_json(payload, ALL_PRODUCTS_JSON)
    log.info("Catálogo guardado: %s (%s produtos)", ALL_PRODUCTS_JSON, len(products))
    return products


def check_url_status_200(client: httpx.Client, url: str) -> tuple[bool, str]:
    """
    Verifica HTTP 200. Fallback GET quando HEAD devolve 404 (ex.: Refurbed).
    Devolve (ok, motivo_se_falhar).
    """
    if not url or not url.startswith("http"):
        return False, "URL inválido ou em falta"

    try:
        response = client.head(url, timeout=REQUEST_TIMEOUT, follow_redirects=True)
        if response.status_code == 404:
            response = client.get(url, timeout=REQUEST_TIMEOUT, follow_redirects=True)

        if response.status_code == 200:
            return True, ""

        return False, f"HTTP {response.status_code}"

    except httpx.TimeoutException:
        return False, "Timeout"
    except httpx.RequestError as exc:
        return False, f"Erro de rede: {exc}"


def format_product_line(product: dict, reason: str) -> str:
    loja = product.get("source") or product.get("loja") or "?"
    model = product.get("model") or product.get("name") or "?"
    product_id = product.get("product_id") or "?"
    url = product.get("url") or "?"
    return f"[{reason}] {loja} | {model} | id={product_id} | {url}"


def append_log(lines: list[str], *, sample_size: int, total: int, errors: int) -> None:
    LOG_ERROS_TXT.parent.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).isoformat()

    with LOG_ERROS_TXT.open("a", encoding="utf-8") as fh:
        fh.write(f"\n{'=' * 60}\n")
        fh.write(f"Verificação: {stamp}\n")
        fh.write(f"Amostra: {sample_size} de {total} produtos | Erros: {errors}\n")
        fh.write(f"{'=' * 60}\n")
        if lines:
            fh.write("\n".join(lines))
            fh.write("\n")
        else:
            fh.write("(Nenhum link com erro nesta amostra.)\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="goRiCycle — verificação HTTP de amostra do catálogo",
    )
    parser.add_argument(
        "--batch-size",
        type=int,
        default=50,
        help="Número de produtos aleatórios a verificar (default: 50)",
    )
    parser.add_argument(
        "--catalog",
        type=Path,
        default=ALL_PRODUCTS_JSON,
        help=f"Caminho do catálogo (default: {ALL_PRODUCTS_JSON})",
    )
    parser.add_argument(
        "--log",
        type=Path,
        default=LOG_ERROS_TXT,
        help=f"Ficheiro de log de erros (default: {LOG_ERROS_TXT})",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=None,
        help="Seed para amostra aleatória reprodutível",
    )
    parser.add_argument(
        "--build-catalog",
        action="store_true",
        help="Gera all_products.json a partir das fontes antes de verificar",
    )
    parser.add_argument(
        "--delay",
        type=float,
        default=REQUEST_DELAY,
        help=f"Segundos entre pedidos HTTP (default: {REQUEST_DELAY})",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    global LOG_ERROS_TXT
    LOG_ERROS_TXT = args.log

    if args.build_catalog or not args.catalog.exists():
        if not args.catalog.exists():
            log.warning("Catálogo não encontrado — a gerar a partir das fontes...")
        build_and_save_catalog()

    products = load_catalog(args.catalog)
    total = len(products)

    if total == 0:
        log.error("Catálogo vazio: %s", args.catalog)
        return 1

    batch_size = min(max(1, args.batch_size), total)
    if args.seed is not None:
        random.seed(args.seed)

    sample = random.sample(products, batch_size)
    log.info("Catálogo: %s produtos | Amostra: %s", total, batch_size)

    error_lines: list[str] = []
    ok_count = 0

    with httpx.Client(headers=HEADERS, follow_redirects=True) as client:
        for index, product in enumerate(sample, start=1):
            url = product.get("url") or ""
            model = product.get("model") or "?"

            ok, reason = check_url_status_200(client, url)
            if ok:
                ok_count += 1
                log.debug("[%s/%s] OK %s", index, batch_size, model[:50])
            else:
                line = format_product_line(product, reason)
                error_lines.append(line)
                log.warning("[%s/%s] %s", index, batch_size, line)

            if index < batch_size:
                time.sleep(args.delay)

    append_log(
        error_lines,
        sample_size=batch_size,
        total=total,
        errors=len(error_lines),
    )

    log.info("\n%s", "=" * 50)
    log.info("Verificados: %s", batch_size)
    log.info("OK (200):    %s", ok_count)
    log.info("Erros:       %s", len(error_lines))
    log.info("Log:         %s", LOG_ERROS_TXT)

    return 0 if not error_lines else 2


if __name__ == "__main__":
    raise SystemExit(main())
