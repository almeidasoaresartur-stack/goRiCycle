#!/usr/bin/env python3
"""
goRiCycle — Agente 2: Content Creator.

Lê data/all_products.json, selecciona produtos interessantes para posts e gera
conteúdo para Instagram/LinkedIn/WhatsApp via Claude Haiku. Output em
data/posts_semana.json.

Uso:
    python scripts/content_creator.py
"""

from __future__ import annotations

import json
import re
import unicodedata
from collections import defaultdict
from datetime import date, datetime, timezone
from pathlib import Path

from anthropic import Anthropic
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
DATA_FILE = ROOT / "data" / "all_products.json"
OUTPUT_FILE = ROOT / "data" / "posts_semana.json"

load_dotenv(ROOT / ".env")

STORE_LABELS: dict[str, str] = {
    "iservices": "iServices",
    "refurbed": "Refurbed",
    "swappie": "Swappie",
    "certideal": "Certideal",
    "callphone": "Callphone",
}

NOISE_PATTERNS = [
    re.compile(r"\brecondicionad[oa]s?\b", re.I),
    re.compile(r"\bgrade\s*[a-d]\b", re.I),
    re.compile(r"\b(premium|excelente|muito bom|bom|correcto|correto)\b", re.I),
    re.compile(r"\b(novo|usado|semi[- ]?novo)\b", re.I),
    re.compile(r"\b(refurbished|renewed)\b", re.I),
    re.compile(r"\b\d+\s*gb\b", re.I),
]

HAIKU_MODEL = "claude-haiku-4-5-20251001"
ESTIMATED_COST_USD = "~$0.01"

MODELOS_EXCLUIR = (
    "iphone 6", "iphone 6s", "iphone 6 plus", "iphone 6s plus",
    "iphone 7", "iphone 7 plus",
    "iphone 8", "iphone 8 plus",
    "iphone se", "iphone se 2", "iphone se 3",
    "iphone x", "iphone xr", "iphone xs", "iphone xs max",
    "ipad 5", "ipad 6", "ipad 7",
    "samsung galaxy s8", "samsung galaxy s9", "samsung galaxy s10",
)

STORAGE_MINIMO_GB = 64

NOME_REJEITAR = ("NOVO", " NEW ", "128GB 128GB", "64GB 64GB", "256GB 256GB")

HASHTAG_INSTRUCTION = (
    "IMPORTANTE: A hashtag da marca é sempre #goRiCycle (com este capitalização exacta: "
    "g minúsculo, o minúsculo, R maiúsculo, i minúsculo, C maiúsculo, y minúsculo, "
    "c minúsculo, l minúsculo, e minúsculo). Nunca uses #Goricycle, #GoriCycle, "
    "#GoRicycle ou qualquer outra variação."
)

BLOG_ARTICLES = [
    {
        "slug": "iphone-13-vale-a-pena-2026",
        "title": "Ainda faz sentido comprar um iPhone 13 em 2026?",
        "modelo_imagem": "iPhone 13",
        "url": "https://goricycle.com/blog/iphone-13-vale-a-pena-2026",
    },
    {
        "slug": "iphone-15-vs-iphone-16-recondicionado",
        "title": "iPhone 15 ou iPhone 16 recondicionado — qual vale mais a pena em 2026?",
        "modelo_imagem": "iPhone 15",
        "url": "https://goricycle.com/blog/iphone-15-vs-iphone-16-recondicionado",
    },
    {
        "slug": "google-pixel-vs-iphone-pro-recondicionado",
        "title": "Google Pixel ou iPhone Pro recondicionado — dois mundos, duas filosofias",
        "modelo_imagem": "iPhone 15 Pro",
        "url": "https://goricycle.com/blog/google-pixel-vs-iphone-pro-recondicionado",
    },
    {
        "slug": "iphone-se-2022-recondicionado-2026",
        "title": "iPhone SE (2022) recondicionado — pequeno no tamanho, inteligente na escolha",
        "modelo_imagem": "iPhone SE",
        "url": "https://goricycle.com/blog/iphone-se-2022-recondicionado-2026",
    },
]


def store_label(source: str) -> str:
    return STORE_LABELS.get(source.lower(), source.title())


def parse_storage_gb(storage_str: str) -> int:
    """Extrai o número de GB de uma string como '32GB', '128GB', etc."""
    if not storage_str:
        return 0
    match = re.search(r"(\d+)\s*GB", storage_str, re.IGNORECASE)
    return int(match.group(1)) if match else 0


def clean_base_model(model: str) -> str:
    name = (model or "").strip()
    if not name:
        return "modelo-desconhecido"
    name = re.split(r"\s[-–|]\s", name)[0].strip()
    for pattern in NOISE_PATTERNS:
        name = pattern.sub(" ", name)
    name = re.sub(r"\(\s*\)", "", name)
    return re.sub(r"\s{2,}", " ", name).strip() or "modelo-desconhecido"


