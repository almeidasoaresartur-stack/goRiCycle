import type { TechType } from "./marketplace";

const IMG = (id: string) =>
  `https://images.unsplash.com/${id}?w=640&h=640&fit=crop&crop=center&auto=format&q=85&bg=f8fafc`;

/** Imagens de catálogo consistentes — ignora URLs dos scrapers nos cards. */
const MODEL_IMAGE_RULES: { test: RegExp; src: string }[] = [
  // iPhone — variantes específicas primeiro
  { test: /iphone\s*1[5-7]\s*pro\s*max/i, src: IMG("photo-1695048133146-258a5a5670b2") },
  { test: /iphone\s*1[3-4]\s*pro\s*max/i, src: IMG("photo-1678652197831-2a640d044ca7") },
  { test: /iphone\s*1[3-7]\s*pro/i, src: IMG("photo-1678685888256-a79e24688177") },
  { test: /iphone\s*1[3-7]\s*plus/i, src: IMG("photo-1678652197831-2a640d044ca7") },
  { test: /iphone\s*1[3]\s*mini/i, src: IMG("photo-1632661674597-df6d5f3c1620") },
  { test: /iphone\s*1[5-7]\b/i, src: IMG("photo-1695048133146-258a5a5670b2") },
  { test: /iphone\s*14\b/i, src: IMG("photo-1678652197831-2a640d044ca7") },
  { test: /iphone\s*13\b/i, src: IMG("photo-1632661674597-df6d5f3c1620") },
  { test: /iphone\s*se/i, src: IMG("photo-1592899677977-9c10ca588fa0") },
  { test: /iphone/i, src: IMG("photo-1511707171634-5f897ff02aa9") },

  // Samsung Galaxy
  { test: /galaxy\s*s2[3-4]\s*ultra/i, src: IMG("photo-1610945265064-0e34e55198d7") },
  { test: /galaxy\s*s2[1-4]/i, src: IMG("photo-1610945265064-0e34e55198d7") },
  { test: /galaxy|samsung/i, src: IMG("photo-1610945265064-0e34e55198d7") },

  // Google Pixel
  { test: /pixel/i, src: IMG("photo-1598327105666-5b17351b4b1a") },

  // MacBooks
  { test: /macbook\s*pro/i, src: IMG("photo-1517336714731-489689fd1ca8") },
  { test: /macbook\s*air/i, src: IMG("photo-1611186871348-b1ce696e52be") },
  { test: /macbook|mac\s*book/i, src: IMG("photo-1517336714731-489689fd1ca8") },

  // Apple Watch
  { test: /apple\s*watch/i, src: IMG("photo-1579586337278-3bef891a6597") },

  // Outros smartphones
  { test: /oneplus|xiaomi|redmi|poco|huawei|honor/i, src: IMG("photo-1511707171634-5f897ff02aa9") },
];

const TECH_FALLBACK: Record<TechType, string> = {
  smartphones: IMG("photo-1511707171634-5f897ff02aa9"),
  laptops: IMG("photo-1517336714731-489689fd1ca8"),
  wearables: IMG("photo-1579586337278-3bef891a6597"),
};

export function getProductPlaceholderImage(
  modelName: string,
  tech: TechType = "smartphones",
): string {
  const model = (modelName ?? "").trim();
  for (const { test, src } of MODEL_IMAGE_RULES) {
    if (test.test(model)) return src;
  }
  return TECH_FALLBACK[tech] ?? TECH_FALLBACK.smartphones;
}

/** Usar sempre imagem de catálogo nos cards — nunca a URL do scraper. */
export function getProductCardImage(
  modelName: string,
  tech: TechType = "smartphones",
): string {
  return getProductPlaceholderImage(modelName, tech);
}
