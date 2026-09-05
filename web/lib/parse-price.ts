/**
 * Parser de preços PT/EUR — espelha scrapers/common.py.
 * Garante que milhares com espaço ou ponto (ex. "1 139,00 €") não são truncados.
 */

import { parseStorageGb } from "./storage";

const MIN_PRICE: Record<string, number> = {
  iphones: 80,
  ipads: 100,
  macs: 200,
  apple_watch: 80,
  tablets: 80,
  tablet: 80,
  smartphone: 80,
  laptops: 150,
  samsung_phones: 80,
  google_phones: 80,
  huawei_phones: 60,
  xiaomi_phones: 60,
  oneplus_phones: 80,
};

function normalizePriceText(text: string): string {
  return text.replace(/\xa0/g, " ").replace(/\u202f/g, " ").trim();
}

function ptAmountToFloat(raw: string): number | null {
  let cleaned = raw.trim();
  if (!cleaned) return null;
  cleaned = cleaned.replace(/(?<=\d)[.\s](?=\d{3}(?:[,\s]|$))/g, "");
  cleaned = cleaned.replace(",", ".");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) ? value : null;
}

/** Extrai o último valor monetário PT/EUR de um texto. */
export function parsePtEurAmount(text: string | null | undefined): number | null {
  if (!text) return null;
  const cleaned = normalizePriceText(text);
  const pattern =
    /\d{1,3}(?:[.\s]\d{3})+,\d{2}|\d+,\d{2}|\d{1,3}(?:[.\s]\d{3})+(?!\d)|\d+(?:\.\d{2})?/g;
  const amounts: number[] = [];
  for (const match of cleaned.matchAll(pattern)) {
    const value = ptAmountToFloat(match[0]);
    if (value !== null) amounts.push(value);
  }
  return amounts.length ? amounts.at(-1)! : null;
}

function storageGb(storage: string | null | undefined): number | null {
  return parseStorageGb(storage);
}

/** Rejeita preços claramente truncados (ex. iPad Pro 512GB a 139€ em vez de 1139€). */
export function isLikelyTruncatedPrice(
  model: string,
  storage: string | null | undefined,
  price: number,
): boolean {
  const m = model.toLowerCase();
  const gb = storageGb(storage);

  if (m.includes("ipad pro") && gb !== null && gb >= 512 && price < 700) return true;
  if (m.includes("ipad pro") && m.includes("2024") && price < 500) return true;
  if (m.includes("macbook pro") && price < 450) return true;
  if (m.includes("iphone") && m.includes("pro max") && gb !== null && gb >= 512 && price < 500) {
    return true;
  }
  if (m.includes("galaxy z fold") && price < 600) return true;

  return false;
}

/** Normaliza e valida preço vindo dos scrapers antes de exibir. */
export function normalizeScrapedPrice(
  price: number | string | null | undefined,
  model: string,
  storage: string | null | undefined,
  category: string,
): number | null {
  let numeric: number | null = null;

  if (typeof price === "number" && Number.isFinite(price)) {
    numeric = price;
  } else if (typeof price === "string") {
    numeric = parsePtEurAmount(price);
  }

  if (numeric === null || !Number.isFinite(numeric)) return null;
  if (numeric < 30 || numeric > 3000) return null;
  if (numeric >= 2010 && numeric <= 2035 && Math.abs(numeric - Math.round(numeric)) < 0.01) {
    return null;
  }

  const floor = MIN_PRICE[category] ?? 50;
  if (numeric < floor) return null;
  if (isLikelyTruncatedPrice(model, storage, numeric)) return null;

  return numeric;
}