def slugify(model: str, storage: str | None = None) -> str:
    base = clean_base_model(model)
    parts = [base]
    if storage and storage.strip():
        parts.append(storage.strip())
    text = " ".join(parts).lower()
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    text = re.sub(r"[^a-z0-9\s-]", "", text)
    text = re.sub(r"\s+", "-", text)
    text = re.sub(r"-+", "-", text).strip("-")
    return f"{text}-recondicionado"


def format_price_terminal(price: float) -> str:
    if price == int(price):
        return str(int(price))
    return f"{price:.2f}".rstrip("0").rstrip(".")


def group_key(product: dict) -> tuple[str, str, str]:
    return (
        (product.get("brand") or "").strip(),
        (product.get("model") or "").strip(),
        (product.get("storage") or "").strip(),
    )


def best_per_store(products: list[dict]) -> dict[str, dict]:
    by_store: dict[str, dict] = {}
    for product in products:
        source = product["source"]
        if source not in by_store or product["price"] < by_store[source]["price"]:
            by_store[source] = product
    return by_store


def load_filtered_products() -> tuple[list[dict], int]:
    with open(DATA_FILE, encoding="utf-8") as f:
        data = json.load(f)

    total_loaded = len(data.get("products", []))
    products = [
        p
        for p in data["products"]
        if p.get("is_available")
        and p.get("price") is not None
        and p.get("price", 0) > 50
        and p.get("model")
        and p.get("source")
    ]
    products = [
        p
        for p in products
        if not any(
            p.get("model", "").lower().startswith(excluir)
            for excluir in MODELOS_EXCLUIR
        )
    ]
    products = [
        p for p in products
        if parse_storage_gb(p.get("storage", "")) >= STORAGE_MINIMO_GB
    ]
    products = [
        p for p in products
        if not any(rejeitar in p.get("model", "") for rejeitar in NOME_REJEITAR)
    ]
    products = [
        p for p in products
        if not (
            p.get("storage")
            and p.get("model", "").count(p.get("storage", "___")) > 1
        )
    ]
    return products, total_loaded


def select_comparisons(products: list[dict]) -> list[dict]:
    groups: dict[tuple[str, str, str], list[dict]] = defaultdict(list)
    for product in products:
        groups[group_key(product)].append(product)

    comparisons: list[dict] = []
    for key, group in groups.items():
        by_store = best_per_store(group)
        if len(by_store) < 2:
            continue

        cheapest = min(by_store.values(), key=lambda p: p["price"])
        priciest = max(by_store.values(), key=lambda p: p["price"])
        delta = round(priciest["price"] - cheapest["price"], 2)

        comparisons.append(
            {
                "key": key,
                "brand": key[0],
                "model": key[1],
                "storage": key[2],
                "cheapest": cheapest,
                "priciest": priciest,
                "delta": delta,
            }
        )

    comparisons.sort(key=lambda item: item["delta"], reverse=True)
    return comparisons[:3]


def select_highlights(
    products: list[dict], comparison_keys: set[tuple[str, str, str]]
) -> list[dict]:
    groups: dict[tuple[str, str, str], list[dict]] = defaultdict(list)
    for product in products:
        groups[group_key(product)].append(product)

    single_store_groups: list[tuple[tuple[str, str, str], list[dict]]] = []
    for key, group in groups.items():
        if key in comparison_keys:
            continue
        by_store = best_per_store(group)
        if len(by_store) != 1:
            continue
        single_store_groups.append((key, group))

    single_store_groups.sort(key=lambda item: min(p["price"] for p in item[1]))

    highlights: list[dict] = []
    vistos_tipo_b: set[str] = set()

    for key, group in single_store_groups:
        model = key[1]
        if model in vistos_tipo_b:
            continue
        melhor = min(group, key=lambda p: p["price"])
        highlights.append(melhor)
        vistos_tipo_b.add(model)
        if len(highlights) == 2:
            break

    return highlights


def select_blog_article() -> dict:
    """Selecciona o artigo da semana com base no número da semana do ano."""
    week_number = date.today().isocalendar()[1]
    index = week_number % len(BLOG_ARTICLES)
    return BLOG_ARTICLES[index]


def get_image_for_model(products: list[dict], modelo: str) -> str | None:
    """Busca a image_url do primeiro produto disponível que corresponda ao modelo."""
    for product in products:
        if (
            product.get("model", "").startswith(modelo)
            and product.get("image_url")
            and product.get("is_available")
        ):
            return product["image_url"]
    return None


