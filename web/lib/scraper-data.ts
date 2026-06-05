import fs from "fs";
import path from "path";

import type { ProductSource, ProductsFile, ScrapedProduct } from "./types";

/**
 * Fontes activas alimentadas pelos scrapers Python.
 * Cada fonte corresponde a `data/{source}_produtos.json` na raiz do monorepo.
 *
 * Para adicionar uma loja:
 * 1. Correr o scraper → gera o JSON em ../data/
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

export function getProductsFilePath(source: ProductSource): string {
  return path.join(getScraperDataDir(), `${source}_produtos.json`);
}

export function loadProductsFile(source: ProductSource): ProductsFile | null {
  const filePath = getProductsFilePath(source);
  if (!fs.existsSync(filePath)) return null;

  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf-8")) as ProductsFile;
    if (!raw || !Array.isArray(raw.products)) return null;
    return raw;
  } catch {
    return null;
  }
}

export function loadScrapedProducts(source: ProductSource): ScrapedProduct[] {
  const file = loadProductsFile(source);
  return file?.products ?? [];
}

export function loadAllScrapedProducts(): ScrapedProduct[] {
  const all: ScrapedProduct[] = [];

  for (const source of ACTIVE_SOURCES) {
    all.push(...loadScrapedProducts(source));
  }

  return all;
}

export function getScraperCatalogMeta(): ScraperCatalogMeta {
  let totalProducts = 0;
  let lastScraped: string | null = null;
  const brandCounts: Record<string, number> = {};

  const summaryPath = path.join(getScraperDataDir(), "last_run_summary.json");
  if (fs.existsSync(summaryPath)) {
    try {
      const summary = JSON.parse(fs.readFileSync(summaryPath, "utf-8")) as {
        run_at?: string;
      };
      if (summary.run_at) lastScraped = summary.run_at;
    } catch {
      // ignore corrupt summary
    }
  }

  for (const source of ACTIVE_SOURCES) {
    const file = loadProductsFile(source);
    if (!file) continue;

    const products = file.products ?? [];
    totalProducts += products.length;

    for (const product of products) {
      const brand = product?.brand ?? "Outros";
      brandCounts[brand] = (brandCounts[brand] ?? 0) + 1;
    }

    if (file.scraped_at && (!lastScraped || file.scraped_at > lastScraped)) {
      lastScraped = file.scraped_at;
    }
  }

  return {
    sources: ACTIVE_SOURCES,
    totalProducts,
    lastScraped,
    brandCounts,
    loadedAt: new Date().toISOString(),
  };
}
