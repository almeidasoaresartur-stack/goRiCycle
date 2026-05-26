import type { NormalizedGrade, ProductSource, ScrapedProduct } from "./types";
import { makeAffiliateUrl } from "./affiliate";
import { inferBrand } from "./inference";
import { getStoreInfo } from "./stores";

export type GradeTier = "Premium" | "Excelente" | "Bom";

export type TechType = "smartphones" | "laptops" | "wearables";

export type ProductListing = {
  id: string;
  model: string;
  brand: string | null;
  category: string;
  tech: TechType;
  storage: string | null;
  grade: NormalizedGrade;
  gradeTier: GradeTier;
  price: number;
  store: string;
  storeSlug: ProductSource;
  url: string;
  imageUrl: string | null;
  warrantyMonths: number;
  scrapedAt: string | null;
};

/** Produto agregado: menor preço real entre lojas para o mesmo modelo/capacidade/estado. */
export type AggregatedProduct = {
  id: string;
  model: string;
  brand: string | null;
  tech: TechType;
  storage: string | null;
  grade: NormalizedGrade;
  gradeTier: GradeTier;
  minPrice: number;
  bestListing: ProductListing;
  offers: ProductListing[];
  imageUrl: string | null;
  storeCount: number;
};

export type MarketplaceFilters = {
  tech?: string | null;
  brand?: string | null;
  model?: string | null;
  storage?: string | null;
  grade?: string | null;
  q?: string | null;
};

export type FilterOptions = {
  brands: string[];
  models: string[];
  storages: string[];
};

function storeLabel(source: ProductSource): string {
  return getStoreInfo(source)?.label ?? source;
}

const GRADE_MAP: Record<string, NormalizedGrade> = {
  premium: "Premium",
  excelente: "Excelente",
  "muito bom": "Muito Bom",
  bom: "Bom",
  correcto: "Bom",
  correto: "Bom",
};

export const TECH_TYPES: { id: TechType; label: string; icon: string }[] = [
  { id: "smartphones", label: "Smartphones", icon: "📱" },
  { id: "laptops", label: "Laptops", icon: "💻" },
  { id: "wearables", label: "Wearables", icon: "⌚" },
];

export const BRAND_OPTIONS = ["Apple", "Samsung", "Huawei", "Google", "Xiaomi", "OnePlus"] as const;

export const STORAGE_OPTIONS = ["128GB", "256GB", "512GB"] as const;

export const GRADE_TIER_OPTIONS: { id: GradeTier; label: string; emoji: string }[] = [
  { id: "Premium", label: "Premium", emoji: "✨" },
  { id: "Excelente", label: "Excelente", emoji: "👍" },
  { id: "Bom", label: "Bom", emoji: "🌱" },
];

