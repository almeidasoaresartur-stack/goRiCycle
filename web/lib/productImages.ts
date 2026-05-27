/**
 * Imagens de produto servidas localmente via Vercel CDN (/public/images/products).
 * Gerado por scripts/download_product_images.py — não usar URLs externas.
 */

const MODEL_IMAGE_MAP: Record<string, string> = {
  "apple watch se alumínio 44 mm (2020)": "/images/products/apple-watch-se-alumnio-44-mm-2020.jpg",
  "apple watch series 10 alumínio 46 mm (2024)": "/images/products/apple-watch-series-10-alumnio-46-mm-2024.jpg",
  "apple watch series 10 titânio 46 mm (2024)": "/images/products/apple-watch-series-10-titnio-46-mm-2024.jpg",
  "apple watch series 11 titânio 42 mm (2025)": "/images/products/apple-watch-series-11-titnio-42-mm-2025.jpg",
  "apple watch series 11 titânio 46 mm (2025)": "/images/products/apple-watch-series-11-titnio-46-mm-2025.jpg",
  "apple watch series 6 alumínio 40 mm (2020)": "/images/products/apple-watch-series-6-alumnio-40-mm-2020.jpg",
  "apple watch series 8 alumínio 45 mm (2022)": "/images/products/apple-watch-series-8-alumnio-45-mm-2022.jpg",
  "apple watch series 8 aço inoxidável 45 mm (2022)": "/images/products/apple-watch-series-8-ao-inoxidvel-45-mm-2022.jpg",
  "apple watch series 9 alumínio 41 mm (2023)": "/images/products/apple-watch-series-9-alumnio-41-mm-2023.jpg",
  "apple watch ultra 2 (2024)": "/images/products/apple-watch-ultra-2-2024.jpg",
  "apple watch ultra 2": "/images/products/apple-watch-ultra-2.jpg",
  "google pixel 10 pro fold": "/images/products/google-pixel-10-pro-fold.jpg",
  "google pixel 6": "/images/products/google-pixel-6.jpg",
  "ipad 10 (2022) 10.9”": "/images/products/ipad-10-2022-109.png",
  "ipad 10 wifi + 5g": "/images/products/ipad-10-wifi-5g.jpg",
  "ipad 10.2\" 2019 (7ª geração)": "/images/products/ipad-102-2019-7-gerao.jpg",
  "ipad 10.2\" 2020 (8ª geração)": "/images/products/ipad-102-2020-8-gerao.jpg",
  "ipad 10.2\" 2021 (9ª geração)": "/images/products/ipad-102-2021-9-gerao.jpg",
  "ipad 10.9\" 2022 (10ª geração)": "/images/products/ipad-109-2022-10-gerao.jpg",
  "ipad 11 (2025) 11”": "/images/products/ipad-11-2025-11.png",
  "ipad 11 (2025) wifi 11ª...": "/images/products/ipad-11-2025-wifi-11.jpg",
  "ipad 11 (2025) | 10.9\"": "/images/products/ipad-11-2025-109.jpg",
  "ipad 11 wifi": "/images/products/ipad-11-wifi.jpg",
  "ipad 6 (2018) | 9.7\"": "/images/products/ipad-6-2018-97.jpg",
  "ipad 8 (2020) 10.2”": "/images/products/ipad-8-2020-102.png",
  "ipad 9 (2021) 10.2”": "/images/products/ipad-9-2021-102.png",
  "ipad 9 wifi + 5g": "/images/products/ipad-9-wifi-5g.jpg",
  "ipad air (2024) | 11\"": "/images/products/ipad-air-2024-11.jpg",
  "ipad air (2024) | 13\"": "/images/products/ipad-air-2024-13.jpg",
  "ipad air (2025) | 11\"": "/images/products/ipad-air-2025-11.jpg",
  "ipad air (2025) | 13\"": "/images/products/ipad-air-2025-13.jpg",
  "ipad air 2019 (3ª geração)": "/images/products/ipad-air-2019-3-gerao.jpg",
  "ipad air 2020 (4ª geração)": "/images/products/ipad-air-2020-4-gerao.jpg",
  "ipad air 2022 (5ª geração)": "/images/products/ipad-air-2022-5-gerao.jpg",
  "ipad air 4 (2020) 10.9”": "/images/products/ipad-air-4-2020-109.png",
  "ipad air 5 (2022) 10.9”": "/images/products/ipad-air-5-2022-109.png",
  "ipad air 6 (2024) 11”": "/images/products/ipad-air-6-2024-11.png",
  "ipad air 7 (2025) 11”": "/images/products/ipad-air-7-2025-11.png",
  "ipad mini (2019) | 7.9\"": "/images/products/ipad-mini-2019-79.jpg",
  "ipad mini (2021) | 8.3\"": "/images/products/ipad-mini-2021-83.jpg",
  "ipad mini 2019 (5ª geração)": "/images/products/ipad-mini-2019-5-gerao.jpg",
  "ipad mini 2021 (6ª geração)": "/images/products/ipad-mini-2021-6-gerao.jpg",
  "ipad mini 6 (2021 a15 series) 64 gb...": "/images/products/ipad-mini-6-2021-a15-series.jpg",
  "ipad mini 6 (2021) 8.3”": "/images/products/ipad-mini-6-2021-83.png",
  "ipad mini 6 wifi": "/images/products/ipad-mini-6-wifi.jpg",
  "ipad mini 7 (2024) 8.3”": "/images/products/ipad-mini-7-2024-83.png",
  "ipad pro (2018) 11”": "/images/products/ipad-pro-2018-11.png",
  "ipad pro (2018) 12.9”": "/images/products/ipad-pro-2018-129.png",
  "ipad pro (2020) 12.9”": "/images/products/ipad-pro-2020-129.png",
  "ipad pro (2021) 11”": "/images/products/ipad-pro-2021-11.png",
  "ipad pro (2021) 12.9”": "/images/products/ipad-pro-2021-129.png",
  "ipad pro (2021) | 11.0\"": "/images/products/ipad-pro-2021-110.jpg",
  "ipad pro (2022) 11”": "/images/products/ipad-pro-2022-11.png",
  "ipad pro (2022) 12.9”": "/images/products/ipad-pro-2022-129.png",
  "ipad pro (2022) | 11.0\"": "/images/products/ipad-pro-2022-110.jpg",
  "ipad pro (2024) 11”": "/images/products/ipad-pro-2024-11.png",
  "ipad pro (2024) 13”": "/images/products/ipad-pro-2024-13.png",
  "ipad pro (2025) | 11\"": "/images/products/ipad-pro-2025-11.jpg",
  "ipad pro (2025) | 13\"": "/images/products/ipad-pro-2025-13.jpg",
  "ipad pro 11\" 2020 (2ª geração)": "/images/products/ipad-pro-11-2020-2-gerao.jpg",
  "ipad pro 11\" 2021 (3ª geração)": "/images/products/ipad-pro-11-2021-3-gerao.jpg",
  "ipad pro 11\" 2022 (4ª geração)": "/images/products/ipad-pro-11-2022-4-gerao.jpg",
  "ipad pro 12.9\" 2018 (3ª geração)": "/images/products/ipad-pro-129-2018-3-gerao.jpg",
  "ipad pro 12.9\" 2020 (4ª geração)": "/images/products/ipad-pro-129-2020-4-gerao.jpg",
  "ipad pro 12.9\" 2021 (5ª geração)": "/images/products/ipad-pro-129-2021-5-gerao.jpg",
  "ipad pro 12.9\" 2022 (6ª geração)": "/images/products/ipad-pro-129-2022-6-gerao.jpg",
  "iphone 11 pro max": "/images/products/iphone-11-pro-max.png",
  "iphone 11 pro": "/images/products/iphone-11-pro.png",
  "iphone 11": "/images/products/iphone-11.png",
  "iphone 12 mini": "/images/products/iphone-12-mini.png",
  "iphone 12 pro 256 gb azul pacífico": "/images/products/iphone-12-pro-azul-pacfico.jpg",
  "iphone 12 pro max 128 gb grafite": "/images/products/iphone-12-pro-max-grafite.jpg",
  "iphone 12 pro max": "/images/products/iphone-12-pro-max.png",
  "iphone 12 pro": "/images/products/iphone-12-pro.png",
  "iphone 12": "/images/products/iphone-12.png",
  "iphone 13 128 gb vermelho": "/images/products/iphone-13-vermelho.jpg",
  "iphone 13 256 gb rosa": "/images/products/iphone-13-rosa.jpg",
  "iphone 13 mini": "/images/products/iphone-13-mini.png",
  "iphone 13 pro max": "/images/products/iphone-13-pro-max.png",
  "iphone 13 pro": "/images/products/iphone-13-pro.png",
  "iphone 13": "/images/products/iphone-13.png",
  "iphone 14 128 gb cor surpresa": "/images/products/iphone-14-cor-surpresa.jpg",
  "iphone 14 plus": "/images/products/iphone-14-plus.png",
  "iphone 14 pro max": "/images/products/iphone-14-pro-max.png",
  "iphone 14 pro": "/images/products/iphone-14-pro.png",
  "iphone 14": "/images/products/iphone-14.png",
  "iphone 15 plus": "/images/products/iphone-15-plus.png",
  "iphone 15 pro max": "/images/products/iphone-15-pro-max.png",
  "iphone 15 pro": "/images/products/iphone-15-pro.png",
  "iphone 15": "/images/products/iphone-15.png",
  "iphone 16 plus": "/images/products/iphone-16-plus.png",
  "iphone 16 pro max": "/images/products/iphone-16-pro-max.png",
  "iphone 16 pro": "/images/products/iphone-16-pro.png",
  "iphone 16": "/images/products/iphone-16.png",
  "iphone 16e": "/images/products/iphone-16e.png",
  "iphone 17 pro max": "/images/products/iphone-17-pro-max.png",
  "iphone 17 pro": "/images/products/iphone-17-pro.png",
  "iphone 17": "/images/products/iphone-17.png",
  "iphone 7 plus": "/images/products/iphone-7-plus.jpg",
  "iphone 7": "/images/products/iphone-7.jpg",
  "iphone 8 64 gb cinzento sideral": "/images/products/iphone-8-cinzento-sideral.jpg",
  "iphone 8 64 gb dourado": "/images/products/iphone-8-dourado.jpg",
  "iphone 8 plus 64 gb dourado": "/images/products/iphone-8-plus-dourado.jpg",
  "iphone 8 plus": "/images/products/iphone-8-plus.jpg",
  "iphone 8": "/images/products/iphone-8.jpg",
  "iphone air": "/images/products/iphone-air.png",
  "iphone se (2020)": "/images/products/iphone-se-2020.png",
  "iphone se (2022)": "/images/products/iphone-se-2022.png",
  "iphone se 2 (2020) 128 gb vermelho": "/images/products/iphone-se-2-2020-vermelho.jpg",
  "iphone se 2 (2020) 64 gb branco": "/images/products/iphone-se-2-2020-branco.jpg",
  "iphone se 2 (2020) 64 gb preto": "/images/products/iphone-se-2-2020-preto.jpg",
  "iphone se 2 (2020)": "/images/products/iphone-se-2-2020.jpg",
  "iphone se 2020": "/images/products/iphone-se-2020.png",
  "iphone se 2022": "/images/products/iphone-se-2022.png",
  "iphone se 3 (2022)": "/images/products/iphone-se-3-2022.jpg",
  "iphone x": "/images/products/iphone-x.jpg",
  "iphone xr": "/images/products/iphone-xr.jpg",
  "iphone xs max 256 gb cinzento sideral": "/images/products/iphone-xs-max-cinzento-sideral.jpg",
  "iphone xs max 256 gb dourado": "/images/products/iphone-xs-max-dourado.jpg",
  "iphone xs max": "/images/products/iphone-xs-max.jpg",
  "iphone xs": "/images/products/iphone-xs.jpg",
  "lenovo tab m10 hd tb-x306x | 10.1\"": "/images/products/lenovo-tab-m10-hd-tbx306x-101.jpg",
  "macbook 12\" 2017": "/images/products/macbook-12-2017.jpg",
  "macbook air 13 (2017) - core i5...": "/images/products/macbook-air-13-2017-core-i5.jpg",
  "macbook air 13 (2017) - core i7...": "/images/products/macbook-air-13-2017-core-i7.jpg",
  "macbook air 13\" 2015": "/images/products/macbook-air-13-2015.jpg",
  "macbook air 13\" 2017": "/images/products/macbook-air-13-2017.jpg",
  "macbook air 13\" 2018": "/images/products/macbook-air-13-2018.jpg",
  "macbook air 13\" 2019": "/images/products/macbook-air-13-2019.jpg",
  "macbook air 13\" 2020": "/images/products/macbook-air-13-2020.jpg",
  "macbook air 13\" 2022": "/images/products/macbook-air-13-2022.jpg",
  "macbook air 15\" 2023": "/images/products/macbook-air-15-2023.jpg",
  "macbook pro 13 (2015) - core i5...": "/images/products/macbook-pro-13-2015-core-i5.jpg",
  "macbook pro 13 (2017) - core i5...": "/images/products/macbook-pro-13-2017-core-i5.jpg",
  "macbook pro 13\" 2015": "/images/products/macbook-pro-13-2015.jpg",
  "macbook pro 13\" 2017": "/images/products/macbook-pro-13-2017.jpg",
  "macbook pro 13\" 2020": "/images/products/macbook-pro-13-2020.jpg",
  "macbook pro 13\" 2022": "/images/products/macbook-pro-13-2022.jpg",
  "macbook pro 14\" 2021": "/images/products/macbook-pro-14-2021.jpg",
  "macbook pro 15\" 2015": "/images/products/macbook-pro-15-2015.jpg",
  "macbook pro 15\" 2017": "/images/products/macbook-pro-15-2017.jpg",
  "macbook pro 15\" 2018": "/images/products/macbook-pro-15-2018.jpg",
  "macbook pro 16\" 2019": "/images/products/macbook-pro-16-2019.jpg",
  "macbook pro 16\" 2021": "/images/products/macbook-pro-16-2021.jpg",
  "nokia t21": "/images/products/nokia-t21.jpg",
  "samsung galaxy tab a7 | 10.4\" (2020)": "/images/products/samsung-galaxy-tab-a7-104-2020.jpg",
  "samsung galaxy tab s2 | 9.7\"": "/images/products/samsung-galaxy-tab-s2-97.jpg",
  "samsung galaxy tab s6 lite (2022) | 10.4\"": "/images/products/samsung-galaxy-tab-s6-lite-2022-104.jpg",
  "samsung galaxy z fold6": "/images/products/samsung-galaxy-z-fold6.jpg",
};

