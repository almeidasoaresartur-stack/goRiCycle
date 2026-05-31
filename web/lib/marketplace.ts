import type { NormalizedGrade, ProductSource, ScrapedProduct } from "./types";
import { generateExactProductUrl } from "./product-urls";
import { inferBrand } from "./inference";
import { getStoreInfo, STORES } from "./stores";
import { normalizeScrapedPrice } from "./parse-price";
import { cleanBaseModel } from "./product-display";
import { getProductImage, isInOfficialCatalog, techToImageCategory } from "./productImages";
import {
  isRelevantForHighlights,
  modelMatches,
  productMatchesSearchText,
} from "./model-matching";

export type GradeTier = "Premium" | "Excelente" | "Bom";

export type TechType = "smartphones" | "tablets" | "laptops" | "wearables";

/** Categorias visíveis no site (foco smartphones + tablets). */
export const LAUNCH_TECH_TYPES: TechType[] = ["smartphones", "tablets"];

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
  color: string | null;
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
  color: string | null;
};

export type MarketplaceFilters = {
  tech?: string | null;
  brand?: string | null;
  model?: string | null;
  storage?: string | null;
  grade?: string | null;
  color?: string | null;
  q?: string | null;
  /** Slugs de lojas parceiras (seleção múltipla). */
  stores?: ProductSource[] | null;
};

export type FilterOptions = {
  brands: string[];
  models: string[];
  storages: string[];
  colors: string[];
  stores: ProductSource[];
};

const PARTNER_STORE_ORDER = Object.keys(STORES) as ProductSource[];

function parseStoreSlugs(raw: string | null | undefined): ProductSource[] {
  if (!raw?.trim()) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter((s): s is ProductSource => s in STORES);
}

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
  { id: "tablets", label: "Tablets", icon: "🖥️" },
];

export function filterLaunchProducts(products: AggregatedProduct[]): AggregatedProduct[] {
  return (products ?? []).filter((p) => p.tech === "smartphones" || p.tech === "tablets");
}

export const BRAND_OPTIONS = ["Apple", "Samsung", "Google"] as const;

const ALLOWED_BRAND_KEYWORDS = [
  "iphone",
  "ipad",
  "macbook",
  "airpods",
  "samsung",
  "galaxy",
  "google",
  "pixel",
] as const;

export function isAllowedBrand(model: string | null | undefined): boolean {
  const modelLower = (model ?? "").toLowerCase();
  return ALLOWED_BRAND_KEYWORDS.some((kw) => modelLower.includes(kw));
}

export const STORAGE_OPTIONS = ["32GB", "64GB", "128GB", "256GB", "512GB"] as const;

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
  ],
  tablets: ["ipads", "tablets"],
  laptops: ["macs", "laptops"],
  wearables: ["apple_watch"],
};

const PLACEHOLDER_IMAGES: Record<TechType, string> = {
  smartphones: "/images/products/iphone-14.png",
  tablets: "/images/products/ipad-109-2022-10-gerao.jpg",
  laptops: "/images/products/macbook-air-13-2022.jpg",
  wearables: "/images/products/apple-watch-series-9-alumnio-41-mm-2023.jpg",
};

