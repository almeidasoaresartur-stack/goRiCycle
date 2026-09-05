import type { AggregatedProduct } from "./marketplace";
import { getProductImage, techToImageCategory } from "./productImages";
import { MIN_SLUG_STORAGE_GB, parseStorageGb } from "./storage";

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

/** Cores e termos removidos ao normalizar opções do dropdown de modelos. */
const FILTER_MODEL_COLOR_TERMS = [
  "cor surpresa",
  "verde meia-noite",
  "verde meia noite",
  "azul pacífico",
  "azul pacifico",
  "cinzento sideral",
  "cinzentos sideral",
  "space gray",
  "space grey",
  "midnight green",
  "pacific blue",
  "grafite",
  "branco",
  "preto",
  "azul",
  "roxo",
  "verde",
  "vermelho",
  "dourado",
  "prateado",
  "amarelo",
  "coral",
  "rosa",
  "black",
  "white",
  "purple",
  "red",
  "gold",
  "silver",
  "esim",
] as const;

function stripFilterModelNoise(raw: string): string {
  let name = (raw ?? "").trim();
  if (!name) return "";

  name = name.replace(/\b\d+\s*gb\b/gi, " ").replace(/\b\d+gb\b/gi, " ");
  name = name.replace(/\([^)]*\)/g, " ");

  const terms = [...FILTER_MODEL_COLOR_TERMS].sort((a, b) => b.length - a.length);
  for (const term of terms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    name = name.replace(new RegExp(`\\b${escaped}\\b`, "gi"), " ");
  }

  return name.replace(/\s{2,}/g, " ").trim();
}

/** Nome base único para o dropdown de modelos (sem capacidade/cor). */
export function normalizeModelForFilter(raw: string): string {
  const stripped = stripFilterModelNoise(raw);
  const base = cleanBaseModel(stripped || raw);
  return base.replace(/\s{2,}/g, " ").trim();
}

/** Pesquisa rápida no dropdown de modelos (substring case-insensitive). */
export function modelMatchesFilterSearch(model: string, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return model.toLowerCase().includes(q);
}

function compareFilterModelNames(a: string, b: string): number {
  return a.localeCompare(b, "pt", { numeric: true, sensitivity: "base" });
}

export function sortFilterModelNames(models: Iterable<string>): string[] {
  return [...new Set([...models].map((m) => m.trim()).filter(Boolean))].sort(
    compareFilterModelNames,
  );
}

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

  const iphoneLegacy = name.match(/iphone\s*(?:xs\s*max|xs|xr|x|air)\b/i);
  if (iphoneLegacy) {
    return iphoneLegacy[0]
      .replace(/\s{2,}/g, " ")
      .replace(/^iphone/i, "iPhone")
      .replace(/\bxs\s*max/i, "XS Max")
      .replace(/\bxs/i, "XS")
      .replace(/\bxr/i, "XR")
      .replace(/\bair\b/i, "Air")
      .replace(/\bx\b/i, "X")
      .trim();
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

  // Normalizar "SAMSUNG S23" / "Samsung S24 Ultra" sem prefixo Galaxy
  if (/samsung\s+(?:galaxy\s*)?s\d/i.test(name) && !/galaxy\s*s/i.test(name)) {
    name = name.replace(/^samsung\s+/i, "Samsung Galaxy ");
  }

  const galaxyFold = name.match(/(?:samsung\s+)?galaxy\s*z\s*fold\s*\d+/i);
  if (galaxyFold) {
    return galaxyFold[0]
      .replace(/^samsung\s+/i, "")
      .replace(/\s{2,}/g, " ")
      .replace(/^galaxy/i, "Galaxy")
      .trim();
  }

  const galaxyTab = name.match(/(?:samsung\s+)?galaxy\s*tab\s*[a-z0-9\s]*/i);
  if (galaxyTab) {
    return galaxyTab[0]
      .replace(/^samsung\s+/i, "Samsung ")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  const galaxy = name.match(/(?:samsung\s+)?galaxy\s*s\d+(?:\s*ultra|\s*plus|\s*fe|\+)?/i);
  if (galaxy) {
    return galaxy[0]
      .replace(/^samsung\s+/i, "")
      .replace(/\s{2,}/g, " ")
      .replace(/^galaxy/i, "Galaxy")
      .trim();
  }

  const pixel = name.match(/(?:google\s+)?pixel\s*\d+(?:\s*pro\s*fold|\s*pro|\s*a|\s*fold)?/i);
  if (pixel) {
    return pixel[0]
      .replace(/^google\s+/i, "")
      .replace(/^pixel/i, "Pixel")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

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

/** Alt text padrão para imagens de produto (modelo + armazenamento + loja). */
export function productImageAlt(
  model: string,
  storage: string | null | undefined,
  store: string,
): string {
  const modelPart = cleanBaseModel(model);
  const storageLabel = formatStorageLabel(storage);
  if (storageLabel && storageLabel !== "NFPM*") {
    return `${modelPart} ${storageLabel} recondicionado - ${store}`;
  }
  return `${modelPart} recondicionado - ${store}`;
}

export function formatStorageLabel(storage: string | null | undefined): string {
  const gb = parseStorageGb(storage);
  if (gb == null || gb < MIN_SLUG_STORAGE_GB) return "NFPM*";
  return `${gb}GB`;
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