const TECH_CATEGORIES: Record<TechType, string[]> = {
  smartphones: [
    "iphones",
    "samsung_phones",
    "google_phones",
    "huawei_phones",
    "xiaomi_phones",
    "oneplus_phones",
  ],
  laptops: ["macs", "laptops"],
  wearables: ["apple_watch"],
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

const PLACEHOLDER_IMAGES: Record<TechType, string> = {
  smartphones:
    "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=400&h=400&fit=crop&q=80",
  laptops:
    "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=400&h=400&fit=crop&q=80",
  wearables:
    "https://images.unsplash.com/photo-1579586337278-3bef891a6597?w=400&h=400&fit=crop&q=80",
};

function safeStr(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

function safePrice(value: number | null | undefined, category: string): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const floor = MIN_PRICE[category] ?? 50;
  return value >= floor ? value : null;
}

function normalizeGrade(grade: string | null | undefined): NormalizedGrade {
  if (!grade) return "Bom";
  const key = grade.toLowerCase().trim();
  return GRADE_MAP[key] ?? "Bom";
}

export function toGradeTier(grade: NormalizedGrade): GradeTier {
  if (grade === "Premium") return "Premium";
  if (grade === "Excelente" || grade === "Muito Bom") return "Excelente";
  return "Bom";
}

function categoryToTech(category: string | null | undefined): TechType | null {
  const cat = safeStr(category);
  if (!cat) return null;
  for (const [tech, cats] of Object.entries(TECH_CATEGORIES) as [TechType, string[]][]) {
    if (cats.includes(cat)) return tech;
  }
  return null;
}

function normalizeModel(text: string): string {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function keywordMatches(listing: ProductListing, keyword: string): boolean {
  const k = normalizeModel(keyword);
  if (!k) return true;
  const haystack = normalizeModel(
    [listing.model, listing.brand ?? "", listing.storage ?? ""].join(" "),
  );
  return haystack.includes(k);
}

export function scraperProductToListing(product: ScrapedProduct): ProductListing | null {
  const category = safeStr(product?.category);
  const tech = categoryToTech(category);
  const price = safePrice(product?.price, category);
  const model = safeStr(product?.model);
  const source = product?.source as ProductSource | undefined;

  if (!tech || !price || !model || !source || !getStoreInfo(source)) return null;

  const grade = normalizeGrade(product?.grade);
  const brand = safeStr(product?.brand) || inferBrand(model) || null;

  return {
    id: safeStr(product?.product_id) || `${source}-${model}-${price}`,
    model,
    brand,
    category,
    tech,
    storage: safeStr(product?.storage) || null,
    grade,
    gradeTier: toGradeTier(grade),
    price,
    store: storeLabel(source),
    storeSlug: source,
    url: makeAffiliateUrl(product) || safeStr(product?.url) || "#",
    imageUrl: safeStr(product?.image_url) || PLACEHOLDER_IMAGES[tech],
    warrantyMonths:
      typeof product?.warranty_months === "number" && product.warranty_months > 0
        ? product.warranty_months
        : 12,
    scrapedAt: safeStr(product?.scraped_at) || null,
  };
}

function listingGroupKey(item: ProductListing): string {
  return [
    item.tech,
    item.brand?.toLowerCase() ?? "",
    normalizeModel(item.model),
    item.storage?.toUpperCase() ?? "",
    item.gradeTier,
  ].join("|");
}

export function aggregateListings(listings: ProductListing[]): AggregatedProduct[] {
  const groups = new Map<string, ProductListing[]>();

  for (const item of listings ?? []) {
    if (!item?.id || typeof item.price !== "number" || !Number.isFinite(item.price)) continue;
    const key = listingGroupKey(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  const aggregated: AggregatedProduct[] = [];

  for (const [key, offers] of groups) {
    const sorted = [...offers].sort((a, b) => a.price - b.price);
    const best = sorted[0];
    if (!best) continue;

    aggregated.push({
      id: key,
      model: best.model,
      brand: best.brand,
      tech: best.tech,
      storage: best.storage,
      grade: best.grade,
      gradeTier: best.gradeTier,
      minPrice: best.price,
      bestListing: best,
      offers: sorted,
      imageUrl: best.imageUrl,
      storeCount: sorted.length,
    });
  }

  return aggregated.sort((a, b) => a.minPrice - b.minPrice);
}

export function filterAggregatedProducts(
  products: AggregatedProduct[],
  filters: MarketplaceFilters,
): AggregatedProduct[] {
  const tech = safeStr(filters.tech) as TechType | "";
  const brand = safeStr(filters.brand);
  const model = safeStr(filters.model);
  const storage = safeStr(filters.storage).toUpperCase();
  const grade = safeStr(filters.grade) as GradeTier | "";
  const q = safeStr(filters.q);

  return (products ?? []).filter((item) => {
    if (!item?.id || typeof item.minPrice !== "number") return false;
    if (tech && item.tech !== tech) return false;
    if (brand && item.brand?.toLowerCase() !== brand.toLowerCase()) return false;
    if (model && !normalizeModel(item.model).includes(normalizeModel(model))) return false;
    if (storage && item.storage?.toUpperCase() !== storage) return false;
    if (grade && item.gradeTier !== grade) return false;
    if (q && !keywordMatches(item.bestListing, q)) return false;
    return true;
  });
}

export function buildFilterOptionsFromAggregated(products: AggregatedProduct[]): FilterOptions {
  return buildFilterOptions(products.map((p) => p.bestListing));
}

export function computeMinPrice(products: AggregatedProduct[]): number | null {
  const prices = (products ?? [])
    .map((p) => p?.minPrice)
    .filter((v): v is number => typeof v === "number" && Number.isFinite(v));
  return prices.length ? Math.min(...prices) : null;
}

export function filterListings(
  listings: ProductListing[],
  filters: MarketplaceFilters,
): ProductListing[] {
  const tech = safeStr(filters.tech) as TechType | "";
  const brand = safeStr(filters.brand);
  const model = safeStr(filters.model);
  const storage = safeStr(filters.storage).toUpperCase();
  const grade = safeStr(filters.grade) as GradeTier | "";
  const q = safeStr(filters.q);

  return listings.filter((item) => {
    if (!item?.id || !item?.price) return false;
    if (tech && item.tech !== tech) return false;
    if (brand && item.brand?.toLowerCase() !== brand.toLowerCase()) return false;
    if (model && !normalizeModel(item.model).includes(normalizeModel(model))) return false;
    if (storage && item.storage?.toUpperCase() !== storage) return false;
    if (grade && item.gradeTier !== grade) return false;
    if (q && !keywordMatches(item, q)) return false;
    return true;
  });
}

export function buildFilterOptions(listings: ProductListing[]): FilterOptions {
  const brands = new Set<string>();
  const models = new Set<string>();
  const storages = new Set<string>();

  for (const item of listings ?? []) {
    if (item?.brand) brands.add(item.brand);
    if (item?.model) models.add(item.model);
    if (item?.storage) storages.add(item.storage.toUpperCase());
  }

  return {
    brands: [...brands].sort((a, b) => a.localeCompare(b, "pt")),
    models: [...models].sort((a, b) => a.localeCompare(b, "pt")).slice(0, 40),
    storages: STORAGE_OPTIONS.filter((s) => storages.has(s) || storages.size === 0),
  };
}

export function parseMarketplaceFilters(params: Record<string, string | undefined>): MarketplaceFilters {
  return {
    tech: params.tech ?? "smartphones",
    brand: params.brand ?? null,
    model: params.model ?? null,
    storage: params.storage ?? null,
    grade: params.grade ?? null,
    q: params.q ?? null,
  };
}

export function inferModelFromQuery(q: string): string | null {
  const trimmed = (q ?? "").trim();
  const storageMatch = trimmed.match(/(\d+\s*GB)/i);
  const modelPart = trimmed.replace(/(\d+\s*GB)/i, "").trim();
  return modelPart || null;
}