function safeStr(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

export function resolveProductBrand(product: {
  brand?: string | null;
  model: string;
}): string | null {
  return safeStr(product.brand) || inferBrand(product.model) || null;
}

function safePrice(
  value: number | string | null | undefined,
  category: string,
  model: string,
  storage: string | null | undefined,
): number | null {
  return normalizeScrapedPrice(value, model, storage, category);
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
  return text
    .toLowerCase()
    .replace(/[""″'']/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function scraperProductToListing(product: ScrapedProduct): ProductListing | null {
  if (product?.is_available === false) return null;

  const category = safeStr(product?.category);
  const tech = categoryToTech(category);
  const model = safeStr(product?.model);
  if (!isAllowedBrand(model)) return null;
  const storage = safeStr(product?.storage) || null;
  const price = safePrice(product?.price, category, model, storage);
  const source = product?.source as ProductSource | undefined;

  if (!tech || !price || !model || !source || !getStoreInfo(source)) return null;
  if (!isInOfficialCatalog(model)) return null;

  const grade = normalizeGrade(product?.grade);
  const brand = safeStr(product?.brand) || inferBrand(model) || null;
  const localImage =
    getProductImage(model, techToImageCategory(tech)) || PLACEHOLDER_IMAGES[tech];

  return {
    id: safeStr(product?.product_id) || `${source}-${model}-${price}`,
    model,
    brand,
    category,
    tech,
    storage,
    grade,
    gradeTier: toGradeTier(grade),
    price,
    store: storeLabel(source),
    storeSlug: source,
    url: generateExactProductUrl({
      store: source,
      model,
      storage,
      url: safeStr(product?.url),
      affiliateEnabled: Boolean(product?.affiliate_enabled),
    }),
    imageUrl: localImage,
    warrantyMonths:
      typeof product?.warranty_months === "number" && product.warranty_months > 0
        ? product.warranty_months
        : 12,
    scrapedAt: safeStr(product?.scraped_at) || null,
    color: safeStr(product?.color) || null,
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

/** Restringe um produto agregado às lojas seleccionadas e recalcula o melhor preço. */
export function narrowProductToStores(
  item: AggregatedProduct,
  stores: ProductSource[],
): AggregatedProduct | null {
  if (!stores.length) return item;

  const offers = (item.offers ?? []).filter((offer) => stores.includes(offer.storeSlug));
  if (!offers.length) return null;

  const sorted = [...offers].sort((a, b) => a.price - b.price);
  const best = sorted[0];
  if (!best) return null;

  return {
    ...item,
    offers: sorted,
    bestListing: best,
    minPrice: best.price,
    storeCount: sorted.length,
  };
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
      color: best.color,
    });
  }

  return aggregated.sort((a, b) => a.minPrice - b.minPrice);
}

function flattenAggregatedToListings(products: AggregatedProduct[]): ProductListing[] {
  const listings: ProductListing[] = [];

  for (const product of products ?? []) {
    if (product.offers?.length) {
      listings.push(...product.offers);
    } else if (product.bestListing) {
      listings.push(product.bestListing);
    }
  }

  return listings;
}

/**
 * Para cada combinação modelo+capacidade+estado+loja,
 * mantém apenas o produto mais barato dessa loja.
 * Resultado: no máximo 1 produto por loja para cada variante específica.
 */
export function deduplicateByBestPricePerStore(
  products: AggregatedProduct[],
): AggregatedProduct[] {
  const map = new Map<string, ProductListing>();

  for (const listing of flattenAggregatedToListings(products)) {
    const model = normalizeModel(listing.model);
    const storage = (listing.storage ?? "").toUpperCase().trim();
    const grade = (listing.gradeTier ?? "").toLowerCase().trim();
    const source = (listing.storeSlug ?? "").toLowerCase().trim();

    const key = `${model}|${storage}|${grade}|${source}`;

    const existing = map.get(key);
    if (!existing || listing.price < existing.price) {
      map.set(key, listing);
    }
  }

  return aggregateListings(Array.from(map.values()));
}

export type ProductSortOption = "relevance" | "newest" | "price_asc" | "price_desc";

function getProductFreshnessTimestamp(product: AggregatedProduct): number {
  const scrapedDates = (product.offers ?? [product.bestListing])
    .map((offer) => offer.scrapedAt)
    .filter((value): value is string => Boolean(value))
    .map((value) => Date.parse(value))
    .filter((timestamp) => Number.isFinite(timestamp));

  return scrapedDates.length ? Math.max(...scrapedDates) : 0;
}

export function sortAggregatedProducts(
  products: AggregatedProduct[],
  sort: ProductSortOption,
): AggregatedProduct[] {
  if (sort === "relevance") return products;

  const copy = [...products];
  switch (sort) {
    case "newest":
      return copy.sort((a, b) => {
        const timeDiff = getProductFreshnessTimestamp(b) - getProductFreshnessTimestamp(a);
        if (timeDiff !== 0) return timeDiff;
        return b.id.localeCompare(a.id);
      });
    case "price_asc":
      return copy.sort((a, b) => a.minPrice - b.minPrice);
    case "price_desc":
      return copy.sort((a, b) => b.minPrice - a.minPrice);
    default:
      return products;
  }
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
  const storeFilter = filters.stores ?? [];

  const filtered = (products ?? []).filter((item) => {
    if (!item?.id || typeof item.minPrice !== "number") return false;
    if (tech && item.tech !== tech) return false;
    if (brand && resolveProductBrand(item)?.toLowerCase() !== brand.toLowerCase()) return false;
    if (model && !modelMatches(item.model, model)) return false;
    if (storage && item.storage?.toUpperCase() !== storage) return false;
    if (grade && item.gradeTier !== grade) return false;
    if (q && !productMatchesSearchText({ model: item.model }, q)) return false;
    if (storeFilter.length > 0) {
      const hasStore = (item.offers ?? []).some((offer) => storeFilter.includes(offer.storeSlug));
      if (!hasStore) return false;
    }
    return true;
  });

  if (!storeFilter.length) return filtered;

  return filtered
    .map((item) => narrowProductToStores(item, storeFilter))
    .filter((item): item is AggregatedProduct => item != null);
}

export function buildFilterOptionsFromAggregated(products: AggregatedProduct[]): FilterOptions {
  const listings: ProductListing[] = [];
  const storeSlugs = new Set<ProductSource>();

  for (const product of products ?? []) {
    for (const offer of product.offers ?? []) {
      listings.push(offer);
      storeSlugs.add(offer.storeSlug);
    }
    if (!product.offers?.length && product.bestListing) {
      listings.push(product.bestListing);
      storeSlugs.add(product.bestListing.storeSlug);
    }
  }

  const base = buildFilterOptions(listings);
  return {
    ...base,
    stores: PARTNER_STORE_ORDER.filter((slug) => storeSlugs.has(slug)),
  };
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
    if (brand && resolveProductBrand(item)?.toLowerCase() !== brand.toLowerCase()) return false;
    if (model && !modelMatches(item.model, model)) return false;
    if (storage && item.storage?.toUpperCase() !== storage) return false;
    if (grade && item.gradeTier !== grade) return false;
    if (q && !productMatchesSearchText({ model: item.model }, q)) return false;
    return true;
  });
}

