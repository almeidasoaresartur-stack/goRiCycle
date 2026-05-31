#!/usr/bin/env python3
"""
goRiCycle — limpeza de temporários/logs antigos e auditoria de JSONs órfãos.

Apaga ficheiros temporários ou de log com mais de 7 dias em pastas como
data/temp/ e logs/, e em data/*.log. Nunca altera all_products.json nem
qualquer ficheiro em web/data/.

Lista JSONs em data/ que o merge_and_clean.py não consome, para revisão manual.

Uso:
    python scripts/cleanup.py              # dry-run (predefinição)
    python scripts/cleanup.py --apply      # apaga temporários/logs > 7 dias
    python scripts/cleanup.py --json-only  # só auditoria de JSONs órfãos
"""

from __future__ import annotations

import argparse
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
SCRAPERS_DIR = PROJECT_ROOT / "scrapers"
DATA_DIR = PROJECT_ROOT / "data"
WEB_DATA_DIR = PROJECT_ROOT / "web" / "data"

if str(SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRAPERS_DIR))

from merge_and_clean import (  # noqa: E402
    ALL_PRODUCTS_JSON,
    PRODUCT_CORRECTIONS_JSON,
    REPORT_PATH,
    SOURCES,
)

DEFAULT_MAX_AGE_DAYS = 7

# Pastas onde ficheiros antigos podem ser removidos com segurança.
TEMP_DIR_CANDIDATES: tuple[Path, ...] = (
    DATA_DIR / "temp",
    DATA_DIR / "cache",
    PROJECT_ROOT / "logs",
    PROJECT_ROOT / "tmp",
)

# Padrões relativos à raiz do projeto (ficheiros soltos, não pastas inteiras).
TEMP_FILE_GLOBS: tuple[str, ...] = (
    "data/**/*.log",
    "data/log_erros.txt",
    "logs/**/*",
)

PROTECTED_BASENAMES: frozenset[str] = frozenset(
    {
        ALL_PRODUCTS_JSON.name,
        "all_products.json",
    }
)


def merge_used_json_names() -> frozenset[str]:
    """Nomes de JSON referenciados directamente pelo merge_and_clean.py."""
    names = {path.name for path in SOURCES.values()}
    names.add(PRODUCT_CORRECTIONS_JSON.name)
    names.add(ALL_PRODUCTS_JSON.name)
    names.add(REPORT_PATH.name)
    return frozenset(names)


def is_protected(path: Path) -> bool:
    """Ficheiros/pastas que este script nunca deve alterar."""
    try:
        path.relative_to(WEB_DATA_DIR)
        return True
    except ValueError:
        pass

    if path.name in PROTECTED_BASENAMES:
        return True

    resolved = path.resolve()
    if resolved == ALL_PRODUCTS_JSON.resolve():
        return True

    return False


def file_age(path: Path) -> timedelta:
    mtime = datetime.fromtimestamp(path.stat().st_mtime, tz=timezone.utc)
    return datetime.now(timezone.utc) - mtime


def format_size(num_bytes: int) -> str:
    if num_bytes < 1024:
        return f"{num_bytes} B"
    if num_bytes < 1024 * 1024:
        return f"{num_bytes / 1024:.1f} KB"
    return f"{num_bytes / (1024 * 1024):.1f} MB"


def collect_temp_files(max_age: timedelta) -> list[Path]:
    """Ficheiros candidatos à remoção por idade."""
    candidates: list[Path] = []
    seen: set[Path] = set()

    def add(path: Path) -> None:
        if not path.is_file() or is_protected(path):
            return
        resolved = path.resolve()
        if resolved in seen:
            return
        if file_age(path) <= max_age:
            return
        seen.add(resolved)
        candidates.append(path)

    for directory in TEMP_DIR_CANDIDATES:
        if not directory.exists():
            continue
        for path in directory.rglob("*"):
            add(path)

    for pattern in TEMP_FILE_GLOBS:
        for path in PROJECT_ROOT.glob(pattern):
            add(path)

    return sorted(candidates)


def delete_temp_files(paths: list[Path], *, apply: bool) -> tuple[int, int]:
    """Remove ficheiros; devolve (apagados, bytes libertados)."""
    deleted = 0
    freed = 0

    for path in paths:
        size = path.stat().st_size
        label = path.relative_to(PROJECT_ROOT)
        if apply:
            path.unlink(missing_ok=True)
            print(f"  ✓ apagado: {label} ({format_size(size)})")
        else:
            age_days = file_age(path).days
            print(f"  · {label} — {format_size(size)}, {age_days} dias")
        deleted += 1
        freed += size

    return deleted, freed


def list_unused_json_files() -> None:
    """Lista JSONs em data/ que o merge_and_clean não utiliza."""
    used = merge_used_json_names()
    print("\nJSONs usados pelo merge_and_clean.py (não listados para remoção):")
    for name in sorted(used):
        print(f"  · data/{name}")

    unused: list[Path] = []
    for path in sorted(DATA_DIR.glob("*.json")):
        if path.name.startswith("."):
            continue
        if is_protected(path):
            continue
        if path.name in used:
            continue
        unused.append(path)

    print("\nJSONs em data/ não referenciados pelo merge_and_clean.py:")
    if not unused:
        print("  (nenhum — catálogo limpo)")
        return

    print("  Revise antes de apagar; o script não os remove automaticamente.\n")
    for path in unused:
        stat = path.stat()
        mtime = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc)
        print(
            f"  ? {path.relative_to(PROJECT_ROOT)}"
            f" — {format_size(stat.st_size)}, modificado {mtime.date().isoformat()}"
        )


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Limpeza de temporários/logs antigos e auditoria de JSONs órfãos."
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="Apagar ficheiros temporários/logs com mais de 7 dias (predefinição: dry-run)",
    )
    parser.add_argument(
        "--days",
        type=int,
        default=DEFAULT_MAX_AGE_DAYS,
        metavar="N",
        help=f"Idade mínima em dias para remoção (predefinição: {DEFAULT_MAX_AGE_DAYS})",
    )
    parser.add_argument(
        "--json-only",
        action="store_true",
        help="Só listar JSONs em data/ não usados pelo merge_and_clean.py",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()

    if args.json_only:
        list_unused_json_files()
        return 0

    max_age = timedelta(days=max(args.days, 1))
    mode = "APLICAR" if args.apply else "DRY-RUN"
    print(f"goRiCycle cleanup — {mode} (ficheiros > {args.days} dias)\n")
    print("Protegidos: all_products.json, web/data/**")

    temp_files = collect_temp_files(max_age)
    print(f"\nTemporários / logs antigos ({len(temp_files)}):")
    if not temp_files:
        print("  (nenhum)")
    else:
        deleted, freed = delete_temp_files(temp_files, apply=args.apply)
        action = "Apagados" if args.apply else "Candidatos"
        print(f"\n{action}: {deleted} ficheiro(s), ~{format_size(freed)}")
        if not args.apply and deleted:
            print("Execute com --apply para remover.")

    list_unused_json_files()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
