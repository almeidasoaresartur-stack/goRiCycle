#!/usr/bin/env python3
"""
goRiCycle — Auditoria: padrões de duplicação no catálogo.

Lê data/all_products.json, normaliza modelo/storage, agrupa por
loja + modelo + storage + grade e lista combinações com frequência > 2.

Não altera nem apaga dados — apenas imprime no terminal.

Uso:
    python scrapers/analyze_duplicates.py
    python scrapers/analyze_duplicates.py --min-count 3
    python scrapers/analyze_duplicates.py --path data/all_products.json
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from collections import defaultdict
from pathlib import Path

_SCRAPERS_DIR = Path(__file__).resolve().parent
if str(_SCRAPERS_DIR) not in sys.path:
    sys.path.insert(0, str(_SCRAPERS_DIR))

from config import DATA_DIR

ALL_PRODUCTS_JSON = DATA_DIR / "all_products.json"


def normalize_field(value: str | None) -> str:
    """Minúsculas e espaços extra colapsados."""
    if not value:
        return ""
    return re.sub(r"\s+", " ", str(value).strip().lower())


def load_catalog(path: Path) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(
            f"Catálogo não encontrado: {path}\n"
            "Executa merge_and_clean.py ou check_all_products_links.py --build-catalog."
        )

    data = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(data, list):
        return data
    products = data.get("products", [])
    if not isinstance(products, list):
        raise ValueError(f"Formato inválido em {path}: campo 'products' em falta")
    return products


def group_key(product: dict) -> tuple[str, str, str, str]:
    loja = normalize_field(product.get("source") or product.get("loja"))
    model = normalize_field(product.get("model"))
    storage = normalize_field(product.get("storage"))
    grade = normalize_field(product.get("grade") or product.get("condition"))
    return loja, model, storage, grade


def analyze_duplicates(products: list[dict], min_count: int) -> dict[tuple[str, str, str, str], list[dict]]:
    groups: dict[tuple[str, str, str, str], list[dict]] = defaultdict(list)
    for product in products:
        groups[group_key(product)].append(product)

    return {key: items for key, items in groups.items() if len(items) > min_count}


def format_grade(grade: str) -> str:
    return grade if grade else "(sem grade)"


def print_report(
    duplicates: dict[tuple[str, str, str, str], list[dict]],
    total_products: int,
    min_count: int,
) -> None:
    if not duplicates:
        print(f"\nNenhuma combinação com frequência > {min_count}.")
        print(f"Total de produtos analisados: {total_products}")
        return

    sorted_groups = sorted(duplicates.items(), key=lambda item: (-len(item[1]), item[0][0], item[0][1]))

    total_dup_entries = sum(len(items) for items in duplicates.values())
    print("\n" + "=" * 72)
    print("AUDITORIA DE DUPLICADOS — goRiCycle")
    print("=" * 72)
    print(f"Produtos no catálogo:     {total_products}")
    print(f"Combinações suspeitas:    {len(sorted_groups)}  (frequência > {min_count})")
    print(f"Entradas nessas combinações: {total_dup_entries}")
    print("=" * 72)

    by_store: dict[str, list[tuple[tuple[str, str, str, str], list[dict]]]] = defaultdict(list)
    for key, items in sorted_groups:
        by_store[key[0]].append((key, items))

    for store in sorted(by_store):
        store_groups = by_store[store]
        store_entries = sum(len(items) for _, items in store_groups)
        print(f"\n{'─' * 72}")
        print(f"LOJA: {store.upper()}  ({len(store_groups)} combinações, {store_entries} entradas)")
        print(f"{'─' * 72}")

        for (loja, model, storage, grade), items in store_groups:
            count = len(items)
            storage_label = storage.upper() if storage else "(sem storage)"
            print(f"\n  ×{count}  |  {model}  |  {storage_label}  |  {format_grade(grade)}")

            urls = sorted({(p.get("url") or "").strip() for p in items if p.get("url")})
            product_ids = sorted({(p.get("product_id") or "").strip() for p in items if p.get("product_id")})
            prices = sorted({p.get("price") for p in items if isinstance(p.get("price"), (int, float))})

            if prices:
                print(f"       preços: {', '.join(f'{p:.2f}€' for p in prices)}")
            if len(urls) == 1:
                print(f"       url:    {urls[0]}")
            else:
                print(f"       urls ({len(urls)}):")
                for url in urls[:5]:
                    print(f"         - {url}")
                if len(urls) > 5:
                    print(f"         … +{len(urls) - 5} URLs distintas")
            if len(product_ids) <= 3:
                print(f"       ids:    {', '.join(product_ids)}")
            else:
                print(f"       ids:    {', '.join(product_ids[:3])} … +{len(product_ids) - 3}")

    print(f"\n{'=' * 72}")
    print("Fim do relatório (nenhum dado foi alterado).")
    print("=" * 72 + "\n")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Auditoria de duplicações em all_products.json (só leitura)."
    )
    parser.add_argument(
        "--path",
        type=Path,
        default=ALL_PRODUCTS_JSON,
        help=f"Caminho do catálogo (default: {ALL_PRODUCTS_JSON})",
    )
    parser.add_argument(
        "--min-count",
        type=int,
        default=2,
        help="Mostrar combinações com frequência estritamente superior a este valor (default: 2)",
    )
    args = parser.parse_args()

    if args.min_count < 1:
        parser.error("--min-count deve ser >= 1")

    products = load_catalog(args.path)
    duplicates = analyze_duplicates(products, min_count=args.min_count)
    print_report(duplicates, total_products=len(products), min_count=args.min_count)


if __name__ == "__main__":
    main()