export function buildFilterOptions(listings: ProductListing[]): FilterOptions {
  const brands = new Set<string>();
  const models = new Set<string>();
  const storages = new Set<string>();

  for (const item of listings ?? []) {
    const resolvedBrand = item ? resolveProductBrand(item) : null;
    if (resolvedBrand) brands.add(resolvedBrand);
    if (item?.model) models.add(item.model);
    if (item?.storage) storages.add(item.storage.toUpperCase());
  }

  return {
    brands: [...brands].sort((a, b) => a.localeCompare(b, "pt")),
    models: [...models].sort((a, b) => a.localeCompare(b, "pt")).slice(0, 40),
    storages: STORAGE_OPTIONS.filter((s) => storages.has(s) || storages.size === 0),
    colors: [],
    stores: [],
  };
}

export function parseMarketplaceFilters(params: Record<string, string | undefined>): MarketplaceFilters {
  const singleStore = params.store?.trim();
  const multiStores = parseStoreSlugs(params.stores);

  let stores: ProductSource[] | null = null;
  if (singleStore && singleStore in STORES) {
    stores = [singleStore as ProductSource];
  } else if (multiStores.length) {
    stores = multiStores;
  }

  return {
    tech: params.tech ?? null,
    brand: params.brand ?? null,
    model: params.model ?? null,
    storage: params.storage ?? null,
    grade: params.grade ?? null,
    color: params.color ?? null,
    q: params.q ?? null,
    stores,
  };
}

