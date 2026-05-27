import type { TechType } from "./marketplace";
import { normalizeColor } from "./model-matching";

const IMG = (id: string) =>
  `https://images.unsplash.com/${id}?w=640&h=640&fit=crop&crop=center&auto=format&q=85&bg=f8fafc`;

type ColorKey =
  | "preto"
  | "branco"
  | "prata"
  | "ouro"
  | "azul"
  | "verde"
  | "vermelho"
  | "rosa"
  | "roxo"
  | "cinzento"
  | "default";

type CatalogEntry = {
  test: RegExp;
  colors: Partial<Record<ColorKey, string>> & { default: string };
};

const IPHONE14 = {
  default: IMG("photo-1678652197831-2a640d044ca7"),
  preto: IMG("photo-1678652197831-2a640d044ca7"),
  azul: IMG("photo-1678685888256-a79e24688177"),
  roxo: IMG("photo-1695048133146-258a5a5670b2"),
  vermelho: IMG("photo-1632661674597-df6d5f3c1620"),
  branco: IMG("photo-1592899677977-9c10ca588fa0"),
};

const IPHONE13 = {
  default: IMG("photo-1632661674597-df6d5f3c1620"),
  preto: IMG("photo-1632661674597-df6d5f3c1620"),
  azul: IMG("photo-1678685888256-a79e24688177"),
  rosa: IMG("photo-1592899677977-9c10ca588fa0"),
  branco: IMG("photo-1592899677977-9c10ca588fa0"),
};

const IPHONE15 = {
  default: IMG("photo-1695048133146-258a5a5670b2"),
  preto: IMG("photo-1695048133146-258a5a5670b2"),
  azul: IMG("photo-1678685888256-a79e24688177"),
  verde: IMG("photo-1632661674597-df6d5f3c1620"),
};

const MODEL_COLOR_CATALOG: CatalogEntry[] = [
  { test: /iphone\s*1[5-7]\s*pro\s*max/i, colors: { ...IPHONE15, default: IPHONE15.default } },
  { test: /iphone\s*1[3-4]\s*pro\s*max/i, colors: { ...IPHONE14, default: IPHONE14.default } },
  { test: /iphone\s*1[3-7]\s*pro/i, colors: { ...IPHONE15, default: IPHONE15.default } },
  { test: /iphone\s*1[5-7]\b/i, colors: IPHONE15 },
  { test: /iphone\s*14\b/i, colors: IPHONE14 },
  { test: /iphone\s*13\b/i, colors: IPHONE13 },
  { test: /iphone\s*se/i, colors: { default: IMG("photo-1592899677977-9c10ca588fa0"), preto: IMG("photo-1632661674597-df6d5f3c1620"), branco: IMG("photo-1592899677977-9c10ca588fa0") } },
  { test: /iphone/i, colors: { default: IMG("photo-1511707171634-5f897ff02aa9") } },
  { test: /galaxy\s*s2[1-4]/i, colors: { default: IMG("photo-1610945265064-0e34e55198d7"), preto: IMG("photo-1610945265064-0e34e55198d7"), verde: IMG("photo-1610945265064-0e34e55198d7") } },
  { test: /pixel/i, colors: { default: IMG("photo-1598327105666-5b17351b4b1a"), preto: IMG("photo-1598327105666-5b17351b4b1a"), branco: IMG("photo-1592899677977-9c10ca588fa0") } },
  { test: /ipad/i, colors: { default: IMG("photo-1544244015-0df4b3ffc6b0"), cinzento: IMG("photo-1544244015-0df4b3ffc6b0"), prata: IMG("photo-1544244015-0df4b3ffc6b0") } },
  { test: /macbook/i, colors: { default: IMG("photo-1517336714731-489689fd1ca8"), cinzento: IMG("photo-1517336714731-489689fd1ca8"), prata: IMG("photo-1611186871348-b1ce696e52be") } },
  { test: /thinkpad|latitude/i, colors: { default: IMG("photo-1496181133206-798cefa5e984"), preto: IMG("photo-1496181133206-798cefa5e984") } },
];

const TECH_FALLBACK: Record<TechType, string> = {
  smartphones: IMG("photo-1511707171634-5f897ff02aa9"),
  tablets: IMG("photo-1544244015-0df4b3ffc6b0"),
  laptops: IMG("photo-1517336714731-489689fd1ca8"),
  wearables: IMG("photo-1579586337278-3bef891a6597"),
};

function normalizeColorKey(color: string | null | undefined): ColorKey {
  if (!color?.trim()) return "default";
  const c = normalizeColor(color);
  const map: Record<string, ColorKey> = {
    preto: "preto",
    branco: "branco",
    prata: "prata",
    ouro: "ouro",
    azul: "azul",
    verde: "verde",
    vermelho: "vermelho",
    rosa: "rosa",
    roxo: "roxo",
    cinzento: "cinzento",
  };
  return map[c] ?? "default";
}

export function findCatalogImageByModelAndColor(
  modelName: string,
  color: string | null | undefined,
): string | null {
  const model = (modelName ?? "").trim();
  if (!model) return null;

  const colorKey = normalizeColorKey(color);

  for (const { test, colors } of MODEL_COLOR_CATALOG) {
    if (!test.test(model)) continue;
    return colors[colorKey] ?? colors.default ?? null;
  }

  return null;
}

export function getTechFallbackImage(tech: TechType = "smartphones"): string {
  return TECH_FALLBACK[tech] ?? TECH_FALLBACK.smartphones;
}

/** @deprecated Usar findCatalogImageByModelAndColor via getCleanProductData */
export function findCatalogImage(modelName: string): string | null {
  return findCatalogImageByModelAndColor(modelName, null);
}

export function getProductPlaceholderImage(
  modelName: string,
  tech: TechType = "smartphones",
  color?: string | null,
): string {
  return findCatalogImageByModelAndColor(modelName, color) ?? getTechFallbackImage(tech);
}

export function getProductCardImage(
  modelName: string,
  tech: TechType = "smartphones",
  scraperUrl?: string | null,
  color?: string | null,
): string {
  const catalog = findCatalogImageByModelAndColor(modelName, color);
  if (catalog) return catalog;

  const scraped = scraperUrl?.trim();
  if (scraped) return scraped;

  return getTechFallbackImage(tech);
}
