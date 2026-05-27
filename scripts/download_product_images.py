"""
Lê todos os JSONs de produtos, extrai a melhor imagem por modelo,
descarrega-a e guarda em web/public/images/products/[slug].jpg

Corre: python scripts/download_product_images.py
"""
from __future__ import annotations

import json
import re
import sys
import time
import pathlib

import httpx

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"
OUTPUT_DIR = ROOT / "web" / "public" / "images" / "products"
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

SOURCES = [
    "iservices_produtos.json",
    "refurbed_produtos.json",
    "swappie_produtos.json",
    "certideal_produtos.json",
]

SOURCE_PRIORITY = {"swappie": 0, "certideal": 1, "refurbed": 2, "iservices": 3}

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    ),
    "Accept": "image/webp,image/apng,image/*,*/*;q=0.8",
}


def slugify(name: str) -> str:
    """Converte 'iPhone 13 Pro Max' → 'iphone-13-pro-max'"""
    name = name.lower().strip()
    name = re.sub(r"\b(64|128|256|512|1024)\s*gb\b", "", name)
    name = re.sub(
        r"\b(grade [abc]|excelente|premium|bom|refurbished|recondicionado|desbloqueado|unlocked)\b",
        "",
        name,
    )
    name = re.sub(r"[^a-z0-9\s]", "", name)
    name = re.sub(r"\s+", "-", name.strip())
    return name


def extract_model_key(product: dict) -> str:
    """Usa o campo 'model' se existir, senão 'name'"""
    return product.get("model") or product.get("name") or ""


def ext_from_url(url: str) -> str:
    lower = url.lower()
    if ".png" in lower:
        return ".png"
    if ".webp" in lower:
        return ".webp"
    return ".jpg"


def improve_image_url(url: str) -> str:
    """Pede resolução maior quando a loja permite (ex.: CDN Swappie)."""
    if "assets.swappie.com" in url:
        url = re.sub(r"width=\d+", "width=640", url)
        url = re.sub(r"height=\d+", "height=640", url)
    return url


def load_products(path: pathlib.Path) -> list[dict]:
    raw = json.loads(path.read_text(encoding="utf-8"))
    if isinstance(raw, list):
        return raw
    if isinstance(raw, dict) and isinstance(raw.get("products"), list):
        return raw["products"]
    return []


def write_product_images_ts(model_best: dict[str, dict], downloaded_slugs: dict[str, str]) -> None:
    """Gera web/lib/productImages.ts a partir dos ficheiros descarregados."""
    slug_ext = {slug: downloaded_slugs[slug] for slug in downloaded_slugs}

    lines: set[str] = set()
    for slug, data in sorted(model_best.items(), key=lambda x: x[1]["model"].lower()):
        if slug not in slug_ext:
            continue
        ext = slug_ext[slug]
        key = data["model"].lower().replace("\\", "\\\\").replace('"', '\\"')
        lines.add(f'  "{key}": "/images/products/{slug}{ext}",')

    aliases = {
        "iphone se (2020)": "iphone-se-2020",
        "iphone se (2022)": "iphone-se-2022",
        "iphone se 2020": "iphone-se-2020",
        "iphone se 2022": "iphone-se-2022",
    }
    for alias, target in aliases.items():
        if target in slug_ext:
            lines.add(f'  "{alias}": "/images/products/{target}{slug_ext[target]}",')

    fallbacks = {
        "smartphone": "iphone-14",
        "tablet": "ipad-109-2022-10-gerao",
        "laptop": "macbook-air-13-2022",
        "wearable": "apple-watch-series-9-alumnio-41-mm-2023",
    }
    fb_lines = []
    for cat, slug in fallbacks.items():
        if slug in slug_ext:
            fb_lines.append(f'  {cat}: "/images/products/{slug}{slug_ext[slug]}",')

    sorted_lines = sorted(lines, key=str.lower)
    ts_path = ROOT / "web" / "lib" / "productImages.ts"
    ts_path.write_text(
        f'''/**
 * Imagens de produto servidas localmente via Vercel CDN (/public/images/products).
 * Gerado por scripts/download_product_images.py — não usar URLs externas.
 */

const MODEL_IMAGE_MAP: Record<string, string> = {{
{chr(10).join(sorted_lines)}
}};

const CATEGORY_FALLBACKS: Record<string, string> = {{
{chr(10).join(fb_lines)}
}};

const SORTED_MODEL_KEYS = Object.keys(MODEL_IMAGE_MAP).sort((a, b) => b.length - a.length);

export function getProductImage(
  rawName: string,
  category: string,
  scraperImageUrl?: string,
): string {{
  const normalized = rawName
    .toLowerCase()
    .replace(/\\b(64|128|256|512|1024)gb\\b/gi, "")
    .replace(/\\b(grade [abc]|excelente|premium|bom|refurbished|recondicionado)\\b/gi, "")
    .replace(/\\s+/g, " ")
    .trim();

  if (MODEL_IMAGE_MAP[normalized]) {{
    return MODEL_IMAGE_MAP[normalized];
  }}

  for (const key of SORTED_MODEL_KEYS) {{
    if (normalized.includes(key) || key.includes(normalized)) {{
      return MODEL_IMAGE_MAP[key];
    }}
  }}

  const catFallback = CATEGORY_FALLBACKS[category?.toLowerCase()];
  if (catFallback) return catFallback;

  return scraperImageUrl || CATEGORY_FALLBACKS.smartphone;
}}

export function cleanProductName(rawName: string): string {{
  return rawName
    .replace(/\\b(64|128|256|512|1024)gb\\b/gi, "")
    .replace(
      /\\b(grade [abc]|excelente|premium|bom|refurbished|recondicionado|desbloqueado|unlocked)\\b/gi,
      "",
    )
    .replace(/\\s*[-–|·]\\s*.+$/, "")
    .replace(/\\s+/g, " ")
    .trim();
}}

export function techToImageCategory(tech: string): string {{
  switch (tech) {{
    case "laptops":
      return "laptop";
    case "wearables":
      return "wearable";
    case "tablets":
      return "tablet";
    default:
      return "smartphone";
  }}
}}
''',
        encoding="utf-8",
    )
    print(f"\n[GEN]  {ts_path.relative_to(ROOT)} — {len(sorted_lines)} entradas no MODEL_IMAGE_MAP")