def load_catalog_products() -> list[dict]:
    with open(DATA_FILE, encoding="utf-8") as f:
        data = json.load(f)
    return data.get("products", [])


def schedule_weekly_posts(
    comparisons: list[dict],
    highlights: list[dict],
    editorial: dict,
) -> list[tuple[str, dict]]:
    """Ordena os 5 posts: A → C → A → B → A."""
    scheduled: list[tuple[str, dict]] = []

    if comparisons:
        scheduled.append(("comparacao", comparisons[0]))
    scheduled.append(("editorial", editorial))
    if len(comparisons) > 1:
        scheduled.append(("comparacao", comparisons[1]))
    if highlights:
        scheduled.append(("destaque", highlights[0]))
    if len(comparisons) > 2:
        scheduled.append(("comparacao", comparisons[2]))

    return scheduled


def interleave_posts(
    comparisons: list[dict], highlights: list[dict]
) -> list[tuple[str, dict]]:
    scheduled: list[tuple[str, dict]] = []
    comp_idx = 0
    highlight_idx = 0

    while len(scheduled) < 5 and (comp_idx < len(comparisons) or highlight_idx < len(highlights)):
        if comp_idx < len(comparisons):
            scheduled.append(("comparacao", comparisons[comp_idx]))
            comp_idx += 1
        if highlight_idx < len(highlights) and len(scheduled) < 5:
            scheduled.append(("destaque", highlights[highlight_idx]))
            highlight_idx += 1

    return scheduled


def build_comparacao_prompt(item: dict) -> str:
    model = item["model"]
    storage = item["storage"]
    loja_barata = store_label(item["cheapest"]["source"])
    loja_cara = store_label(item["priciest"]["source"])
    preco_baixo = format_price_terminal(round(item["cheapest"]["price"], 2))
    preco_alto = format_price_terminal(round(item["priciest"]["price"], 2))
    delta = f"{item['delta']:.2f}"

    return f"""Escreve um post para Instagram/LinkedIn sobre uma comparação de preços de smartphones recondicionados.

Dados:
- Modelo: {model} {storage}
- Loja mais barata: {loja_barata} a {preco_baixo}€
- Loja mais cara: {loja_cara} a {preco_alto}€
- Diferença: {delta}€
- URL do comparador: https://goricycle.com

Formato obrigatório:
1. Corpo do post (3-4 frases, em português de Portugal, tom informal mas informativo, sem inventar informação)
2. CTA: uma frase a terminar com "→ goricycle.com"
3. Hashtags: exactamente 8 hashtags relevantes em português

Não uses emojis em excesso. Não uses "incrível", "fantástico", "imperdível". Sê directo e honesto.
Responde APENAS com o post, sem introdução nem explicação.

{HASHTAG_INSTRUCTION}"""


def build_destaque_prompt(product: dict) -> str:
    model = product["model"]
    storage = product.get("storage") or ""
    loja = store_label(product["source"])
    preco = format_price_terminal(round(product["price"], 2))
    garantia = product.get("warranty_months") or 0

    return f"""Escreve um post para Instagram/LinkedIn sobre um smartphone recondicionado em destaque.

Dados:
- Modelo: {model} {storage}
- Loja: {loja}
- Preço: {preco}€
- Garantia: {garantia} meses
- URL do comparador: https://goricycle.com

Formato obrigatório:
1. Corpo do post (3-4 frases, em português de Portugal, tom informal mas informativo)
2. CTA: uma frase a terminar com "→ goricycle.com"
3. Hashtags: exactamente 8 hashtags relevantes em português

Não uses emojis em excesso. Não uses "incrível", "fantástico", "imperdível". Sê directo e honesto.
Responde APENAS com o post, sem introdução nem explicação.

{HASHTAG_INSTRUCTION}"""


def generate_tipo_c_post(article: dict, image_url: str | None, client: Anthropic) -> dict:
    """Gera um post editorial de blog para redes sociais."""
    prompt = f"""Escreve um post para Instagram/Facebook a promover um artigo de blog sobre smartphones recondicionados.

Dados do artigo:
- Título: {article['title']}
- URL: {article['url']}

Formato obrigatório:
1. Abre com uma pergunta ou afirmação que crie curiosidade (1 frase)
2. Corpo do post (2-3 frases que resumem o valor do artigo sem dar tudo — o utilizador deve querer clicar para saber mais)
3. CTA: termina com "Lê o artigo completo → {article['url']}"
4. Hashtags: exactamente 8 hashtags relevantes em português

Tom: informal, honesto, sem exageros. Não uses "incrível", "fantástico", "imperdível".
IMPORTANTE: A hashtag da marca é sempre #goRiCycle (g minúsculo, R maiúsculo, C maiúsculo, resto minúsculo).
Verifica que todas as hashtags estão correctamente escritas em português, sem erros tipográficos.
Responde APENAS com o post, sem introdução nem explicação."""

    response = client.messages.create(
        model=HAIKU_MODEL,
        max_tokens=400,
        messages=[{"role": "user", "content": prompt}],
    )

    return {
        "dia": 2,
        "tipo": "editorial",
        "titulo_artigo": article["title"],
        "url_artigo": article["url"],
        "image_url": image_url,
        "post": response.content[0].text.strip(),
    }