const CATEGORY_FALLBACKS: Record<string, string> = {
  smartphone: "/images/products/iphone-14.png",
  tablet: "/images/products/ipad-109-2022-10-gerao.jpg",
  laptop: "/images/products/macbook-air-13-2022.jpg",
  wearable: "/images/products/apple-watch-series-9-alumnio-41-mm-2023.jpg",
};

const SORTED_MODEL_KEYS = Object.keys(MODEL_IMAGE_MAP).sort((a, b) => b.length - a.length);

export function getProductImage(
  rawName: string,
  category: string,
  scraperImageUrl?: string,
): string {
  const normalized = rawName
    .toLowerCase()
    .replace(/\b(64|128|256|512|1024)gb\b/gi, "")
    .replace(/\b(grade [abc]|excelente|premium|bom|refurbished|recondicionado)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();

  if (MODEL_IMAGE_MAP[normalized]) {
    return MODEL_IMAGE_MAP[normalized];
  }

  for (const key of SORTED_MODEL_KEYS) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return MODEL_IMAGE_MAP[key];
    }
  }

  const catFallback = CATEGORY_FALLBACKS[category?.toLowerCase()];
  if (catFallback) return catFallback;

  return scraperImageUrl || CATEGORY_FALLBACKS.smartphone;
}

export function cleanProductName(rawName: string): string {
  return rawName
    .replace(/\b(64|128|256|512|1024)gb\b/gi, "")
    .replace(
      /\b(grade [abc]|excelente|premium|bom|refurbished|recondicionado|desbloqueado|unlocked)\b/gi,
      "",
    )
    .replace(/\s*[-–|·]\s*.+$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function techToImageCategory(tech: string): string {
  switch (tech) {
    case "laptops":
      return "laptop";
    case "wearables":
      return "wearable";
    case "tablets":
      return "tablet";
    default:
      return "smartphone";
  }
}
