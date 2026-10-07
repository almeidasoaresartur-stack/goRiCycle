#!/usr/bin/env python3
"""
riCycle — orquestrador de scrapers (5 fontes).

Uso:
    python scrapers/run_all.py
    python scrapers/run_all.py --mode incremental
    python scrapers/run_all.py --sources iservices,refurbed,backmarket --categories iphones
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import signal
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

_SCRAPERS_DIR = Path(__file__).resolve().parent
if str(_SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRAPERS_DIR))

from common import estimate_per_conversion, setup_logging
from config import ALL_SOURCE_KEYS, CATEGORY_KEYS, DATA_DIR, LAST_RUN_SUMMARY_JSON, PROJECT_ROOT, SOURCE_CONFIGS

logger = logging.getLogger(__name__)

WEB_DATA_DIR = PROJECT_ROOT / "web" / "data"

SOURCE_MODULES = {
    "iservices": "iservices_scraper",
    "refurbed": "refurbed_scraper",
    "backmarket": "backmarket_scraper",
    "swappie": "swappie_scraper",
    "certideal": "certideal_scraper",
    "callphone": "callphone_scraper",
}

# Um scraper preso não pode ocupar o job inteiro (timeout do Actions: 180 min).
# Os valores cabem na folga do job mesmo que um deles seja morto no limite.
SOURCE_TIMEOUT_SEC = {
    "iservices": 12 * 60,
    "refurbed": 90 * 60,
    "backmarket": 25 * 60,
    "swappie": 25 * 60,
    "certideal": 35 * 60,
    "callphone": 10 * 60,
}
DEFAULT_SOURCE_TIMEOUT_SEC = 30 * 60
_PROCESS_STOP_GRACE_SEC = 15


def build_affiliate_revenue_estimate() -> dict[str, dict]:
    """Estimativa por conversão a partir das configs de afiliado."""
    estimate: dict[str, dict] = {}
    for source, cfg in SOURCE_CONFIGS.items():
        aff = cfg.get("affiliate", {})
        pct = aff.get("commission_pct")
        basket = aff.get("avg_basket_eur")
        estimate[source] = {
            "commission_pct": pct,
            "avg_basket": basket,
            "est_per_conversion": estimate_per_conversion(cfg),
        }
    return estimate


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="riCycle — corre todos os scrapers")
    parser.add_argument("--mode", choices=("full", "incremental"), default="full")
    parser.add_argument(
        "--sources",
        default=",".join(ALL_SOURCE_KEYS),
        help=f"Fontes separadas por vírgula (default: {','.join(ALL_SOURCE_KEYS)})",
    )
    parser.add_argument(
        "--categories",
        default="",
        help="Categorias separadas por vírgula (default: todas)",
    )
    parser.add_argument(
        "--worker",
        action="store_true",
        help="Processo filho: corre uma fonte e escreve o JSON de stats",
    )
    parser.add_argument(
        "--stats-out",
        default="",
        help="Ficheiro de stats do worker (uso interno)",
    )
    return parser.parse_args()


def cleanup_source_json(sources: list[str], mode: str) -> None:
    """
    Limpeza pré-scrape: remove apenas JSONs corrompidos.

    Não apagar ficheiros válidos em modo full — os scrapers reescrevem o JSON
    no fim. Apagar antes fazia com que uma falha a meio deixasse o ficheiro
    em falta e o passo de commit do Actions rebentasse (git add → exit 128).
    """
    _ = mode  # API estável; já não há limpeza destrutiva por modo
    for source in sources:
        cfg = SOURCE_CONFIGS.get(source)
        if not cfg:
            continue

        output: Path = cfg["output_json"]
        targets = [output, WEB_DATA_DIR / output.name]

        if not output.exists():
            continue

        try:
            json.loads(output.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            for path in targets:
                if path.exists():
                    path.unlink()
                    logger.warning("Limpeza pré-scrape: JSON corrompido removido %s", path)


def _empty_failure(message: str) -> dict:
    return {
        "total": 0,
        "by_category": {},
        "errors": 1,
        "fatal_error": message,
    }


def run_source(source: str, mode: str, categories: list[str] | None) -> dict:
    module_name = SOURCE_MODULES.get(source)
    if not module_name:
        raise ValueError(f"Fonte desconhecida: {source}")

    module = __import__(module_name)
    return module.run_scraper(mode=mode, categories=categories)


def _write_stats(path: Path, stats: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(stats, ensure_ascii=False), encoding="utf-8")
    temporary.replace(path)


def run_worker(source: str, mode: str, categories: list[str] | None, stats_path: Path) -> None:
    """Corre uma fonte neste processo e grava as stats para o pai ler."""
    try:
        stats = run_source(source, mode, categories)
    except Exception as exc:
        logger.error("Scraper %s falhou: %s", source, exc, exc_info=True)
        stats = _empty_failure(str(exc))
    _write_stats(stats_path, stats)


def _stop_process_group(proc: subprocess.Popen) -> None:
    """Termina o worker e o Chromium que ele lançou."""
    if proc.poll() is not None:
        return
    try:
        os.killpg(proc.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    try:
        proc.wait(timeout=_PROCESS_STOP_GRACE_SEC)
    except subprocess.TimeoutExpired:
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except ProcessLookupError:
            pass
        proc.wait(timeout=_PROCESS_STOP_GRACE_SEC)


def run_source_bounded(source: str, mode: str, categories: list[str] | None) -> dict:
    """
    Corre o scraper num processo à parte.

    Se o Playwright ficar preso (driver morto, página que não responde),
    o pai mata o grupo de processos e segue para a fonte seguinte.
    """
    timeout_sec = SOURCE_TIMEOUT_SEC.get(source, DEFAULT_SOURCE_TIMEOUT_SEC)
    stats_path = DATA_DIR / f".{source}_run_stats.json"
    stats_path.unlink(missing_ok=True)
    logger.info("A iniciar scraper: %s (limite %ss)", source, timeout_sec)

    command = [
        sys.executable,
        str(Path(__file__).resolve()),
        "--worker",
        "--mode",
        mode,
        "--sources",
        source,
        "--stats-out",
        str(stats_path),
    ]
    if categories:
        command.extend(["--categories", ",".join(categories)])

    env = os.environ.copy()
    env["PYTHONUNBUFFERED"] = "1"
    proc = subprocess.Popen(command, start_new_session=True, env=env)
    timed_out = False
    try:
        proc.wait(timeout=timeout_sec)
    except subprocess.TimeoutExpired:
        timed_out = True
        logger.error(
            "Scraper %s excedeu %ss — a terminar o processo para não bloquear o job",
            source,
            timeout_sec,
        )
        _stop_process_group(proc)

    try:
        if timed_out:
            return _empty_failure(
                f"Timeout {timeout_sec}s — processo terminado para não bloquear os outros scrapers"
            )
        if proc.returncode != 0 or not stats_path.exists():
            return _empty_failure(f"Scraper terminou com código {proc.returncode}")
        return json.loads(stats_path.read_text(encoding="utf-8"))
    finally:
        stats_path.unlink(missing_ok=True)
        Path(str(stats_path) + ".tmp").unlink(missing_ok=True)


def _parse_source_args(args: argparse.Namespace) -> tuple[list[str], list[str] | None]:
    sources = [s.strip() for s in args.sources.split(",") if s.strip()]
    categories = [c.strip() for c in args.categories.split(",") if c.strip()] or None

    if categories:
        invalid = [c for c in categories if c not in CATEGORY_KEYS]
        if invalid:
            raise ValueError(f"Categorias inválidas: {invalid}. Válidas: {list(CATEGORY_KEYS)}")

    invalid_sources = [s for s in sources if s not in SOURCE_MODULES]
    if invalid_sources:
        raise ValueError(f"Fontes inválidas: {invalid_sources}")
    return sources, categories


def main() -> None:
    setup_logging(DATA_DIR / "run_all.log")
    args = parse_args()
    sources, categories = _parse_source_args(args)

    if args.worker:
        if len(sources) != 1:
            raise SystemExit("--worker exige exactamente uma fonte")
        if not args.stats_out:
            raise SystemExit("--worker exige --stats-out")
        run_worker(sources[0], args.mode, categories, Path(args.stats_out))
        return

    cleanup_source_json(sources, args.mode)

    run_at = datetime.now(timezone.utc).isoformat()
    summary: dict = {
        "run_at": run_at,
        "mode": args.mode,
        "categories": categories or list(CATEGORY_KEYS),
        "sources": {},
        "grand_total": 0,
        "affiliate_revenue_estimate": build_affiliate_revenue_estimate(),
    }

    for source in sources:
        stats = run_source_bounded(source, args.mode, categories)
        summary["sources"][source] = stats
        summary["grand_total"] += stats.get("total", 0)
        if stats.get("fatal_error"):
            logger.error("Scraper %s falhou: %s", source, stats["fatal_error"])

    LAST_RUN_SUMMARY_JSON.parent.mkdir(parents=True, exist_ok=True)
    with LAST_RUN_SUMMARY_JSON.open("w", encoding="utf-8") as fh:
        json.dump(summary, fh, ensure_ascii=False, indent=2)

    logger.info(
        "Sumário guardado em %s | grand_total=%s",
        LAST_RUN_SUMMARY_JSON,
        summary["grand_total"],
    )


if __name__ == "__main__":
    main()
