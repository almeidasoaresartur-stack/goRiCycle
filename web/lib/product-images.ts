import type { TechType } from "./marketplace";

const IMG = (id: string) =>
  `https://images.unsplash.com/${id}?w=640&h=640&fit=crop&crop=center&auto=format&q=85&bg=f8fafc`;

const MODEL_IMAGE_RULES: { test: RegExp; src: string }[] = [
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
  { test: /galaxy\s*s2[3-4]\s*ultra/i, src: IMG("photo-1610945265064-0e34e55198d7") },
  { test: /galaxy\s*s2[1-4]/i, src: IMG("photo-1610945265064-0e34e55198d7") },
  { test: /galaxy|samsung/i, src: IMG("photo-1610945265064-0e34e55198d7") },
  { test: /pixel/i, src: IMG("photo-1598327105666-5b17351b4b1a") },
  { test: /ipad/i, src: IMG("photo-1544244015-0df4b3ffc6b0") },
  { test: /oneplus|xiaomi|redmi|poco|huawei|honor/i, src: IMG("photo-1511707171634-5f897ff02aa9") },
];

const TECH_FALLBACK: Record<TechType, string> = {
  smartphones: IMG("photo-1511707171634-5f897ff02aa9"),
  tablets: IMG("photo-1544244015-0df4b3ffc6b0"),
  laptops: IMG("photo-1517336714731-489689fd1ca8"),
  wearables: IMG("photo-1579586337278-3bef891a6597"),
};

/** Imagem local mapeada por modelo — null se não houver match exacto nas regras. */
export function findCatalogImage(modelName: string): string | null {
  const model = (modelName ?? "").trim();
  for (const { test, src } of MODEL_IMAGE_RULES) {
    if (test.test(model)) return src;
  }
  return null;
}

export function getProductPlaceholderImage(
  modelName: string,
  tech: TechType = "smartphones",
): string {
  return findCatalogImage(modelName) ?? TECH_FALLBACK[tech] ?? TECH_FALLBACK.smartphones;
}

/**
 * Prioridade: catálogo mapeado → image_url do scraper → fallback genérico.
 * Nunca devolve string vazia.
 */
export function getProductCardImage(
  modelName: string,
  tech: TechType = "smartphones",
  scraperUrl?: string | null,
): string {
  const catalog = findCatalogImage(modelName);
  if (catalog) return catalog;

  const scraped = scraperUrl?.trim();
  if (scraped) return scraped;

  return TECH_FALLBACK[tech] ?? TECH_FALLBACK.smartphones;
}
