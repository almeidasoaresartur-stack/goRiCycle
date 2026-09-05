import type { StoreOffer } from "@/components/ComparatorSection";
import type { NormalizedGrade, ProductSource, ScrapedProduct } from "./types";
import { inferBrand, inferCategory, parseSearchQuery, inferTechFromQuery } from "./inference";
import { getAllListings } from "./load-listings";
import { modelMatches } from "./model-matching";
import { cleanBaseModel } from "./product-display";
import { generateExactProductUrl } from "./product-urls";
import { ACTIVE_SOURCES, loadAllScrapedProducts, getScraperCatalogMeta } from "./scraper-data";
import { getStoreInfo } from "./stores";

const GRADE_MAP: Record<string, NormalizedGrade> = {
  premium: "Premium",
  excelente: "Excelente",
  "muito bom": "Muito Bom",
  bom: "Bom",
  correcto: "Bom",
  correto: "Bom",
};

const MIN_PRICE: Record<string, number> = {
  iphones: 80,
  ipads: 100,
  macs: 200,
  apple_watch: 80,
  tablets: 80,
  laptops: 150,
  samsung_phones: 80,
  google_phones: 80,
  huawei_phones: 60,
  xiaomi_phones: 60,
  oneplus_phones: 80,
};

function normalizeGrade(grade: string | null): NormalizedGrade {
  if (!grade) return "Bom";
  const key = grade.toLowerCase().trim();
  return GRADE_MAP[key] ?? "Bom";
}

function isValidPrice(product: ScrapedProduct, category: string): boolean {
  const floor = MIN_PRICE[category] ?? 50;
  return typeof product?.price === "number" && product.price >= floor;
}

function brandMatches(product: ScrapedProduct, searchModel: string): boolean {
  const expected = inferBrand(searchModel);
  if (!expected || !product.brand) return true;
  return product.brand.toLowerCase() === expected.toLowerCase();
}

function storageMatches(productStorage: string | null, searchStorage: string | null): boolean {
  if (!searchStorage) return true;
  if (!productStorage) return true;
  return productStorage.toUpperCase() === searchStorage.toUpperCase();
}

function toStoreOffer(product: ScrapedProduct | null | undefined): StoreOffer | null {
  if (!product?.product_id || !product?.source) return null;

  const price = typeof product.price === "number" && Number.isFinite(product.price) ? product.price : null;
  if (price == null) return null;

  const source = product.source;
  if (!getStoreInfo(source)) return null;

  return {
    id: product.product_id,
    store: getStoreInfo(source)?.label ?? source,
    storeSlug: source,
    grade: normalizeGrade(product.grade),
    price,
    currency: "EUR",
    warrantyMonths:
      typeof product.warranty_months === "number" && product.warranty_months > 0
        ? product.warranty_months
        : 12,
    url: generateExactProductUrl({
      store: source,
      model: product.model,
      storage: product.storage,
      url: product.url,
      affiliateEnabled: Boolean(product.affiliate_enabled),
    }),
    affiliateEnabled: Boolean(product.affiliate_enabled),
    brand: product.brand ?? null,
  };
}

export function getComparisonOffers(
  model: string,
  storage: string | null,
  category?: string | null,
): StoreOffer[] {
  if (!model?.trim()) return [];

  const cat = category ?? inferCategory(model);
  const all = loadAllScrapedProducts();

  const matched = all.filter(
    (p) =>
      p?.category === cat &&
      isValidPrice(p, cat) &&
      brandMatches(p, model) &&
      modelMatches(p?.model, model) &&
      storageMatches(p?.storage ?? null, storage),
  );

  const bestBySource = new Map<ProductSource, ScrapedProduct>();
  for (const product of matched) {
    if (!product?.source) continue;
    const prev = bestBySource.get(product.source);
    if (!prev || (product.price ?? Infinity) < (prev.price ?? Infinity)) {
      bestBySource.set(product.source, product);
    }
  }

  return ACTIVE_SOURCES.map((s) => toStoreOffer(bestBySource.get(s))).filter(
    (o): o is StoreOffer => o != null,
  );
}

export function getCatalogStats(): {
  /** Available scraped listings (ofertas), not unique PDP slugs. */
  totalProducts: number;
  /** Unique base models among indexable marketplace listings. */
  uniqueModels: number;
  lastScraped: string | null;
  brandCounts: Record<string, number>;
} {
  const meta = getScraperCatalogMeta();
  const uniqueModels = new Set(
    getAllListings().map((listing) => cleanBaseModel(listing.model)),
  ).size;
  return {
    totalProducts: meta.totalProducts,
    uniqueModels,
    lastScraped: meta.lastScraped,
    brandCounts: meta.brandCounts,
  };
}

export function getAvailableBrands(): string[] {
  const { brandCounts } = getCatalogStats();
  const priority = ["Apple", "Samsung", "Google"];
  return priority.filter((b) => (brandCounts[b] ?? 0) > 0);
}

export { inferBrand, inferCategory, parseSearchQuery, inferTechFromQuery };
