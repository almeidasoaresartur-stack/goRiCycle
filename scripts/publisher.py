#!/usr/bin/env python3
"""
goRiCycle — Agente 3: Publisher.

Lê data/posts_semana.json e envia cada post para a fila do Buffer (Instagram +
Facebook), agendado para os próximos dias úteis às 09h00 (Europe/Lisbon).

Uso:
    python scripts/publisher.py
"""

from __future__ import annotations

import json
import os
import sys
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import quote
from zoneinfo import ZoneInfo

import httpx
from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
POSTS_FILE = ROOT / "data" / "posts_semana.json"
ALL_PRODUCTS_FILE = ROOT / "data" / "all_products.json"

SITE_URL = "https://goricycle.com"
DEFAULT_IMAGE_URL = f"{SITE_URL}/images/goricycle-logo.png"


def build_proxy_image_url(image_url: str) -> str:
    """Serve a imagem através do nosso próprio domínio em vez de fazer
    hotlink directo à loja parceira — evita bloqueios de anti-bot/anti-hotlink
    quando o Buffer tenta descarregar a imagem para publicar no FB/IG."""
    return f"{SITE_URL}/api/product-image?url={quote(image_url, safe='')}"

load_dotenv(ROOT / ".env")

BUFFER_TOKEN = os.getenv("BUFFER_ACCESS_TOKEN")
INSTAGRAM_ID = os.getenv("BUFFER_INSTAGRAM_CHANNEL_ID")
FACEBOOK_ID = os.getenv("BUFFER_FACEBOOK_CHANNEL_ID")

BUFFER_API = "https://api.buffer.com"

CREATE_POST_MUTATION = """
mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    ... on PostActionSuccess {
      post {
        id
        text
        assets {
          id
          mimeType
        }
      }
    }
    ... on MutationError {
      message
    }
  }
}
"""


def format_due_at(scheduled_at: datetime) -> str:
    """Formata dueAt em UTC (ex: 2026-03-26T10:28:47.545Z) como na documentação Buffer."""
    utc = scheduled_at.astimezone(timezone.utc)
    return utc.strftime("%Y-%m-%dT%H:%M:%S.") + f"{utc.microsecond // 1000:03d}Z"


def parse_create_post_response(resultado: dict) -> dict:
    """Lê data.createPost como fragmento inline (PostActionSuccess ou MutationError)."""
    create_post = resultado.get("data", {}).get("createPost") or {}

    if resultado.get("errors"):
        return {"success": False, "error": resultado["errors"]}

    if create_post.get("message"):
        return {"success": False, "error": create_post["message"]}

    post_id = create_post.get("post", {}).get("id")
    if post_id:
        return {"success": True, "post_id": post_id}

    return {"success": False, "error": resultado}


def proximos_dias_uteis(n: int, hora: int = 9) -> list[datetime]:
    tz = ZoneInfo("Europe/Lisbon")
    hoje = datetime.now(tz).date()
    dias: list[datetime] = []
    candidato = hoje + timedelta(days=1)
    while len(dias) < n:
        if candidato.weekday() < 5:
            dt = datetime(
                candidato.year,
                candidato.month,
                candidato.day,
                hora,
                0,
                0,
                tzinfo=tz,
            )
            dias.append(dt)
        candidato += timedelta(days=1)
    return dias


def load_posts_file() -> dict:
    with open(POSTS_FILE, encoding="utf-8") as f:
        return json.load(f)


def load_posts() -> list[dict]:
    return load_posts_file()["posts"]


