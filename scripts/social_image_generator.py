#!/usr/bin/env python3
"""
goRiCycle — Geração de imagens de marca para posts sociais (1080×1080).

Renderiza templates HTML/CSS via Playwright e grava PNG em web/public/social-posts/.
"""

from __future__ import annotations

import hashlib
import html
import logging
import time
from pathlib import Path
from urllib.parse import quote

import httpx
from playwright.sync_api import sync_playwright

logger = logging.getLogger(__name__)

ROOT = Path(__file__).resolve().parent.parent
SOCIAL_POSTS_DIR = ROOT / "web" / "public" / "social-posts"

SITE_URL = "https://goricycle.com"
SITE_DOMAIN = "goricycle.com"
LOGO_URL = f"{SITE_URL}/images/goricycle-logo.png"
LOGO_URL_LIGHT = "https://goricycle.com/images/goricycle-logo-light.png"

BRAND_DARK = "#064e3b"
BRAND_DEEP = "#022c22"
BRAND_LIGHT = "#d4eee5"
BRAND_MUTED = "#edf7f3"
ACCENT_GOLD = "#fbbf24"
TEXT_WHITE = "#ffffff"
TEXT_MUTED = "#cbd5e1"
PRODUCT_CARD_BG = "#F5F5F0"


def build_proxy_image_url(image_url: str) -> str:
    return f"{SITE_URL}/api/product-image?url={quote(image_url, safe='')}"


def format_price_display(price: float) -> str:
    if price == int(price):
        return f"{int(price)}€"
    text = f"{price:.2f}".rstrip("0").rstrip(".")
    return f"{text.replace('.', ',')}€"


def format_delta_display(delta: float) -> str:
    return f"{round(delta)}€"


def _esc(text: str) -> str:
    return html.escape(text or "", quote=True)


def _base_styles() -> str:
    return f"""
    * {{ box-sizing: border-box; margin: 0; padding: 0; }}
    body {{
      width: 1080px; height: 1080px; overflow: hidden;
      font-family: 'Inter', system-ui, -apple-system, sans-serif;
      background: linear-gradient(160deg, {BRAND_DARK} 0%, {BRAND_DEEP} 100%);
      color: {TEXT_WHITE};
    }}
    .canvas {{
      width: 1080px; height: 1080px;
      display: flex; flex-direction: column;
      padding: 48px 56px 40px;
    }}
    .logo {{
      height: 52px; width: auto; object-fit: contain; object-position: left;
    }}
    .footer {{
      margin-top: auto;
      text-align: center;
      font-size: 26px;
      font-weight: 500;
      letter-spacing: 0.02em;
      color: {BRAND_LIGHT};
      opacity: 0.92;
    }}
    """


def _product_image_block(
    image_url: str,
    *,
    large: bool = False,
    is_fallback: bool | None = None,
) -> str:
    height = 360 if large else 300
    img_max = 250 if large else 210
    if is_fallback is None:
        is_fallback = image_url == LOGO_URL

    if is_fallback:
        fallback_img_max = 200 if large else 170
        logo_src = f"{_esc(LOGO_URL_LIGHT)}?v={int(time.time())}"
        return f"""
    <div class="product-fallback-wrap">
      <img
        class="product-img product-img-fallback-logo"
        src="{logo_src}"
        alt=""
        decoding="async"
        loading="eager"
      />
    </div>
    <style>
      .product-fallback-wrap {{
        display: flex; align-items: center; justify-content: center;
        width: 100%;
        align-self: center;
        height: {height}px; margin: 16px 0 20px;
      }}
      .product-img-fallback-logo {{
        display: block;
        margin: 0 auto;
        max-height: {fallback_img_max}px;
        max-width: 85%;
        object-fit: contain;
        object-position: center;
        opacity: 0.95;
      }}
    </style>
    """

    return f"""
    <div class="product-wrap">
      <div class="product-card">
        <img
          class="product-img"
          src="{_esc(image_url)}"
          alt=""
          decoding="async"
          loading="eager"
          onerror="this.onerror=null;this.src='{_esc(LOGO_URL)}';this.classList.add('fallback');"
        />
      </div>
    </div>
    <style>
      .product-wrap {{
        display: flex; align-items: center; justify-content: center;
        height: {height}px; margin: 16px 0 20px;
      }}
      .product-card {{
        display: flex; align-items: center; justify-content: center;
        max-width: 90%;
        max-height: 100%;
        padding: 20px 32px;
        border-radius: 22px;
        background: {PRODUCT_CARD_BG};
        box-shadow:
          0 14px 36px rgba(0, 0, 0, 0.22),
          0 2px 8px rgba(0, 0, 0, 0.08);
        overflow: hidden;
      }}
      .product-img {{
        display: block;
        max-height: {img_max}px;
        max-width: 100%;
        object-fit: contain;
      }}
      .product-img.fallback {{
        max-height: 96px;
        opacity: 0.72;
      }}
    </style>
    """


