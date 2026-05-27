"""
Valida a qualidade dos dados de todos os JSONs do riCycle.
Corre: python scrapers/validate_data.py
"""
import json
from pathlib import Path

sources = ["iservices", "refurbed", "swappie", "certideal"]
issues = []

for source in sources:
    path = Path(f"data/{source}_produtos.json")
    if not path.exists():
        print(f"[SKIP] {source} — ficheiro não encontrado")
        continue

    raw = json.loads(path.read_text(encoding="utf-8"))
    products = raw.get("products", raw) if isinstance(raw, dict) else raw
    invalid_prices = [
        p
        for p in products
        if p.get("price") is None or not (30 <= (p.get("price") or 0) <= 3000)
    ]
    no_url = [p for p in products if not p.get("url")]
    no_model = [p for p in products if not p.get("model")]

    print(f"\n{'=' * 40}")
    print(f"Fonte: {source} ({len(products)} produtos)")
    print(f"  Preços inválidos/ausentes: {len(invalid_prices)}")
    print(f"  Sem URL: {len(no_url)}")
    print(f"  Sem modelo: {len(no_model)}")

    if invalid_prices:
        print("  Exemplos de preços inválidos:")
        for p in invalid_prices[:3]:
            print(f"    - {p.get('model')} → price={p.get('price')}")

print("\n✅ Validação concluída.")
