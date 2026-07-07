#!/usr/bin/env python3
"""
goRiCycle — Agente Reels: gerador de guiões para Instagram Reels.

Lê data/all_products.json, selecciona produtos/temas e gera 2 guiões por semana
via Claude Haiku. Output em data/reels_scripts.json.

Uso:
    python scripts/reels_script_creator.py
"""

from __future__ import annotations

import json
import re
from collections import defaultdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from zoneinfo import ZoneInfo

from anthropic import Anthropic
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "data" / "all_products.json"
POSTS_FILE = ROOT / "data" / "posts_semana.json"
BLOG_FILE = ROOT / "web" / "lib" / "blog.ts"
OUTPUT_FILE = ROOT / "data" / "reels_scripts.json"
ARCHIVE_FILE = ROOT / "data" / "reels_scripts_archive.json"

load_dotenv(ROOT / ".env")

HAIKU_MODEL = "claude-haiku-4-5-20251001"
ESTIMATED_COST_USD = "~$0.01"

STORE_LABELS: dict[str, str] = {
    "iservices": "iServices",
    "refurbed": "Refurbed",
    "swappie": "Swappie",
    "certideal": "Certideal",
    "callphone": "Callphone",
}

FORMAT_PAIRS: list[tuple[str, str]] = [
    ("comparacao_rapida", "educacao"),
    ("educacao", "descoberta"),
    ("comparacao_rapida", "descoberta"),
]

REQUIRED_SCRIPT_KEYS = {
    "formato",
    "gancho",
    "cenas",
    "legenda_final",
    "cta",
    "hashtags",
    "produtos_referenciados",
    "data_sugerida",
}


def store_label(source: str) -> str:
    return STORE_LABELS.get(source.lower(), source.title())


def group_key(product: dict) -> tuple[str, str, str]:
    return (
        (product.get("brand") or "").strip(),
        (product.get("model") or "").strip(),
        (product.get("storage") or "").strip(),
    )


def product_label(model: str, storage: str | None) -> str:
    storage_value = (storage or "").strip()
    if storage_value:
        return f"{model} {storage_value}"
    return model


def best_per_store(products: list[dict]) -> dict[str, dict]:
    by_store: dict[str, dict] = {}
    for product in products:
        source = product["source"]
        if source not in by_store or product["price"] < by_store[source]["price"]:
            by_store[source] = product
    return by_store


def load_products() -> list[dict]:
    with open(DATA_FILE, encoding="utf-8") as f:
        data = json.load(f)
    return [
        p
        for p in data.get("products", [])
        if p.get("is_available")
        and p.get("price") is not None
        and p.get("price", 0) > 50
        and p.get("model")
        and p.get("source")
    ]