def build_template_a(
    produto_modelo: str,
    loja_a_nome: str,
    loja_a_preco: float,
    loja_b_nome: str,
    loja_b_preco: float,
    imagem_produto_url: str,
    storage: str = "",
    is_fallback_image: bool = False,
) -> str:
    if loja_a_preco > loja_b_preco:
        loja_a_nome, loja_b_nome = loja_b_nome, loja_a_nome
        loja_a_preco, loja_b_preco = loja_b_preco, loja_a_preco
    delta = abs(loja_b_preco - loja_a_preco)
    titulo = produto_modelo.strip()
    if storage:
        titulo = f"{titulo} {storage.strip()}"

    corner_logo_html = ""
    if not is_fallback_image:
        corner_logo_html = (
            f'  <img class="logo" src="{_esc(LOGO_URL_LIGHT)}?v={int(time.time())}" alt="goRiCycle"/>\n'
        )

    return f"""<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8"/>
<style>
{_base_styles()}
.headline {{
  margin-top: 28px;
  font-size: 44px; font-weight: 800; line-height: 1.15;
  text-align: center; letter-spacing: -0.02em;
}}
.compare-row {{
  display: flex; gap: 24px; justify-content: center; margin-top: 8px;
}}
.store-box {{
  flex: 1; max-width: 420px;
  background: rgba(255,255,255,0.08);
  border: 2px solid rgba(255,255,255,0.14);
  border-radius: 20px;
  padding: 28px 24px;
  text-align: center;
}}
.store-box.cheapest {{
  border-color: {BRAND_LIGHT};
  background: rgba(212, 238, 229, 0.12);
}}
.store-name {{
  font-size: 28px; font-weight: 600; color: {BRAND_LIGHT};
  margin-bottom: 12px;
}}
.store-price {{
  font-size: 52px; font-weight: 800; letter-spacing: -0.03em;
}}
.badge {{
  align-self: center;
  margin-top: 28px;
  background: {ACCENT_GOLD};
  color: {BRAND_DEEP};
  font-size: 30px; font-weight: 800;
  padding: 16px 36px;
  border-radius: 999px;
  box-shadow: 0 8px 24px rgba(251, 191, 36, 0.35);
}}
</style>
</head>
<body>
<div class="canvas">
{corner_logo_html}  {_product_image_block(imagem_produto_url, is_fallback=is_fallback_image)}
  <h1 class="headline">{_esc(titulo)}</h1>
  <div class="compare-row">
    <div class="store-box cheapest">
      <div class="store-name">{_esc(loja_a_nome)}</div>
      <div class="store-price">{_esc(format_price_display(loja_a_preco))}</div>
    </div>
    <div class="store-box">
      <div class="store-name">{_esc(loja_b_nome)}</div>
      <div class="store-price">{_esc(format_price_display(loja_b_preco))}</div>
    </div>
  </div>
  <div class="badge">Diferença de {format_delta_display(delta)} entre lojas</div>
  <div class="footer">Compara no {SITE_DOMAIN}</div>
</div>
</body>
</html>"""