def generate_post_text(client: Anthropic, prompt: str) -> str:
    response = client.messages.create(
        model=HAIKU_MODEL,
        max_tokens=500,
        messages=[{"role": "user", "content": prompt}],
    )
    return response.content[0].text.strip()


def build_post_record(day: int, tipo: str, item: dict, post_text: str) -> dict:
    if tipo == "comparacao":
        slug = slugify(item["model"], item["storage"] or None)
        return {
            "dia": day,
            "tipo": "comparacao",
            "modelo": item["model"],
            "storage": item["storage"],
            "lojas": [
                store_label(item["cheapest"]["source"]),
                store_label(item["priciest"]["source"]),
            ],
            "precos": [
                round(item["cheapest"]["price"], 2),
                round(item["priciest"]["price"], 2),
            ],
            "delta": round(item["delta"], 2),
            "url_comparador": f"https://goricycle.com/produto/{slug}",
            "post": post_text,
        }

    product = item
    return {
        "dia": day,
        "tipo": "destaque",
        "modelo": product["model"],
        "storage": product.get("storage") or "",
        "loja": store_label(product["source"]),
        "preco": round(product["price"], 2),
        "garantia_meses": product.get("warranty_months") or 0,
        "url_comparador": "https://goricycle.com",
        "post": post_text,
    }


def print_progress_line(index: int, total: int, tipo: str, item: dict) -> None:
    if tipo == "comparacao":
        storage = item["storage"]
        loja_barata = store_label(item["cheapest"]["source"])
        loja_cara = store_label(item["priciest"]["source"])
        preco_baixo = format_price_terminal(round(item["cheapest"]["price"], 2))
        preco_alto = format_price_terminal(round(item["priciest"]["price"], 2))
        delta = f"{item['delta']:.2f}"
        print(
            f"[{index}/{total}] Comparação: {item['model']} {storage} — "
            f"{loja_barata} €{preco_baixo} vs {loja_cara} €{preco_alto} (delta €{delta})"
        )
        return

    if tipo == "editorial":
        print(
            f'[{index}/{total}] Editorial: "{item["titulo_artigo"]}" → {item["url_artigo"]}'
        )
        return

    product = item
    storage = product.get("storage") or ""
    loja = store_label(product["source"])
    preco = format_price_terminal(round(product["price"], 2))
    print(f"[{index}/{total}] Destaque: {product['model']} {storage} — {loja} €{preco}")


def main() -> None:
    products, total_loaded = load_filtered_products()
    catalog_products = load_catalog_products()
    comparisons = select_comparisons(products)
    comparison_keys = {item["key"] for item in comparisons}
    highlights = select_highlights(products, comparison_keys)
    article = select_blog_article()
    image_url = get_image_for_model(catalog_products, article["modelo_imagem"])
    editorial_item = {
        "article": article,
        "image_url": image_url,
        "titulo_artigo": article["title"],
        "url_artigo": article["url"],
    }
    scheduled = schedule_weekly_posts(comparisons, highlights, editorial_item)
    total_posts = len(scheduled)

    print("goRiCycle Content Creator")
    print("─────────────────────────")
    print(f"Produtos carregados: {total_loaded}")
    print(f"Posts a gerar: {total_posts}")
    print()

    client = Anthropic()
    posts: list[dict] = []

    for day, (tipo, item) in enumerate(scheduled, start=1):
        if tipo == "editorial":
            print_progress_line(day, total_posts, tipo, item)
            post_record = generate_tipo_c_post(item["article"], item["image_url"], client)
            post_record["dia"] = day
            posts.append(post_record)
            continue

        print_progress_line(day, total_posts, tipo, item)
        prompt = (
            build_comparacao_prompt(item)
            if tipo == "comparacao"
            else build_destaque_prompt(item)
        )
        post_text = generate_post_text(client, prompt)
        posts.append(build_post_record(day, tipo, item, post_text))

    output = {
        "gerado_em": datetime.now(timezone.utc).replace(microsecond=0).isoformat(),
        "total_posts": total_posts,
        "posts": posts,
    }

    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print()
    print(f"Posts guardados em: data/posts_semana.json")
    print("─────────────────────────")
    print(f"Custo estimado: {ESTIMATED_COST_USD}")


if __name__ == "__main__":
    main()