def save_posts_file(data: dict) -> None:
    POSTS_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(POSTS_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
        f.write("\n")


def post_is_scheduled(post: dict) -> bool:
    return bool(post.get("agendado"))


def channel_already_scheduled(post: dict, channel: str) -> bool:
    return bool((post.get("buffer_ids") or {}).get(channel))


def mark_channel_scheduled(post: dict, channel: str, post_id: str) -> None:
    buffer_ids = post.setdefault("buffer_ids", {})
    buffer_ids[channel] = post_id
    if buffer_ids.get("instagram") and buffer_ids.get("facebook"):
        post["agendado"] = True


def format_scheduled_ids(post: dict) -> str:
    buffer_ids = post.get("buffer_ids") or {}
    ig = buffer_ids.get("instagram", "?")
    fb = buffer_ids.get("facebook", "?")
    return f"Instagram: {ig}, Facebook: {fb}"


_model_image_urls: dict[str, str] | None = None


def load_model_image_urls() -> dict[str, str]:
    global _model_image_urls
    if _model_image_urls is not None:
        return _model_image_urls

    if not ALL_PRODUCTS_FILE.exists():
        _model_image_urls = {}
        return _model_image_urls

    with open(ALL_PRODUCTS_FILE, encoding="utf-8") as f:
        data = json.load(f)

    by_model: dict[str, str] = {}
    for product in data.get("products", []):
        if not product.get("is_available"):
            continue
        model = (product.get("model") or "").strip()
        image_url = (product.get("image_url") or "").strip()
        if model and image_url:
            by_model.setdefault(model, image_url)

    _model_image_urls = by_model
    return _model_image_urls


def resolve_image_url(post: dict) -> str:
    """URL pública para assets.image — requerida no Instagram (ver docs Buffer)."""
    direct_image = (post.get("image_url") or "").strip()
    if direct_image:
        if image_url_is_accessible(direct_image):
            return build_proxy_image_url(direct_image)
        return build_proxy_image_url(direct_image)

    modelo = (post.get("modelo") or "").strip()
    if not modelo:
        return DEFAULT_IMAGE_URL

    candidates: list[str] = []
    by_model = load_model_image_urls()
    if modelo in by_model:
        candidates.append(by_model[modelo])

    modelo_lower = modelo.lower()
    for model, image_url in by_model.items():
        model_lower = model.lower()
        if model_lower == modelo_lower or model_lower in modelo_lower or modelo_lower in model_lower:
            if image_url not in candidates:
                candidates.append(image_url)

    candidates.append(DEFAULT_IMAGE_URL)

    for image_url in candidates:
        if image_url_is_accessible(image_url):
            return build_proxy_image_url(image_url)

    return DEFAULT_IMAGE_URL


def image_url_is_accessible(image_url: str) -> bool:
    try:
        response = httpx.head(image_url, timeout=10, follow_redirects=True)
        if response.status_code == 405:
            response = httpx.get(image_url, timeout=10, follow_redirects=True)
        return response.status_code == 200
    except httpx.HTTPError:
        return False


def build_create_post_input(
    texto: str,
    channel_id: str,
    scheduled_at: datetime,
    *,
    channel: str,
    post: dict,
) -> dict:
    image_url = resolve_image_url(post)
    input_data: dict = {
        "text": texto,
        "channelId": channel_id,
        "schedulingType": "automatic",
        "mode": "customScheduled",
        "dueAt": format_due_at(scheduled_at),
    }

    if channel == "instagram":
        input_data["assets"] = [{"image": {"url": image_url}}]
        input_data["metadata"] = {
            "instagram": {
                "type": "post",
                "shouldShareToFeed": True,
            },
        }
    elif channel == "facebook":
        input_data["metadata"] = {
            "facebook": {
                "type": "post",
            },
        }
        input_data["assets"] = [{"image": {"url": image_url}}]

    return input_data


def enviar_post(
    texto: str,
    channel_id: str,
    scheduled_at: datetime,
    *,
    channel: str,
    post: dict,
) -> dict:
    variables = {
        "input": build_create_post_input(
            texto,
            channel_id,
            scheduled_at,
            channel=channel,
            post=post,
        )
    }
    response = httpx.post(
        BUFFER_API,
        headers={
            "Authorization": f"Bearer {BUFFER_TOKEN}",
            "Content-Type": "application/json",
        },
        json={"query": CREATE_POST_MUTATION, "variables": variables},
        timeout=30,
    )
    response.raise_for_status()
    resultado = response.json()
    resultado["parsed"] = parse_create_post_response(resultado)
    return resultado


def post_label(post: dict) -> str:
    for key in ("titulo_artigo", "modelo", "titulo", "topico", "nome"):
        value = (post.get(key) or "").strip()
        if not value:
            continue
        if key == "modelo":
            storage = (post.get("storage") or "").strip()
            if storage:
                return f"{value} {storage}"
        return value
    return "Post"


def mutation_failed(resultado: dict) -> bool:
    parsed = resultado.get("parsed") or parse_create_post_response(resultado)
    return not parsed.get("success")


def extract_post_id(resultado: dict) -> str:
    parsed = resultado.get("parsed") or parse_create_post_response(resultado)
    return parsed.get("post_id", "?")


def main() -> None:
    missing = [
        name
        for name, value in (
            ("BUFFER_ACCESS_TOKEN", BUFFER_TOKEN),
            ("BUFFER_INSTAGRAM_CHANNEL_ID", INSTAGRAM_ID),
            ("BUFFER_FACEBOOK_CHANNEL_ID", FACEBOOK_ID),
        )
        if not value
    ]
    if missing:
        print(f"Erro: variáveis em falta no .env: {', '.join(missing)}", file=sys.stderr)
        sys.exit(1)

    if not POSTS_FILE.exists():
        print(f"Erro: ficheiro não encontrado: {POSTS_FILE}", file=sys.stderr)
        sys.exit(1)

    posts_data = load_posts_file()
    posts = posts_data["posts"]
    datas = proximos_dias_uteis(len(posts))
    total = len(posts)
    agendados = 0
    saltados = 0

    print("goRiCycle Publisher")
    print("─────────────────────────")
    print(f"Posts a agendar: {total}")
    print("Canais: Instagram + Facebook")
    print("Horário: 09h00 (Lisboa)")

    for i, (post, data_pub) in enumerate(zip(posts, datas), 1):
        texto = post["post"]
        dia_semana = data_pub.strftime("%A %d/%m")

        if post_is_scheduled(post):
            saltados += 1
            print(
                f"\n[{i}/{total}] SALTADO — já agendado anteriormente "
                f"(ID: {format_scheduled_ids(post)})"
            )
            continue

        print(f"\n[{i}/{total}] {post_label(post)} — {dia_semana}")

        if not channel_already_scheduled(post, "instagram"):
            resultado_ig = enviar_post(
                texto, INSTAGRAM_ID, data_pub, channel="instagram", post=post
            )
            if mutation_failed(resultado_ig):
                print(f"  ❌ Instagram: {resultado_ig}")
            else:
                post_id = extract_post_id(resultado_ig)
                mark_channel_scheduled(post, "instagram", post_id)
                save_posts_file(posts_data)
                print(f"  ✅ Instagram agendado — ID: {post_id}")
                agendados += 1
        else:
            post_id = post["buffer_ids"]["instagram"]
            print(f"  ⏭ Instagram já agendado — ID: {post_id}")

        if not channel_already_scheduled(post, "facebook"):
            resultado_fb = enviar_post(
                texto, FACEBOOK_ID, data_pub, channel="facebook", post=post
            )
            if mutation_failed(resultado_fb):
                print(f"  ❌ Facebook: {resultado_fb}")
            else:
                post_id = extract_post_id(resultado_fb)
                mark_channel_scheduled(post, "facebook", post_id)
                save_posts_file(posts_data)
                print(f"  ✅ Facebook agendado — ID: {post_id}")
                agendados += 1
        else:
            post_id = post["buffer_ids"]["facebook"]
            print(f"  ⏭ Facebook já agendado — ID: {post_id}")

    print()
    print("─────────────────────────")
    print(
        f"Concluído. {agendados} posts agendados no Buffer "
        f"({total} Instagram + {total} Facebook)."
    )
    if saltados:
        print(f"Saltados (já agendados): {saltados}")
    print("Verifica em: https://publish.buffer.com")


if __name__ == "__main__":
    main()