def build_template_b(
    produto_modelo: str,
    loja_nome: str,
    preco: float,
    estado_garantia: str | None,
    imagem_produto_url: str,
    storage: str = "",
    is_fallback_image: bool = False,
) -> str:
    titulo = produto_modelo.strip()
    if storage:
        titulo = f"{titulo} {storage.strip()}"
    badge_html = ""
    if estado_garantia:
        badge_html = f'<div class="warranty">{_esc(estado_garantia)}</div>'

    corner_logo_html = ""
    if not is_fallback_image:
        corner_logo_html = (
            f'  <img class="logo" src="{_esc(LOGO_URL_LIGHT)}?v={int(time.time())}" alt="goRiCycle"/>\n'
        )

    return f"""<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8"/>
<style>
{_base_styles()}
.headline {{
  margin-top: 12px;
  font-size: 46px; font-weight: 800; line-height: 1.12;
  text-align: center; letter-spacing: -0.02em;
}}
.price-block {{
  text-align: center; margin-top: 28px;
}}
.price {{
  font-size: 96px; font-weight: 800; letter-spacing: -0.04em;
  line-height: 1;
  color: {TEXT_WHITE};
}}
.store {{
  margin-top: 20px;
  font-size: 34px; font-weight: 600; color: {BRAND_LIGHT};
}}
.warranty {{
  display: inline-block;
  margin-top: 24px;
  background: rgba(255,255,255,0.12);
  border: 2px solid rgba(255,255,255,0.2);
  border-radius: 999px;
  padding: 12px 32px;
  font-size: 26px; font-weight: 600;
}}
</style>
</head>
<body>
<div class="canvas">
{corner_logo_html}  {_product_image_block(imagem_produto_url, large=True, is_fallback=is_fallback_image)}
  <h1 class="headline">{_esc(titulo)}</h1>
  <div class="price-block">
    <div class="price">{_esc(format_price_display(preco))}</div>
    <div class="store">{_esc(loja_nome)}</div>
    {badge_html}
  </div>
  <div class="footer">Compara no {SITE_DOMAIN}</div>
</div>
</body>
</html>"""


def build_template_c(
    titulo_artigo: str,
    resumo_curto: str | None,
    imagem_fundo_url: str | None,
) -> str:
    resumo_block = ""
    if resumo_curto:
        resumo_block = f'<p class="summary">{_esc(resumo_curto)}</p>'

    if imagem_fundo_url:
        bg_style = f"""
        body {{
          background:
            linear-gradient(160deg, rgba(2,44,34,0.88) 0%, rgba(6,78,59,0.82) 100%),
            url('{_esc(imagem_fundo_url)}') center/cover no-repeat;
        }}
        """
    else:
        bg_style = f"""
        body {{
          background: linear-gradient(160deg, {BRAND_DARK} 0%, {BRAND_DEEP} 100%);
        }}
        """

    logo_src = f"{_esc(LOGO_URL_LIGHT)}?v={int(time.time())}"
    title_len = len(titulo_artigo.strip())
    title_font_size = 52 if title_len > 70 else 58
    header_logo_html = f"""
  <div class="editorial-logo-wrap">
    <img
      class="editorial-logo"
      src="{logo_src}"
      alt="goRiCycle"
      decoding="async"
      loading="eager"
    />
  </div>"""

    return f"""<!DOCTYPE html>
<html lang="pt">
<head>
<meta charset="utf-8"/>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;600;700;800&display=swap" rel="stylesheet"/>
<style>
{_base_styles()}
{bg_style}
.canvas {{
  justify-content: center;
  padding-top: 40px; padding-bottom: 56px;
}}
.editorial-logo-wrap {{
  display: flex; align-items: center; justify-content: center;
  width: 100%;
  align-self: center;
  margin-top: 0;
  margin-bottom: 8px;
}}
.editorial-logo {{
  display: block;
  margin: 0 auto;
  max-height: 140px;
  max-width: 85%;
  object-fit: contain;
  object-position: center;
  opacity: 0.95;
}}
.title {{
  font-size: {title_font_size}px; font-weight: 800; line-height: 1.12;
  letter-spacing: -0.03em;
  text-align: center;
  max-width: 920px;
  margin: 48px auto 0;
}}
.summary {{
  margin-top: 36px;
  font-size: 32px; font-weight: 500; line-height: 1.45;
  text-align: center;
  color: {TEXT_MUTED};
  max-width: 860px;
  margin-left: auto; margin-right: auto;
}}
.footer {{ margin-top: 64px; }}
</style>
</head>
<body>
<div class="canvas">
{header_logo_html}
  <h1 class="title">{_esc(titulo_artigo)}</h1>
  {resumo_block}
  <div class="footer">Lê o artigo completo no {SITE_DOMAIN}</div>
</div>
</body>
</html>"""