/** Loja única seleccionada na navegação superior (`?store=refurbed`). */
export function getSelectedStore(filters: MarketplaceFilters): ProductSource | null {
  if (filters.stores?.length === 1) return filters.stores[0];
  return null;
}

export function hasActiveTechFilter(tech: string | null | undefined): tech is TechType {
  return LAUNCH_TECH_TYPES.includes(tech as TechType);
}

export function inferModelFromQuery(q: string): string | null {
  const trimmed = (q ?? "").trim();
  const storageMatch = trimmed.match(/(\d+\s*GB)/i);
  const modelPart = trimmed.replace(/(\d+\s*GB)/i, "").trim();
  return modelPart || null;
}

export function hasSpecificFilters(filters: MarketplaceFilters): boolean {
  return Boolean(
    filters.brand ||
      filters.model ||
      filters.storage ||
      filters.grade ||
      filters.q?.trim() ||
      (filters.stores?.length ?? 0) > 0 ||
      hasActiveTechFilter(filters.tech),
  );
}

export function isCatalogView(filters: MarketplaceFilters, viewAll: boolean): boolean {
  if (viewAll) return true;
  return hasSpecificFilters(filters);
}

const HIGHLIGHT_STORAGE_BY_TECH: Record<TechType, string[]> = {
  smartphones: ["128gb", "256gb", "64gb", "512gb"],
  tablets: ["256gb", "128gb", "64gb", "512gb", "32gb"],
  laptops: ["256gb", "512gb", "128gb"],
  wearables: ["32gb", "64gb"],
};

const HIGHLIGHT_GRADE_PRIORITY: GradeTier[] = ["Premium", "Excelente", "Bom"];

function highlightModelKey(model: string): string {
  return normalizeModel(cleanBaseModel(model));
}

/** Destaques: escolhe a variante mais barata entre capacidades/estados preferidos. */
export function getRepresentativeProduct(
  products: AggregatedProduct[],
  tech: TechType,
): AggregatedProduct | null {
  if (!products.length) return null;

  const preferredStorage = HIGHLIGHT_STORAGE_BY_TECH[tech] ?? HIGHLIGHT_STORAGE_BY_TECH.smartphones;
  const candidates: AggregatedProduct[] = [];

  for (const storage of preferredStorage) {
    for (const grade of HIGHLIGHT_GRADE_PRIORITY) {
      const match = products.find(
        (product) =>
          (product.storage ?? "").toLowerCase().includes(storage) &&
          product.gradeTier === grade,
      );
      if (match) candidates.push(match);
    }
  }

  const pool = candidates.length ? candidates : products;
  return [...pool].sort((a, b) => a.minPrice - b.minPrice)[0] ?? null;
}

export function buildHighlightProducts(products: AggregatedProduct[]): AggregatedProduct[] {
  const perTech = 6;
  const maxTotal = 12;

  const pickByModel = (tech: TechType) => {
    const pool = (products ?? []).filter(
      (product) => product?.tech === tech && isRelevantForHighlights(product),
    );

    const byModel = new Map<string, AggregatedProduct[]>();
    for (const product of pool) {
      const key = highlightModelKey(product.model);
      const variants = byModel.get(key) ?? [];
      variants.push(product);
      byModel.set(key, variants);
    }

    return [...byModel.values()]
      .map((variants) => getRepresentativeProduct(variants, tech))
      .filter((product): product is AggregatedProduct => product != null)
      .sort((a, b) => a.minPrice - b.minPrice)
      .slice(0, perTech);
  };

  return [...pickByModel("smartphones"), ...pickByModel("tablets")].slice(0, maxTotal);
}

export function catalogFiltersForView(
  filters: MarketplaceFilters,
  viewAll: boolean,
): MarketplaceFilters {
  if (viewAll && !hasSpecificFilters(filters)) {
    return {
      tech: null,
      brand: null,
      model: null,
      storage: null,
      grade: null,
      color: null,
      q: null,
    };
  }
  return filters;
}