def main() -> int:
    all_products: list[dict] = []

    for filename in SOURCES:
        path = DATA_DIR / filename
        if not path.exists():
            print(f"[SKIP] {filename} não encontrado")
            continue
        products = load_products(path)
        print(f"[OK]   {filename} — {len(products)} produtos")
        all_products.extend(products)

    print(f"\nTotal de produtos: {len(all_products)}")

    model_best: dict[str, dict] = {}
    model_candidates: dict[str, list[dict]] = {}

    for p in all_products:
        model_key = extract_model_key(p)
        image_url = p.get("image_url")
        if not model_key or not image_url:
            continue

        slug = slugify(model_key)
        if not slug:
            continue

        source = (p.get("source") or p.get("store") or "unknown").lower()
        priority = SOURCE_PRIORITY.get(source, 99)
        candidate = {
            "priority": priority,
            "image_url": improve_image_url(image_url),
            "model": model_key,
        }

        model_candidates.setdefault(slug, []).append(candidate)

        if slug not in model_best or priority < model_best[slug]["priority"]:
            model_best[slug] = candidate

    for slug, candidates in model_candidates.items():
        candidates.sort(key=lambda c: c["priority"])
        model_candidates[slug] = candidates

    print(f"Modelos únicos encontrados: {len(model_best)}")

    downloaded = 0
    skipped = 0
    errors = 0
    downloaded_slugs: dict[str, str] = {}

    for slug, data in sorted(model_best.items()):
        existing = [f for f in OUTPUT_DIR.glob(f"{slug}.*") if f.is_file()]
        large = next((f for f in existing if f.stat().st_size > 5000), None)
        if large:
            skipped += 1
            downloaded_slugs[slug] = large.suffix
            continue

        for old in existing:
            old.unlink()

        candidates = model_candidates.get(slug, [data])
        saved = False

        for candidate in candidates:
            image_url = candidate["image_url"]
            ext = ext_from_url(image_url)
            dest = OUTPUT_DIR / f"{slug}{ext}"

            try:
                r = httpx.get(image_url, headers=HEADERS, timeout=20, follow_redirects=True)
                r.raise_for_status()

                if len(r.content) < 1000:
                    continue

                dest.write_bytes(r.content)
                if len(r.content) >= 5000:
                    downloaded += 1
                    downloaded_slugs[slug] = ext
                    print(f"[OK]   {slug} ({len(r.content) // 1024}KB) ← {candidate['model']}")
                    saved = True
                    break

                # Guarda temporariamente; tenta próxima fonte se existir
                if len(candidates) == 1 or candidate is candidates[-1]:
                    downloaded += 1
                    downloaded_slugs[slug] = ext
                    print(
                        f"[OK]   {slug} ({len(r.content) // 1024}KB, pequena) ← {candidate['model']}"
                    )
                    saved = True
                    break
                dest.unlink()

            except Exception:
                continue

            time.sleep(0.2)

        if not saved:
            errors += 1
            print(f"[ERRO] {slug}: nenhuma imagem válida")
            continue

        time.sleep(0.2)

    total_files = len(list(OUTPUT_DIR.iterdir()))
    print(
        f"""
╔══════════════════════════════════════╗
  Imagens descarregadas:  {downloaded}
  Já existiam (skip):     {skipped}
  Erros:                  {errors}
  Total na pasta:         {total_files}
╚══════════════════════════════════════╝
"""
    )

    print("## Copia este mapeamento para lib/productImages.ts:\n")
    for slug, data in sorted(model_best.items()):
        if slug not in downloaded_slugs:
            continue
        ext = downloaded_slugs[slug]
        print(f'  "{data["model"].lower()}": "/images/products/{slug}{ext}",')

    write_product_images_ts(model_best, downloaded_slugs)

    return 1 if errors and not downloaded else 0


if __name__ == "__main__":
    sys.exit(main())