def render_post_image(
    html_content: str,
    output_path: str,
    width: int = 1080,
    height: int = 1080,
) -> None:
    Path(output_path).parent.mkdir(parents=True, exist_ok=True)
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        page = browser.new_page(
            viewport={"width": width, "height": height},
            device_scale_factor=1,
        )
        page.set_content(html_content, wait_until="domcontentloaded")
        try:
            page.wait_for_function(
                "() => Array.from(document.images).every(img => img.complete && img.naturalWidth > 0)",
                timeout=10000,
            )
        except Exception as exc:
            incomplete = page.evaluate(
                "() => Array.from(document.images).filter(img => !img.complete || img.naturalWidth === 0).map(img => ({src: img.src, complete: img.complete, naturalWidth: img.naturalWidth}))"
            )
            print(f"AVISO: imagens não carregadas: {incomplete}")
            logger.warning("Imagens não carregadas antes do screenshot: %s", incomplete)
        all_images_status = page.evaluate(
            "() => Array.from(document.images).map(img => ({src: img.src, complete: img.complete, naturalWidth: img.naturalWidth}))"
        )
        print(f"DEBUG: estado de todas as imagens: {all_images_status}")
        page.screenshot(path=output_path, type="png")
        browser.close()


def image_url_is_accessible(image_url: str) -> bool:
    if not image_url or image_url.startswith("/"):
        return False
    try:
        response = httpx.head(image_url, timeout=10, follow_redirects=True)
        if response.status_code == 405:
            response = httpx.get(image_url, timeout=10, follow_redirects=True)
        return response.status_code == 200
    except httpx.HTTPError:
        return False


def resolve_template_image_url(product_image_url: str | None) -> str:
    if product_image_url and product_image_url.strip():
        proxied = build_proxy_image_url(product_image_url.strip())
        if image_url_is_accessible(proxied):
            return proxied
    return LOGO_URL


def extract_editorial_summary(post_text: str) -> str | None:
    lines = [line.strip() for line in post_text.splitlines() if line.strip()]
    if len(lines) < 2:
        return None
    body_lines = [
        line
        for line in lines
        if not line.startswith("#")
        and "→" not in line
        and "goricycle.com" not in line.lower()
    ]
    if len(body_lines) >= 2:
        return body_lines[1][:140]
    if body_lines:
        return body_lines[0][:140]
    return None


def make_post_id(post: dict, week_number: int) -> str:
    parts = [
        post.get("tipo", ""),
        post.get("modelo") or post.get("titulo_artigo") or "",
        post.get("storage") or "",
        str(week_number),
        str(post.get("dia", "")),
    ]
    digest = hashlib.sha256("|".join(parts).encode("utf-8")).hexdigest()[:12]
    return digest


def build_html_for_post(post: dict, product_image_url: str | None) -> str:
    template_image = resolve_template_image_url(product_image_url)
    is_fallback_image = template_image == LOGO_URL

    if post["tipo"] == "comparacao":
        lojas = post.get("lojas") or ["", ""]
        precos = post.get("precos") or [0, 0]
        return build_template_a(
            produto_modelo=post.get("modelo") or "",
            loja_a_nome=lojas[0],
            loja_a_preco=float(precos[0]),
            loja_b_nome=lojas[1],
            loja_b_preco=float(precos[1]),
            imagem_produto_url=template_image,
            storage=post.get("storage") or "",
            is_fallback_image=is_fallback_image,
        )

    if post["tipo"] == "destaque":
        garantia = post.get("garantia_meses") or 0
        estado = f"Garantia {garantia} meses" if garantia else None
        return build_template_b(
            produto_modelo=post.get("modelo") or "",
            loja_nome=post.get("loja") or "",
            preco=float(post.get("preco") or 0),
            estado_garantia=estado,
            imagem_produto_url=template_image,
            storage=post.get("storage") or "",
            is_fallback_image=is_fallback_image,
        )

    if post["tipo"] == "editorial":
        bg_url = None
        if product_image_url and product_image_url.strip():
            proxied = build_proxy_image_url(product_image_url.strip())
            if image_url_is_accessible(proxied):
                bg_url = proxied
        return build_template_c(
            titulo_artigo=post.get("titulo_artigo") or "",
            resumo_curto=extract_editorial_summary(post.get("post") or ""),
            imagem_fundo_url=bg_url,
        )

    raise ValueError(f"Tipo de post desconhecido: {post.get('tipo')}")


def generate_and_save_post_image(
    post: dict,
    *,
    product_image_url: str | None,
    week_number: int,
) -> dict:
    post_id = make_post_id(post, week_number)
    output_path = SOCIAL_POSTS_DIR / f"{post_id}.png"
    html_content = build_html_for_post(post, product_image_url)
    render_post_image(html_content, str(output_path))
    post["post_id"] = post_id
    post["image_url"] = f"/social-posts/{post_id}.png"
    return post
