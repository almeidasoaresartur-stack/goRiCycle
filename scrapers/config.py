"""
Configuração central dos scrapers riCycle.

Todos os seletores CSS e constantes vivem aqui.
Os scrapers importam deste módulo — não dupliquem valores nos ficheiros individuais.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

load_dotenv()

PROJECT_ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = PROJECT_ROOT / "data"

# Placeholder para IDs de afiliado — substituir pelos valores reais em produção
AFFILIATE_PLACEHOLDER = "PLACEHOLDER"

# Chaves de categoria (nem todas as fontes têm todas)
CATEGORY_KEYS: tuple[str, ...] = (
    "iphones",
    "ipads",
    "macs",
    "apple_watch",
    "tablets",
    "laptops",
    "samsung_phones",
    "google_phones",
    "huawei_phones",
    "xiaomi_phones",
    "oneplus_phones",
)

# Atributos de imagem por ordem de prioridade (lazy-load)
IMAGE_SRC_ATTRIBUTES: tuple[str, ...] = ("src", "data-src", "data-lazy-src", "data-original")

# Padrões de extração de texto
STORAGE_REGEX = r"(\d+)\s*GB"

GRADE_KEYWORDS: tuple[tuple[str, str], ...] = (
    ("Excelente", "Excelente"),
    ("Muito Bom", "Muito Bom"),
    ("Muito bom", "Muito Bom"),
    ("Bom", "Bom"),
)

SWAPPIE_GRADE_KEYWORDS: tuple[tuple[str, str], ...] = (
    ("Premium", "Premium"),
    ("Excelente", "Excelente"),
    ("Muito Bom", "Muito Bom"),
    ("Muito bom", "Muito Bom"),
    ("Satisfatório", "Bom"),
    ("Satisfatorio", "Bom"),
    ("Bom", "Bom"),
)

REFURBED_GRADE_KEYWORDS: tuple[tuple[str, str], ...] = (
    ("Premium", "Premium"),
    ("Excelente", "Excelente"),
    ("Muito bom", "Muito Bom"),
    ("Muito Bom", "Muito Bom"),
    ("Bom", "Bom"),
    ("Grade A", "Grade A"),
    ("Grade B", "Grade B"),
    ("Grade C", "Grade C"),
)

# -----------------------------------------------------------------------------
# iServices
# -----------------------------------------------------------------------------

ISERVICES_CONFIG: dict[str, Any] = {
    "source": "iservices",
    "base_url": "https://iservices.pt",
    "shop_url": "https://loja.iservices.pt",
    "currency": "EUR",
    "warranty_months": 36,
    "headless": os.getenv("ISERVICES_HEADLESS", "true").lower() != "false",
    "user_agent": os.getenv(
        "ISERVICES_USER_AGENT",
        (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
    ),
    "output_json": DATA_DIR / "iservices_produtos.json",
    "log_file": DATA_DIR / "iservices_scraper.log",
    "affiliate": {
        "enabled": False,
        "network": "direct",
        "base_tag": AFFILIATE_PLACEHOLDER,
        "url_template": "{product_url}",
        "commission_pct": None,
        "avg_basket_eur": None,
    },
    # URLs reais descobertos em iservices.pt/produtos (Maio 2026).
    # None = categoria inexistente nesta fonte (scraper ignora).
    "categories": {
        "iphones": f"{os.getenv('ISERVICES_SHOP_URL', 'https://loja.iservices.pt')}/iphones-recondicionados-90?lang=pt",
        "ipads": f"{os.getenv('ISERVICES_SHOP_URL', 'https://loja.iservices.pt')}/ipads-recondicionados-99?lang=pt",
        # MacBooks recondicionados (Macs portáteis Apple)
        "macs": f"{os.getenv('ISERVICES_SHOP_URL', 'https://loja.iservices.pt')}/macbooks-recondicionados-92?lang=pt",
        "apple_watch": f"{os.getenv('ISERVICES_SHOP_URL', 'https://loja.iservices.pt')}/apple-watch-recondicionados-116?lang=pt",
        # iServices não tem categorias dedicadas a tablets/laptops não-Apple
        "tablets": None,
        "laptops": None,
        "samsung_phones": None,
    },
    "delays": {
        "between_products": (0.5, 1.5),
        "between_pages": (1.0, 2.5),
        "after_navigation": (1.0, 2.5),
        "between_variants": (0.3, 0.6),
        "after_variant_select": (0.8, 1.2),
        "after_cookie_dismiss": (0.4, 0.8),
        "page_load": 0,
    },
    "selectors": {
        # --- Listagem (iservices.pt/produtos/…) ---
        # Grelha com todos os cartões da categoria
        "listing_grid": ".products-list",
        # Cartão clicável (<a class="product-box">)
        "product_card": "a.product-box",
        # Nome do modelo (<p class="product-box-info-title">)
        "product_name": ".product-box-info-title",
        # Preço no cartão (<p class="product-box-info-price">)
        "product_price": ".product-box-info-price",
        # Imagem (<img class="image">; lazy: data-src)
        "product_image": "img.image",
        # Paginação PrestaShop — ausente na listagem actual (single page)
        "pagination_next": ".next a",
        # --- Cookies Klaro ---
        "cookie_accept": "#klaro .cm-btn-success",
        "cookie_accept_alt": "#klaro button.cm-btn-success",
        "cookie_accept_all": ".cm-btn-accept-all",
        # --- Ficha de produto (loja.iservices.pt — PrestaShop) ---
        "detail_title": "h1.page-title, h1",
        "detail_price": ".current-price, .product-price",
        "detail_image": ".product-cover img, img.js-qv-product-cover",
        "detail_og_image": "meta[property='og:image']",
        "detail_variants": ".product-variants",
        "detail_variant_group": ".product-variants-item",
        "detail_variant_radio": "input.input-radio",
        "detail_variant_label": ".radio-label",
    },
}

# Aliases retrocompatíveis
ISERVICES_BASE_URL = ISERVICES_CONFIG["base_url"]
ISERVICES_SHOP_URL = ISERVICES_CONFIG["shop_url"]
ISERVICES_LISTING_URL = ISERVICES_CONFIG["categories"]["iphones"]
ISERVICES_USER_AGENT = ISERVICES_CONFIG["user_agent"]
ISERVICES_HEADLESS = ISERVICES_CONFIG["headless"]
ISERVICES_WARRANTY_MONTHS = ISERVICES_CONFIG["warranty_months"]
ISERVICES_CURRENCY = ISERVICES_CONFIG["currency"]
ISERVICES_SOURCE = ISERVICES_CONFIG["source"]
ISERVICES_OUTPUT_JSON = ISERVICES_CONFIG["output_json"]
ISERVICES_LOG_FILE = ISERVICES_CONFIG["log_file"]
ISERVICES_DELAYS = ISERVICES_CONFIG["delays"]
ISERVICES_SELECTORS = ISERVICES_CONFIG["selectors"]

# -----------------------------------------------------------------------------
# Refurbed
# -----------------------------------------------------------------------------

REFURBED_CONFIG: dict[str, Any] = {
    "source": "refurbed",
    "base_url": "https://www.refurbed.pt",
    "currency": "EUR",
    "warranty_months": 24,
    "headless": os.getenv("REFURBED_HEADLESS", "true").lower() != "false",
    "user_agent": os.getenv(
        "REFURBED_USER_AGENT",
        (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
    ),
    "output_json": DATA_DIR / "refurbed_produtos.json",
    "log_file": DATA_DIR / "refurbed_scraper.log",
    "affiliate": {
        "enabled": True,
        "network": "brandreward",
        "base_tag": AFFILIATE_PLACEHOLDER,
        "url_template": "{product_url}?tag={base_tag}",
        "commission_pct": 7.0,
        "avg_basket_eur": 370,
    },
    "categories": {
        "iphones": "https://www.refurbed.pt/c/iphones/",
        "ipads": "https://www.refurbed.pt/c/ipads/",
        "macs": "https://www.refurbed.pt/c/macbooks/",
        # Apple Watch via filtro de marca na categoria smartwatches
        "apple_watch": "https://www.refurbed.pt/c/smartwatches/?brand=Apple",
        "tablets": "https://www.refurbed.pt/c/tablets/",
        "laptops": "https://www.refurbed.pt/c/computadores-portateis/",
        "samsung_phones": "https://www.refurbed.pt/c/smartphones/?brand=Samsung",
        "google_phones": "https://www.refurbed.pt/c/smartphones/?brand=Google",
        "huawei_phones": "https://www.refurbed.pt/c/smartphones/?brand=Huawei",
        "xiaomi_phones": "https://www.refurbed.pt/c/smartphones/?brand=Xiaomi",
        "oneplus_phones": "https://www.refurbed.pt/c/smartphones/?brand=OnePlus",
    },
    # Filtra cartões pela marca detectada no título (Refurbed ignora ?brand= em SPA)
    "category_brand_filters": {
        "iphones": ("Apple",),
        "ipads": ("Apple",),
        "macs": ("Apple",),
        "apple_watch": ("Apple",),
        "samsung_phones": ("Samsung",),
        "google_phones": ("Google",),
        "huawei_phones": ("Huawei",),
        "xiaomi_phones": ("Xiaomi",),
        "oneplus_phones": ("OnePlus",),
    },
    "replace_on_scrape_categories": (
        "samsung_phones",
        "google_phones",
        "huawei_phones",
        "xiaomi_phones",
        "oneplus_phones",
    ),
    "max_pages": 100,
    "delays": {
        "between_products": (1.0, 2.5),
        "between_pages": (3.0, 6.0),
        "after_navigation": (2.0, 4.0),
        "after_cookie_dismiss": (0.5, 1.0),
        "page_load": 4000,
    },
    "selectors": {
        # --- Listagem ---
        # Contentor da grelha de produtos
        "listing_grid": ".product-list-container",
        # Cada cartão é um <article> com link data-test
        "product_card": ".product-list-container article",
        # Link principal do cartão
        "product_link": "[data-test='productcard-link']",
        # Nome do modelo (<h3> dentro do article)
        "product_name": "h3",
        # Preço mais baixo visível na listagem
        "product_price": "[data-test='product-price']",
        # Imagem (<picture><img>)
        "product_image": "picture img, img",
        # Avaliação do produto (estrelas Trustpilot na listagem)
        "seller_rating": "[role='img'][aria-label*='rating'], span[aria-hidden='true'] + span.text-content-01",
        "seller_rating_aria": "[aria-label*='Product rating']",
        # Load-more — botão "Mais" que acrescenta produtos à mesma página (SPA)
        "load_more_button": "[data-test='load-more-button']",
        # Paginação clássica (fallback) — href /c/iphones/2/
        "pagination_next": "[data-test='load-more-button'], div.flex.justify-center.mt-6 a:has-text('Mais')",
        # --- Cookies / popups ---
        "cookie_accept": "#onetrust-accept-btn-handler, #cookiebanner button:has-text('Aceitar'), #cookiebanner button:has-text('Accept')",
        "cookie_accept_alt": "button:has-text('Aceitar todos')",
        "newsletter_close": "[data-test='newsletter-popup-close'], button[aria-label='Fechar']",
        # --- Ficha de produto ---
        "detail_title": "h1",
        "detail_price": "[data-test='product-price']",
        "detail_image": "picture img, [data-test='product-image'] img",
        "detail_og_image": "meta[property='og:image']",
        # Variantes sugeridas (storage × grade × cor × preço mínimo)
        "detail_variant_item": "li[data-test^='recommended-product-']",
        "detail_variant_storage": "[data-test='recommended-product-storage']",
        "detail_variant_grade": "[data-test='recommended-product-grade']",
        "detail_variant_price": "[data-test='recommended-product-price']",
        "detail_variant_color": "[data-test='recommended-product-color']",
        "detail_original_price": "[data-test='price-srp'], del",
    },
}

# -----------------------------------------------------------------------------
# Back Market
# -----------------------------------------------------------------------------

BACK_MARKET_CONFIG: dict[str, Any] = {
    "source": "backmarket",
    "base_url": "https://www.backmarket.pt",
    "homepage_url": "https://www.backmarket.pt/pt-pt",
    "base_url_com": "https://www.backmarket.com/pt-pt",
    "currency": "EUR",
    "warranty_months": 12,
    "headless": os.getenv("BACKMARKET_HEADLESS", "true").lower() != "false",
    "slow_mo": int(os.getenv("BACKMARKET_SLOW_MO", "0")),
    "post_goto_wait_ms": 5000,
    "http_headers": {
        "Accept-Language": "pt-PT",
        "Accept-Encoding": "gzip, deflate, br",
        "Referer": "https://www.google.pt",
    },
    "user_agent": os.getenv(
        "BACKMARKET_USER_AGENT",
        (
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
    ),
    "output_json": DATA_DIR / "backmarket_produtos.json",
    "log_file": DATA_DIR / "backmarket_scraper.log",
    "storage_state_path": DATA_DIR / "backmarket_storage_state.json",
    "cookies_json_path": DATA_DIR / "backmarket_cookies.json",
    "probe_log_path": DATA_DIR / "backmarket_probe.log",
    "probe_results_path": DATA_DIR / "backmarket_probe_results.json",
    "browser_profile_dir": DATA_DIR / "backmarket_browser_profile",
    # Padrões de URL a capturar durante o probe (respostas XHR/fetch)
    "api_url_patterns": (
        r"/api/",
        r"/fo/",
        r"/ws/",
        r"catalog",
        r"search",
        r"listing",
        r"product",
    ),
    "affiliate": {
        "enabled": True,
        "network": "awin",
        "base_tag": AFFILIATE_PLACEHOLDER,
        "url_template": "{product_url}?awc={base_tag}",
        "commission_pct": 5.0,
        "avg_basket_eur": 300,
    },
    "categories": {
        # PT usa /l/{slug}/{uuid} — URLs /c/... devolvem 404
        "iphones": "https://www.backmarket.pt/pt-pt/l/iphone/aabc736a-cb66-4ac0-a3b7-0f449781ed39",
        "ipads": "https://www.backmarket.pt/pt-pt/l/ipad/6053d9e8-2eaa-4971-9b6e-79b8a16e4dee",
        "macs": "https://www.backmarket.pt/pt-pt/l/todos-os-macbook/297f69c7-b41c-40dd-aa9b-93ab067eb691",
        "apple_watch": "https://www.backmarket.pt/pt-pt/l/apple-watch/92caf545-c033-409f-bcb0-d3cfec8af49d",
        "tablets": "https://www.backmarket.pt/pt-pt/l/tablets/5a3cfa21-b588-49b1-b4e9-2636bec68ada",
        "laptops": "https://www.backmarket.pt/pt-pt/l/computadores-portateis/630dab14-5051-49b9-bc7b-bb20876d4850",
        "samsung_phones": "https://www.backmarket.pt/pt-pt/l/smartphones-samsung/99760870-ed75-482f-a626-2b4f964c55ae",
    },
    "max_scroll_rounds": 15,
    "delays": {
        "between_products": (1.0, 2.5),
        "between_pages": (3.0, 6.0),
        "after_navigation": (2.0, 4.0),
        "after_cookie_dismiss": (0.5, 1.2),
        "page_load": 5000,
        "scroll_pause": (1.5, 2.5),
    },
    "selectors": {
        "listing_grid": "[data-qa='product-list'], main",
        "product_card": "[data-qa='product-card']",
        "product_link": "a[data-qa='product-card-link'], [data-qa='product-card'] a",
        "product_name": "[data-qa='product-card-title'], h2, h3",
        "product_price": "[data-qa='product-card-price'], [data-qa='price']",
        "product_image": "[data-qa='product-card'] img, img",
        "pagination_next": "[data-qa='pagination-next'], a[aria-label*='Seguinte']",
        "cookie_accept": "#onetrust-accept-btn-handler, button:has-text('Aceitar')",
        "cookie_accept_alt": "button:has-text('Accept all')",
        "detail_title": "h1",
        "detail_price": "[data-qa='price'], [data-qa='product-price']",
        "detail_image": "[data-qa='product-gallery'] img, meta[property='og:image']",
        "detail_og_image": "meta[property='og:image']",
    },
}

# -----------------------------------------------------------------------------
# Swappie
# -----------------------------------------------------------------------------

SWAPPIE_CONFIG: dict[str, Any] = {
    "source": "swappie",
    "base_url": "https://swappie.com/pt-pt",
    "currency": "EUR",
    "warranty_months": 12,
    "headless": os.getenv("SWAPPIE_HEADLESS", "true").lower() != "false",
    "user_agent": os.getenv(
        "SWAPPIE_USER_AGENT",
        (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
    ),
    "output_json": DATA_DIR / "swappie_produtos.json",
    "log_file": DATA_DIR / "swappie_scraper.log",
    "affiliate": {
        "enabled": True,
        "network": "viglink",
        "base_tag": AFFILIATE_PLACEHOLDER,
        "url_template": "{product_url}?cuid={base_tag}",
        "commission_pct": None,
        "avg_basket_eur": None,
    },
    "categories": {
        "iphones": "https://swappie.com/pt/iphone/",
        "ipads": "https://swappie.com/pt/ipad/",
        "macs": None,
        "apple_watch": None,
        "tablets": None,
        "laptops": None,
        "samsung_phones": None,
    },
    "delays": {
        "between_products": (1.0, 2.0),
        "between_pages": (2.0, 4.0),
        "after_navigation": (1.5, 3.0),
        "between_variants": (0.4, 0.8),
        "after_variant_select": (0.8, 1.5),
        "after_cookie_dismiss": (0.4, 0.8),
        "page_load": 4000,
    },
    "selectors": {
        "listing_grid": "main",
        "product_card": "a:has([class*='ModelCard__ProductName'])",
        "product_link": "a:has([class*='ModelCard__ProductName'])",
        "product_name": "[class*='ModelCard__ProductName']",
        "product_price": "[class*='ModelCard__Price']",
        "product_image": "[class*='ModelCard__ImageContainer'] img",
        "product_storage_badge": "[class*='ModelCard__BadgesContainer'] [class*='Badge']",
        "product_color_dot": "[class*='ModelCard__ColorDot']",
        "pagination_next": "",
        "cookie_accept": "button:has-text('Aceitar'), button:has-text('Accept')",
        "detail_title": "h1",
        "detail_price": "[class*='ModelPrice']",
        "variant_button": "button[class*='ListItem']",
        "detail_storage_btn": "button[class*='ListItem']:has-text('GB')",
        "detail_grade_btn": "button[class*='ListItem']:has-text('Satisfatório'), button[class*='ListItem']:has-text('Muito Bom'), button[class*='ListItem']:has-text('Excelente'), button[class*='ListItem']:has-text('Premium')",
        "detail_image": "[class*='ModelInfo'] img, picture img",
        "detail_og_image": "meta[property='og:image']",
    },
}

# -----------------------------------------------------------------------------
# Certideal
# -----------------------------------------------------------------------------

CERTIDEAL_CONFIG: dict[str, Any] = {
    "source": "certideal",
    "base_url": "https://www.certideal.pt",
    "currency": "EUR",
    "warranty_months": 24,
    "headless": os.getenv("CERTIDEAL_HEADLESS", "true").lower() != "false",
    "user_agent": os.getenv(
        "CERTIDEAL_USER_AGENT",
        (
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
            "AppleWebKit/537.36 (KHTML, like Gecko) "
            "Chrome/120.0.0.0 Safari/537.36"
        ),
    ),
    "output_json": DATA_DIR / "certideal_produtos.json",
    "log_file": DATA_DIR / "certideal_scraper.log",
    "affiliate": {
        "enabled": False,
        "network": "direct",
        "base_tag": AFFILIATE_PLACEHOLDER,
        "url_template": "{product_url}",
        "commission_pct": None,
        "avg_basket_eur": None,
    },
    "categories": {
        "iphones": "https://www.certideal.pt/iphone-recondicionado-82",
        "ipads": "https://www.certideal.pt/ipad-recondicionados-118",
        "macs": "https://www.certideal.pt/mac-recondicionado-157",
        "apple_watch": None,
        "tablets": None,
        "laptops": None,
        "samsung_phones": "https://www.certideal.pt/samsung-recondicionado-90",
    },
    # Hub de modelos (sem preço na listagem) — seguir links e recolher SKUs nas subpáginas
    "hub_categories": ("samsung_phones",),
    # Ao re-scrape incremental, substituir produtos desta categoria (corrige dados errados)
    "replace_on_scrape_categories": ("samsung_phones",),
    "delays": {
        "between_products": (0.3, 0.8),
        "between_pages": (1.5, 3.0),
        "after_navigation": (1.0, 2.0),
        "after_cookie_dismiss": (0.4, 0.8),
        "page_load": 3000,
    },
    "selectors": {
        "listing_grid": "#products, #js-product-list, .product_list",
        # PrestaShop duplica cartões (visible-xs = mobile); usar só versão desktop
        "product_card": ".ajax_block_product:not(.visible-xs)",
        "product_link": "a[href*='certideal.pt']",
        "product_name": ".product-name, h3, .panel-body",
        "product_price": ".price, .product-price",
        "product_image": "img[data-src], img.media-object",
        "pagination_next": "#pagination a:has-text('próximo'), #pagination a:has-text('»'), li.next a",
        "cookie_accept": "button:has-text('Aceitar'), .ax-discardButton",
        "detail_title": "h1",
        "detail_price": ".price, .our_price_display",
        "detail_image": "#view_full_size img, img[data-src]",
        "detail_og_image": "meta[property='og:image']",
    },
}

# Mapa de todas as fontes (orquestrador + affiliate_links)
SOURCE_CONFIGS: dict[str, dict[str, Any]] = {
    "iservices": ISERVICES_CONFIG,
    "refurbed": REFURBED_CONFIG,
    "backmarket": BACK_MARKET_CONFIG,
    "swappie": SWAPPIE_CONFIG,
    "certideal": CERTIDEAL_CONFIG,
}

ALL_SOURCE_KEYS: tuple[str, ...] = tuple(SOURCE_CONFIGS.keys())

LAST_RUN_SUMMARY_JSON = DATA_DIR / "last_run_summary.json"
