import fs from "fs";
import path from "path";

import { resolveScrapedAvailability } from "./product-availability";
import type { ProductSource, ScrapedProduct } from "./types";

/**
 * Fontes activas alimentadas pelos scrapers Python.
 * O catálogo centralizado vive em `data/all_products.json` (chave `products`).
 *
 * Para adicionar uma loja:
 * 1. Correr o scraper → merge_and_clean gera all_products.json
 * 2. Adicionar o slug em ACTIVE_SOURCES
 * 3. Registar label + logo em lib/stores.ts
 */
export const ACTIVE_SOURCES: ProductSource[] = [
  "iservices",
  "refurbed",
  "swappie",
  "certideal",
  "callphone",
];

export type ScraperCatalogMeta = {
  sources: ProductSource[];
  totalProducts: number;
  lastScraped: string | null;
  brandCounts: Record<string, number>;
  loadedAt: string;
};

type AllProductsFile = {
  merged_at?: string;
  total_products?: number;
  products?: ScrapedProduct[];
};

let cachedAllProducts: AllProductsFile | null | undefined;

export function getScraperDataDir(): string {
  const candidates = [
    path.join(process.cwd(), "data"),
    path.join(process.cwd(), "..", "data"),
  ];

  for (const dir of candidates) {
    if (fs.existsSync(dir)) return dir;
  }

  return candidates[0];
}

function getAllProductsFilePath(): string {
  return path.join(getScraperDataDir(), "all_products.json");
}

function loadAllProductsPayload(): AllProductsFile | null {
  if (cachedAllProducts !== undefined) return cachedAllProducts;

  const filePath = getAllProductsFilePath();
  if (!fs.existsSync(filePath)) {
    cachedAllProducts = null;
    return null;
  }

  try {
    cachedAllProducts = JSON.parse(fs.readFileSync(filePath, "utf-8")) as AllProductsFile;
    if (!cachedAllProducts || !Array.isArray(cachedAllProducts.products)) {
      cachedAllProducts = null;
    }
  } catch {
    cachedAllProducts = null;
  }

  return cachedAllProducts;
}

export function loadAllScrapedProducts(): ScrapedProduct[] {
  const payload = loadAllProductsPayload();
  return payload?.products ?? [];
}

export function loadScrapedProducts(source: ProductSource): ScrapedProduct[] {
  return loadAllScrapedProducts().filter((product) => product.source === source);
}

export function getScraperCatalogMeta(): ScraperCatalogMeta {
  const payload = loadAllProductsPayload();
  const products = payload?.products ?? [];
  const availableProducts = products.filter((product) => resolveScrapedAvailability(product));

  const brandCounts: Record<string, number> = {};
  for (const product of availableProducts) {
    const brand = product?.brand ?? "Outros";
    brandCounts[brand] = (brandCounts[brand] ?? 0) + 1;
  }

  let lastScraped = payload?.merged_at ?? null;
  const summaryPath = path.join(getScraperDataDir(), "last_run_summary.json");
  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8")) as {
        run_at?: string;
      };
      if (summary.run_at && (!lastScraped || summary.run_at > lastScraped)) {
        lastScraped = summary.run_at;
      }
    } catch {
      // ignore corrupt summary
    }
  }

  return {
    sources: ACTIVE_SOURCES,
    totalProducts: availableProducts.length,
    lastScraped,
    brandCounts,
    loadedAt: new Date().toISOString(),
  };
}
