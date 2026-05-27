import type { AggregatedProduct, TechType } from "./marketplace";
import { normalizeColor } from "./model-matching";
import { findCatalogImageByModelAndColor, getTechFallbackImage } from "./product-images";

export type CleanProductData = {
  displayName: string;
  imageUrl: string;
  storageLabel: string;
  detectedColor: string | null;
  scraperFallbackUrl: string | null;
};

const NOISE_PATTERNS = [
  /\brecondicionad[oa]s?\b/gi,
  /\bgrade\s*[a-d]\b/gi,
  /\b(premium|excelente|muito bom|bom|correcto|correto)\b/gi,
  /\b\d+\s*gb\b/gi,
  /\b(novo|usado|semi[- ]?novo)\b/gi,
  /\b(refurbished|renewed)\b/gi,
];

/** Extrai apenas o modelo base legível para o cartão. */
export function cleanBaseModel(raw: string): string {
  let name = (raw ?? "").trim();
  if (!name) return "Modelo desconhecido";

  name = name.split(/\s[-–|]\s/)[0]?.trim() ?? name;

  for (const pattern of NOISE_PATTERNS) {
    name = name.replace(pattern, " ");
  }

  name = name.replace(/\(\s*\)/g, "").replace(/\s{2,}/g, " ").trim();

  if (/iphone\s*se/i.test(name)) {
    if (/2020|se\s*2|2nd|2ª/i.test(raw)) return "iPhone SE (2020)";
    if (/2022|se\s*3|3rd|3ª/i.test(raw)) return "iPhone SE (2022)";
    return "iPhone SE";
  }

  const iphone = name.match(/iphone\s*\d+\s*(?:pro\s*max|pro|plus|mini)?/i);
  if (iphone) {
    return iphone[0]
      .replace(/\s{2,}/g, " ")
      .replace(/pro max/i, "Pro Max")
      .replace(/pro/i, "Pro")
      .replace(/plus/i, "Plus")
      .replace(/mini/i, "Mini")
      .replace(/^iphone/i, "iPhone");
  }

  const galaxy = name.match(/galaxy\s*s\d+(?:\s*ultra|\s*plus|\s*fe|\+)?/i);
  if (galaxy) return galaxy[0].replace(/\s{2,}/g, " ");

  const pixel = name.match(/pixel\s*\d+(?:\s*pro|\s*a)?/i);
  if (pixel) return pixel[0].replace(/^pixel/i, "Pixel");

  const ipad = name.match(/ipad(?:\s*(?:pro|air|mini))?(?:\s*\d+)?/i);
  if (ipad) {
    return ipad[0]
      .replace(/^ipad/i, "iPad")
      .replace(/pro/i, "Pro")
      .replace(/air/i, "Air")
      .replace(/mini/i, "Mini");
  }

  const macbook = name.match(/macbook(?:\s*(?:pro|air))?(?:\s*\d+)?/i);
  if (macbook) {
    return macbook[0].replace(/^macbook/i, "MacBook").replace(/pro/i, "Pro").replace(/air/i, "Air");
  }

  if (/thinkpad/i.test(name)) {
    const tp = name.match(/thinkpad\s*[a-z0-9\s]*/i);
    return tp ? tp[0].replace(/\s{2,}/g, " ").trim() : "ThinkPad";
  }

  if (/latitude/i.test(name)) {
    const lat = name.match(/latitude\s*[a-z0-9\s]*/i);
    return lat ? lat[0].replace(/\s{2,}/g, " ").trim() : "Latitude";
  }

  return name.replace(/\s{2,}/g, " ").trim() || "Modelo desconhecido";
}

export function formatStorageLabel(storage: string | null | undefined): string {
  const value = (storage ?? "").trim();
  if (!value) return "NFPM*";
  const upper = value.toUpperCase();
  if (/^\d+\s*GB$/i.test(value)) return upper.replace(/\s/g, "");
  if (/\d+\s*GB/i.test(value)) {
    const match = value.match(/(\d+\s*GB)/i);
    return match ? match[1].replace(/\s/g, "").toUpperCase() : "NFPM*";
  }
  return "NFPM*";
}

const COLOR_ALIASES: Record<string, string> = {
  preto: "preto",
  black: "preto",
  midnight: "preto",
  meia: "preto",
  branco: "branco",
  white: "branco",
  starlight: "branco",
  prata: "prata",
  silver: "prata",
  ouro: "ouro",
  gold: "ouro",
  dourado: "ouro",
  azul: "azul",
  blue: "azul",
  sierra: "azul",
  verde: "verde",
  green: "verde",
  vermelho: "vermelho",
  red: "vermelho",
  rosa: "rosa",
  pink: "rosa",
  rose: "rosa",
  roxo: "roxo",
  purple: "roxo",
  violeta: "roxo",
  purpura: "roxo",
  cinzento: "cinzento",
  gray: "cinzento",
  grey: "cinzento",
  grafite: "cinzento",
  sideral: "cinzento",
};

export function detectProductColor(
  rawColor: string | null | undefined,
  activeFilter?: string | null,
): string | null {
  if (activeFilter?.trim()) return activeFilter.trim().toLowerCase();
  if (!rawColor?.trim()) return null;

  const normalized = normalizeColor(rawColor);
  for (const [alias, key] of Object.entries(COLOR_ALIASES)) {
    if (normalized.includes(normalizeColor(alias))) return key;
  }
  return null;
}

export function getCleanProductData(
  product: AggregatedProduct,
  options?: { activeColorFilter?: string | null },
): CleanProductData {
  const displayName = cleanBaseModel(product.model ?? product.bestListing?.model ?? "");
  const scraperFallbackUrl = product.imageUrl ?? product.bestListing?.imageUrl ?? null;
  const detectedColor = detectProductColor(
    product.color ?? product.bestListing?.color,
    options?.activeColorFilter,
  );

  const catalogImage = findCatalogImageByModelAndColor(displayName, detectedColor);
  const imageUrl =
    catalogImage ??
    scraperFallbackUrl?.trim() ??
    getTechFallbackImage(product.tech as TechType);

  return {
    displayName,
    imageUrl,
    storageLabel: formatStorageLabel(product.storage),
    detectedColor,
    scraperFallbackUrl,
  };
}

/** Laptops permitidos no lançamento: MacBook M1/M2/M3, ThinkPad, Latitude. */
export function isLaunchLaptopModel(model: string): boolean {
  const m = (model ?? "").toLowerCase();
  if (m.includes("macbook") && (/\bm[123]\b/.test(m) || /\bm1\b|\bm2\b|\bm3\b/.test(m))) {
    return true;
  }
  if (m.includes("thinkpad")) return true;
  if (m.includes("latitude")) return true;
  return false;
}

export function isAllowedAppleSmartphone(model: string): boolean {
  const cleaned = cleanBaseModel(model).toLowerCase();
  if (cleaned.includes("iphone se (2020)") || cleaned.includes("iphone se (2022)")) return true;
  if (/iphone\s*se/i.test(model) && (model.includes("2020") || model.includes("2022"))) return true;
  return true;
}
