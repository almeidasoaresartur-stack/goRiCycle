import type { AggregatedProduct } from "./marketplace";
import { getProductImage, techToImageCategory } from "./productImages";

export type CleanProductData = {
  displayName: string;
  imageUrl: string;
  storageLabel: string;
  scraperFallbackUrl: string | null;
};

const NOISE_PATTERNS = [
  /\brecondicionad[oa]s?\b/gi,
  /\bgrade\s*[a-d]\b/gi,
  /\b(premium|excelente|muito bom|bom|correcto|correto)\b/gi,
  /\b(novo|usado|semi[- ]?novo)\b/gi,
  /\b(refurbished|renewed)\b/gi,
];

function formatIpadDisplayName(name: string): string | null {
  const match = name.match(
    /ipad(?:\s+(?:pro|air|mini))?(?:\s*\(\d{4}\))?(?:\s*[\d.]+\s*(?:["″'']|pol|mm)?)?/i,
  );
  if (!match) return null;

  let result = match[0].trim();
  result = result
    .replace(/^ipad/i, "iPad")
    .replace(/\s+pro\b/i, " Pro")
    .replace(/\s+air\b/i, " Air")
    .replace(/\s+mini\b/i, " Mini")
    .replace(/\s*([\d.]+)\s*(?:["″'']|pol)\b/i, ' $1"')
    .replace(/\s{2,}/g, " ")
    .trim();

  return result;
}

function formatMacbookDisplayName(name: string): string | null {
  const match = name.match(
    /macbook(?:\s+(?:pro|air))?(?:\s*[\d.]+\s*(?:["″'']|pol)?)?(?:\s*\(\d{4}\))?(?:\s*\d{4})?(?:\s*m[1-4]\b)?/i,
  );
  if (!match) return null;

  return match[0]
    .replace(/^macbook/i, "MacBook")
    .replace(/\s+pro\b/i, " Pro")
    .replace(/\s+air\b/i, " Air")
    .replace(/\s*([\d.]+)\s*(?:["″'']|pol)\b/i, ' $1"')
    .replace(/\s{2,}/g, " ")
    .trim();
}

/** Extrai apenas o modelo base legível para o cartão. */
export function cleanBaseModel(raw: string): string {
  let name = (raw ?? "").trim();
  if (!name) return "Modelo desconhecido";

  name = name.split(/\s[-–|]\s/)[0]?.trim() ?? name;

  for (const pattern of NOISE_PATTERNS) {
    name = name.replace(pattern, " ");
  }

  // Capacidade só fora do nome base (mantém GB no URL/filtros via storage)
  name = name.replace(/\b\d+\s*gb\b/gi, " ");

  name = name.replace(/\(\s*\)/g, "").replace(/\s{2,}/g, " ").trim();

  if (/iphone\s*se/i.test(name)) {
    // 2022 antes de 2020 — "SE 2022" contém "SE 2" e não deve cair no bucket de 2020
    if (/2022|se\s*3\b|3rd|3ª/i.test(raw)) return "iPhone SE (2022)";
    if (/2020|se\s*2\b|2nd|2ª/i.test(raw)) return "iPhone SE (2020)";
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

  const ipad = formatIpadDisplayName(name);
  if (ipad) return ipad;

  const macbook = formatMacbookDisplayName(name);
  if (macbook) return macbook;

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

export function getCleanProductData(product: AggregatedProduct): CleanProductData {
  const rawModel = product.model ?? product.bestListing?.model ?? "";
  const displayName = cleanBaseModel(rawModel);
  const imageUrl = getProductImage(rawModel, techToImageCategory(product.tech));

  return {
    displayName,
    imageUrl,
    storageLabel: formatStorageLabel(product.storage),
    scraperFallbackUrl: null,
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