def load_recent_static_models() -> set[str]:
    """Modelos já usados nos posts estáticos da última semana."""
    if not POSTS_FILE.exists():
        return set()

    try:
        data = json.load(open(POSTS_FILE, encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return set()

    gerado_em = data.get("gerado_em")
    if gerado_em:
        try:
            generated_at = datetime.fromisoformat(gerado_em.replace("Z", "+00:00"))
            if generated_at.tzinfo is None:
                generated_at = generated_at.replace(tzinfo=timezone.utc)
            age = datetime.now(timezone.utc) - generated_at.astimezone(timezone.utc)
            if age > timedelta(days=7):
                return set()
        except ValueError:
            pass

    used: set[str] = set()
    for post in data.get("posts", []):
        modelo = (post.get("modelo") or "").strip()
        if modelo:
            used.add(modelo.lower())
    return used


def build_comparisons(products: list[dict], excluded_models: set[str]) -> list[dict]:
    groups: dict[tuple[str, str, str], list[dict]] = defaultdict(list)
    for product in products:
        groups[group_key(product)].append(product)

    comparisons: list[dict] = []
    for key, group in groups.items():
        model = key[1]
        if model.lower() in excluded_models:
            continue

        by_store = best_per_store(group)
        if len(by_store) < 2:
            continue

        cheapest = min(by_store.values(), key=lambda p: p["price"])
        priciest = max(by_store.values(), key=lambda p: p["price"])
        if priciest["price"] <= cheapest["price"]:
            continue

        delta = round(priciest["price"] - cheapest["price"], 2)
        desconto_pct = round((delta / priciest["price"]) * 100, 1)

        comparisons.append(
            {
                "key": key,
                "model": model,
                "storage": key[2],
                "cheapest": cheapest,
                "priciest": priciest,
                "delta": delta,
                "desconto_pct": desconto_pct,
            }
        )

    comparisons.sort(key=lambda item: item["desconto_pct"], reverse=True)
    return comparisons


def build_discoveries(products: list[dict], excluded_models: set[str]) -> list[dict]:
    discoveries: list[dict] = []

    for product in products:
        model = (product.get("model") or "").strip()
        if not model or model.lower() in excluded_models:
            continue

        price = float(product["price"])
        original = product.get("original_price")
        desconto_pct = 0.0

        if original and original > price:
            desconto_pct = round(((float(original) - price) / float(original)) * 100, 1)

        discoveries.append(
            {
                "product": product,
                "model": model,
                "storage": product.get("storage") or "",
                "desconto_pct": desconto_pct,
                "price": price,
            }
        )

    discoveries.sort(
        key=lambda item: (item["desconto_pct"], -item["price"]),
        reverse=True,
    )
    return discoveries


def parse_blog_articles() -> list[dict]:
    if not BLOG_FILE.exists():
        return []

    content = BLOG_FILE.read_text(encoding="utf-8")
    articles: list[dict] = []
    pattern = re.compile(
        r'\{\s*slug:\s*"([^"]+)",\s*title:\s*"([^"]+)",\s*description:\s*"([^"]+)",'
        r'\s*publishedAt:\s*"([^"]+)",\s*readingMinutes:\s*(\d+),\s*content:\s*`([^`]+)`',
        re.DOTALL,
    )

    for match in pattern.finditer(content):
        slug, title, description, published_at, reading_minutes, body = match.groups()
        articles.append(
            {
                "slug": slug,
                "title": title,
                "description": description,
                "publishedAt": published_at,
                "readingMinutes": int(reading_minutes),
                "content": body.strip(),
                "url": f"https://goricycle.com/blog/{slug}",
            }
        )

    return articles


def select_week_formats() -> tuple[str, str]:
    week_number = date.today().isocalendar()[1]
    return FORMAT_PAIRS[week_number % len(FORMAT_PAIRS)]


def select_blog_article(articles: list[dict]) -> dict:
    week_number = date.today().isocalendar()[1]
    return articles[week_number % len(articles)]


def suggested_publish_dates() -> list[str]:
    tz = ZoneInfo("Europe/Lisbon")
    today = datetime.now(tz).date()
    dates: list[date] = []
    candidato = today + timedelta(days=1)

    while len(dates) < 2:
        if candidato.weekday() < 5:
            dates.append(candidato)
        candidato += timedelta(days=1)

    return [d.isoformat() for d in dates]


def build_comparacao_prompt(item: dict) -> str:
    model = product_label(item["model"], item["storage"])
    loja_barata = store_label(item["cheapest"]["source"])
    loja_cara = store_label(item["priciest"]["source"])
    preco_baixo = item["cheapest"]["price"]
    preco_alto = item["priciest"]["price"]

    return f"""Cria um guião de Instagram Reel em português de Portugal.

Formato: comparacao_rapida
Tom: "qual escolherias?" — directo, curioso, sem hype.

Dados reais:
- Modelo: {model}
- Loja mais barata: {loja_barata} a {preco_baixo}€
- Loja mais cara: {loja_cara} a {preco_alto}€
- Diferença: {item['delta']}€ ({item['desconto_pct']}%)
- Comparador: https://goricycle.com

Responde APENAS com um objecto JSON válido (sem markdown, sem explicação) com esta estrutura exacta:
{{
  "formato": "comparacao_rapida",
  "gancho": "texto para os primeiros 2-3 segundos",
  "cenas": [{{"texto_ecra": "overlay curto", "duracao_sugerida_seg": 3}}],
  "legenda_final": "legenda conversacional, não promocional",
  "cta": "call-to-action curto",
  "hashtags": ["3 a 5 hashtags em português"],
  "produtos_referenciados": ["ids dos produtos"],
  "data_sugerida": "YYYY-MM-DD"
}}

Regras:
- 4 a 6 cenas, total ~25-35 segundos
- Não uses "incrível", "fantástico", "imperdível"
- Inclui #goRiCycle nas hashtags (capitalização exacta: #goRiCycle)
- produtos_referenciados: usa estes IDs: "{item['cheapest'].get('product_id', '')}", "{item['priciest'].get('product_id', '')}"
"""


def build_descoberta_prompt(item: dict) -> str:
    product = item["product"]
    model = product_label(item["model"], item["storage"])
    loja = store_label(product["source"])
    preco = item["price"]
    desconto = item["desconto_pct"]

    return f"""Cria um guião de Instagram Reel em português de Portugal.

Formato: descoberta
Tom: "encontrei isto e não acreditei no preço" — surpresa honesta, sem exageros.

Dados reais:
- Modelo: {model}
- Loja: {loja}
- Preço: {preco}€
- Desconto estimado: {desconto}%
- Comparador: https://goricycle.com

Responde APENAS com um objecto JSON válido (sem markdown, sem explicação) com esta estrutura exacta:
{{
  "formato": "descoberta",
  "gancho": "texto para os primeiros 2-3 segundos",
  "cenas": [{{"texto_ecra": "overlay curto", "duracao_sugerida_seg": 3}}],
  "legenda_final": "legenda conversacional, não promocional",
  "cta": "call-to-action curto",
  "hashtags": ["3 a 5 hashtags em português"],
  "produtos_referenciados": ["ids dos produtos"],
  "data_sugerida": "YYYY-MM-DD"
}}

Regras:
- 4 a 6 cenas, total ~25-35 segundos
- Não uses "incrível", "fantástico", "imperdível"
- Inclui #goRiCycle nas hashtags (capitalização exacta: #goRiCycle)
- produtos_referenciados: usa este ID: "{product.get('product_id', '')}"
"""


def build_educacao_prompt(article: dict) -> str:
    excerpt = article["content"][:1200]

    return f"""Cria um guião de Instagram Reel em português de Portugal.

Formato: educacao
Tema baseado neste artigo do blog goRiCycle:
- Título: {article['title']}
- URL: {article['url']}
- Resumo: {article['description']}

Excerto do artigo:
{excerpt}

Responde APENAS com um objecto JSON válido (sem markdown, sem explicação) com esta estrutura exacta:
{{
  "formato": "educacao",
  "gancho": "texto para os primeiros 2-3 segundos",
  "cenas": [{{"texto_ecra": "overlay curto", "duracao_sugerida_seg": 3}}],
  "legenda_final": "legenda conversacional, não promocional",
  "cta": "call-to-action curto",
  "hashtags": ["3 a 5 hashtags em português"],
  "produtos_referenciados": [],
  "data_sugerida": "YYYY-MM-DD"
}}

Regras:
- 4 a 6 cenas, total ~25-35 segundos
- Educa sem ser professoral — tom conversacional
- Não uses "incrível", "fantástico", "imperdível"
- Inclui #goRiCycle nas hashtags (capitalização exacta: #goRiCycle)
- Menciona goricycle.com/blog na legenda ou CTA de forma natural
"""


def extract_json_object(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*", "", cleaned)
        cleaned = re.sub(r"\s*```$", "", cleaned)

    return json.loads(cleaned)


def validate_script(script: dict, expected_format: str) -> dict:
    missing = REQUIRED_SCRIPT_KEYS - set(script)
    if missing:
        raise ValueError(f"Campos em falta no guião: {', '.join(sorted(missing))}")

    if script["formato"] != expected_format:
        script["formato"] = expected_format

    if not isinstance(script["cenas"], list) or not script["cenas"]:
        raise ValueError("O campo 'cenas' tem de ser uma lista não vazia.")

    for cena in script["cenas"]:
        if "texto_ecra" not in cena or "duracao_sugerida_seg" not in cena:
            raise ValueError("Cada cena precisa de texto_ecra e duracao_sugerida_seg.")

    if not isinstance(script["hashtags"], list) or not (3 <= len(script["hashtags"]) <= 5):
        raise ValueError("hashtags deve ter entre 3 e 5 entradas.")

    if not isinstance(script["produtos_referenciados"], list):
        script["produtos_referenciados"] = []

    return script


def generate_script(client: Anthropic, prompt: str, expected_format: str) -> dict:
    response = client.messages.create(
        model=HAIKU_MODEL,
        max_tokens=900,
        messages=[{"role": "user", "content": prompt}],
    )
    raw = response.content[0].text.strip()
    script = extract_json_object(raw)
    return validate_script(script, expected_format)


def archive_existing_output() -> None:
    if not OUTPUT_FILE.exists():
        return

    with open(OUTPUT_FILE, encoding="utf-8") as f:
        existing = json.load(f)

    archive: list[dict] = []
    if ARCHIVE_FILE.exists():
        with open(ARCHIVE_FILE, encoding="utf-8") as f:
            archive = json.load(f)

    archive.append(
        {
            "archived_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
            **existing,
        }
    )

    ARCHIVE_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(ARCHIVE_FILE, "w", encoding="utf-8") as f:
        json.dump(archive, f, ensure_ascii=False, indent=2)
        f.write("\n")


def save_output(scripts: list[dict]) -> None:
    payload = {
        "gerado_em": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "total_scripts": len(scripts),
        "scripts": scripts,
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")


def build_generation_plan(
    comparisons: list[dict],
    discoveries: list[dict],
    articles: list[dict],
) -> list[tuple[str, object, str]]:
    format_a, format_b = select_week_formats()
    plan: list[tuple[str, object, str]] = []
    used_models: set[str] = set()
    used_comparison_keys: set[tuple[str, str, str]] = set()

    def pick_comparison() -> dict | None:
        for item in comparisons:
            if item["key"] in used_comparison_keys:
                continue
            used_comparison_keys.add(item["key"])
            used_models.add(item["model"].lower())
            return item
        return None

    def pick_discovery() -> dict | None:
        for item in discoveries:
            model = item["model"].lower()
            if model in used_models:
                continue
            used_models.add(model)
            return item
        return None

    selectors = {
        "comparacao_rapida": lambda: pick_comparison(),
        "descoberta": lambda: pick_discovery() or pick_comparison(),
        "educacao": lambda: select_blog_article(articles) if articles else None,
    }

    for formato in (format_a, format_b):
        item = selectors[formato]()
        if not item:
            continue

        if formato == "educacao":
            label = item["title"]
        elif formato == "descoberta" and "product" in item:
            label = product_label(item["model"], item["storage"])
        else:
            label = product_label(item["model"], item["storage"])

        plan.append((formato, item, label))

    return plan[:2]


def main() -> None:
    products = load_products()
    excluded_models = load_recent_static_models()
    comparisons = build_comparisons(products, excluded_models)
    discoveries = build_discoveries(products, excluded_models)
    articles = parse_blog_articles()
    publish_dates = suggested_publish_dates()
    plan = build_generation_plan(comparisons, discoveries, articles)

    if len(plan) < 2:
        raise SystemExit("Não há dados suficientes para gerar 2 guiões.")

    print("goRiCycle Reels Script Creator")
    print("─────────────────────────")
    print(f"Produtos carregados: {len(products)}")
    print(f"Comparações disponíveis: {len(comparisons)}")
    print(f"Artigos do blog: {len(articles)}")
    print(f"Guiões a gerar: 2")
    print()

    client = Anthropic()
    scripts: list[dict] = []

    for index, (formato, item, label) in enumerate(plan, start=1):
        print(f"[{index}/2] {formato}: {label}")

        if formato == "comparacao_rapida":
            prompt = build_comparacao_prompt(item)
        elif formato == "descoberta":
            if "product" in item:
                prompt = build_descoberta_prompt(item)
            else:
                discovery_item = {
                    "product": item["cheapest"],
                    "model": item["model"],
                    "storage": item["storage"],
                    "desconto_pct": item["desconto_pct"],
                    "price": item["cheapest"]["price"],
                }
                prompt = build_descoberta_prompt(discovery_item)
        else:
            prompt = build_educacao_prompt(item)

        script = generate_script(client, prompt, formato)
        script["data_sugerida"] = publish_dates[index - 1]
        scripts.append(script)

    archive_existing_output()
    save_output(scripts)

    print()
    print("Guiões guardados em: data/reels_scripts.json")
    print("─────────────────────────")
    print(f"Custo estimado: {ESTIMATED_COST_USD}")


if __name__ == "__main__":
    main()
