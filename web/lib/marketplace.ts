import type { NormalizedGrade, ProductSource, ScrapedProduct } from "./types";
import { generateExactProductUrl } from "./product-urls";
import { inferBrand } from "./inference";
import { getStoreInfo, STORES } from "./stores";
import { normalizeScrapedPrice } from "./parse-price";
import {
  normalizeModelForFilter,
  sortFilterModelNames,
} from "./product-display";
import { getProductImage, isInOfficialCatalog, techToImageCategory } from "./productImages";
import { modelMatches, productMatchesSearchText } from "./model-matching";
import {
  aggregatedProductIsAvailable,
  resolveScrapedAvailability,
  scrapedProductIsAvailable,
} from "./product-availability";

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
  /** false = esgotado; omitido ou true = disponível. */
  isAvailable?: boolean;
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
  isAvailable?: boolean;
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
    "smartphone",
  ],
  tablets: ["ipads", "tablets", "tablet"],
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
  if (!scrapedProductIsAvailable(product)) return null;

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
    isAvailable: resolveScrapedAvailability(product),
  };
}

/** Lojas cujo URL não fixa variante — agrupar por modelo+capacidade (ignorar grau). */
const VARIANT_AGNOSTIC_STORES: ReadonlySet<ProductSource> = new Set(["refurbed"]);

function storeGroupsByStorageOnly(storeSlug: ProductSource): boolean {
  return VARIANT_AGNOSTIC_STORES.has(storeSlug);
}

function listingGroupKey(item: ProductListing): string {
  return [
    item.tech,
    item.brand?.toLowerCase() ?? "",
    normalizeModel(item.model),
    item.storage?.toUpperCase() ?? "",
    storeGroupsByStorageOnly(item.storeSlug) ? "" : item.gradeTier,
  ].join("|");
}

/** Restringe um produto agregado às lojas seleccionadas e recalcula o melhor preço. */
export function narrowProductToStores(
  item: AggregatedProduct,
  stores: ProductSource[],
): AggregatedProduct | null {
  if (!stores.length) return item;

  const offers = (item.offers ?? [])
    .filter((offer) => stores.includes(offer.storeSlug) && offer.isAvailable !== false);
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
    isAvailable: best.isAvailable !== false,
  };
}

export function aggregateListings(listings: ProductListing[]): AggregatedProduct[] {
  const groups = new Map<string, ProductListing[]>();

  for (const item of listings ?? []) {
    if (!item?.id || typeof item.price !== "number" || !Number.isFinite(item.price)) continue;
    if (item.isAvailable === false) continue;
    const key = listingGroupKey(item);
    const group = groups.get(key) ?? [];
    group.push(item);
    groups.set(key, group);
  }

  const aggregated: AggregatedProduct[] = [];

  for (const [key, offers] of groups) {
    const availableOffers = offers.filter((offer) => offer.isAvailable !== false);
    if (!availableOffers.length) continue;

    const sorted = [...availableOffers].sort((a, b) => a.price - b.price);
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
      isAvailable: true,
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
    if (listing.isAvailable === false) continue;
    const model = normalizeModel(listing.model);
    const storage = (listing.storage ?? "").toUpperCase().trim();
    const grade = (listing.gradeTier ?? "").toLowerCase().trim();
    const source = (listing.storeSlug ?? "").toLowerCase().trim();

    const key = storeGroupsByStorageOnly(listing.storeSlug)
      ? `${model}|${storage}|${source}`
      : `${model}|${storage}|${grade}|${source}`;

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
    if (!aggregatedProductIsAvailable(item)) return false;
    if (tech && item.tech !== tech) return false;
    if (brand && resolveProductBrand(item)?.toLowerCase() !== brand.toLowerCase()) return false;
    if (
      model &&
      normalizeModelForFilter(item.model) !== model &&
      !modelMatches(item.model, model)
    ) {
      return false;
    }
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
  return buildFilterOptionsForScope(products, {});
}

function extractListingsFromAggregated(products: AggregatedProduct[]): ProductListing[] {
  const listings: ProductListing[] = [];
  const seen = new Set<string>();

  for (const product of products ?? []) {
    for (const offer of product.offers ?? []) {
      if (!offer?.id || seen.has(offer.id)) continue;
      seen.add(offer.id);
      listings.push(offer);
    }
    if (product.bestListing?.id && !seen.has(product.bestListing.id)) {
      seen.add(product.bestListing.id);
      listings.push(product.bestListing);
    }
  }

  return listings;
}

/** Opções de filtro dinâmicas — modelos reagem a tech/marca/lojas seleccionadas. */
export function buildFilterOptionsForScope(
  products: AggregatedProduct[],
  scope: Pick<MarketplaceFilters, "tech" | "brand" | "stores">,
): FilterOptions {
  const scopeFilters: MarketplaceFilters = {
    tech: scope.tech ?? null,
    brand: scope.brand ?? null,
    model: null,
    storage: null,
    grade: null,
    color: null,
    q: null,
    stores: scope.stores ?? null,
  };

  const scopedProducts = filterAggregatedProducts(products ?? [], scopeFilters);
  const listings = extractListingsFromAggregated(scopedProducts);
  const base = buildFilterOptions(listings);

  const storeSlugs = new Set<ProductSource>();
  for (const product of scopedProducts) {
    for (const offer of product.offers ?? []) {
      storeSlugs.add(offer.storeSlug);
    }
    if (product.bestListing) {
      storeSlugs.add(product.bestListing.storeSlug);
    }
  }

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
    if (item.isAvailable === false) return false;
    if (tech && item.tech !== tech) return false;
    if (brand && resolveProductBrand(item)?.toLowerCase() !== brand.toLowerCase()) return false;
    if (
      model &&
      normalizeModelForFilter(item.model) !== model &&
      !modelMatches(item.model, model)
    ) {
      return false;
    }
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
    if (item?.model) {
      const baseModel = normalizeModelForFilter(item.model);
      if (baseModel && baseModel !== "Modelo desconhecido") {
        models.add(baseModel);
      }
    }
    if (item?.storage) storages.add(item.storage.toUpperCase());
  }

  return {
    brands: [...brands].sort((a, b) => a.localeCompare(b, "pt")),
    models: sortFilterModelNames(models),
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

function listingToAggregatedHighlight(offer: ProductListing): AggregatedProduct {
  return {
    id: `destaque-${offer.storeSlug}-${offer.id}`,
    model: offer.model,
    brand: offer.brand,
    tech: offer.tech,
    storage: offer.storage,
    grade: offer.grade,
    gradeTier: offer.gradeTier,
    minPrice: offer.price,
    bestListing: offer,
    offers: [offer],
    imageUrl: offer.imageUrl,
    storeCount: 1,
    color: offer.color,
    isAvailable: offer.isAvailable !== false,
  };
}

function highlightSelectionKey(listing: ProductListing): string {
  return `${listing.model}-${listing.storeSlug}`;
}

function iphoneGenerationForHighlights(model: string): number | null {
  const normalized = model.toLowerCase();
  if (normalized.includes("se")) return null;
  const match = normalized.match(/iphone\s*(\d{1,2})/);
  if (!match) return null;
  const generation = parseInt(match[1], 10);
  return Number.isFinite(generation) ? generation : null;
}

function isHighlightIphone(model: string): boolean {
  const normalized = model.toLowerCase();
  if (!normalized.includes("iphone")) return false;
  if (normalized.includes("mini") || normalized.includes("se")) return false;
  const generation = iphoneGenerationForHighlights(model);
  return generation !== null && generation >= 11;
}

function isHighlightIpad(model: string): boolean {
  const normalized = model.toLowerCase();
  if (!normalized.includes("ipad")) return false;
  if (normalized.includes("ipad pro") || normalized.includes("ipad mini")) return false;
  if (normalized.includes("ipad air")) return true;

  const generationMatch = normalized.match(/ipad\s*(\d+)/);
  if (generationMatch) {
    return parseInt(generationMatch[1], 10) >= 9;
  }

  const namedGenerationMatch = normalized.match(/(\d+)(?:ª|th)?\s*gera/);
  if (namedGenerationMatch) {
    return parseInt(namedGenerationMatch[1], 10) >= 9;
  }

  return false;
}

function selectHighlightListings(offers: ProductListing[]): ProductListing[] {
  const usedSources: ProductSource[] = [];
  const usedModelSource = new Set<string>();
  const tabletSourcesUsed = new Set<ProductSource>();

  const pick = (
    candidates: ProductListing[],
    options?: { preferUnusedTabletStore?: boolean; maxPerSource?: number },
  ): ProductListing | null => {
    const maxPerSource = options?.maxPerSource ?? 2;
    const ordered = [...candidates].sort((a, b) => {
      const aUsed = usedSources.includes(a.storeSlug) ? 1 : 0;
      const bUsed = usedSources.includes(b.storeSlug) ? 1 : 0;
      if (aUsed !== bUsed) return aUsed - bUsed;
      if (options?.preferUnusedTabletStore) {
        const aTabletUsed = tabletSourcesUsed.has(a.storeSlug) ? 1 : 0;
        const bTabletUsed = tabletSourcesUsed.has(b.storeSlug) ? 1 : 0;
        if (aTabletUsed !== bTabletUsed) return aTabletUsed - bTabletUsed;
      }
      return a.price - b.price;
    });

    for (const product of ordered) {
      const key = highlightSelectionKey(product);
      const sourceCount = usedSources.filter((source) => source === product.storeSlug).length;
      if (!usedModelSource.has(key) && sourceCount < maxPerSource) {
        usedModelSource.add(key);
        usedSources.push(product.storeSlug);
        return product;
      }
    }
    return null;
  };

  const pickTablet = (
    candidates: ProductListing[],
    preferUnusedStore = false,
    maxPerSource = 2,
  ): ProductListing | null => {
    const selected = pick(
      candidates,
      preferUnusedStore
        ? { preferUnusedTabletStore: true, maxPerSource }
        : { maxPerSource },
    );
    if (selected) tabletSourcesUsed.add(selected.storeSlug);
    return selected;
  };

  const smartphones = offers.filter((product) => product.tech === "smartphones");
  const tablets = offers.filter((product) => product.tech === "tablets");

  const iphones = smartphones
    .filter(
      (product) =>
        isHighlightIphone(product.model) && product.price >= 100 && product.price <= 600,
    )
    .sort((a, b) => a.price - b.price);

  const samsungPhones = smartphones
    .filter(
      (product) =>
        product.brand === "Samsung" && product.price >= 100 && product.price <= 600,
    )
    .sort((a, b) => a.price - b.price);

  const googlePhones = smartphones
    .filter(
      (product) =>
        product.brand === "Google" && product.price >= 100 && product.price <= 600,
    )
    .sort((a, b) => a.price - b.price);

  const ipads = tablets
    .filter(
      (product) =>
        product.brand === "Apple" &&
        isHighlightIpad(product.model) &&
        product.price >= 80 &&
        product.price <= 500,
    )
    .sort((a, b) => a.price - b.price);

  const samsungTablets = tablets
    .filter(
      (product) =>
        product.brand === "Samsung" && product.price >= 80 && product.price <= 500,
    )
    .sort((a, b) => a.price - b.price);

  const allTablets = tablets
    .filter((product) => product.price >= 80 && product.price <= 500)
    .sort((a, b) => a.price - b.price);

  const fourthSmartphonePool =
    googlePhones.length > 0
      ? googlePhones
      : [...iphones, ...samsungPhones].sort((a, b) => a.price - b.price);

  const slot1 = pick(iphones);
  const slot2 = pick(iphones);
  const slot3 = pick(samsungPhones) ?? pick(fourthSmartphonePool);
  const slot4 = pick(fourthSmartphonePool);
  const slot5 = pickTablet(ipads);
  const slot6 = pickTablet(ipads);
  const slot7 = pickTablet(samsungTablets);
  const slot8 = pickTablet(allTablets, true);

  const results: (ProductListing | null)[] = [
    slot1,
    slot2,
    slot3,
    slot4,
    slot5,
    slot6,
    slot7,
    slot8,
  ];

  const fallbackPicks: (() => ProductListing | null)[] = [
    () => pick(iphones, { maxPerSource: 3 }),
    () => pick(iphones, { maxPerSource: 3 }),
    () => pick(samsungPhones, { maxPerSource: 3 }) ?? pick(fourthSmartphonePool, { maxPerSource: 3 }),
    () => pick(fourthSmartphonePool, { maxPerSource: 3 }),
    () => pickTablet(ipads, false, 3),
    () => pickTablet(ipads, false, 3),
    () => pickTablet(samsungTablets, false, 3),
    () => pickTablet(allTablets, true, 3),
  ];

  for (let i = 0; i < results.length; i++) {
    if (results[i] === null) {
      results[i] = fallbackPicks[i]();
    }
  }

  if (!usedSources.includes("callphone")) {
    const callphoneCandidates = offers
      .filter((offer) => offer.storeSlug === "callphone")
      .sort((a, b) => a.price - b.price);

    for (const candidate of callphoneCandidates) {
      const key = highlightSelectionKey(candidate);
      if (!usedModelSource.has(key)) {
        results[7] = candidate;
        break;
      }
    }
  }

  console.log(
    "Highlight slots:",
    results.map((r, i) => `${i}: ${r ? r.model + " " + r.storeSlug : "NULL"}`),
  );
  return results.filter((product): product is ProductListing => product != null);
}

/** Destaques goRiCycle: 4 smartphones + 4 tablets com preço, marca e diversidade de lojas. */
export function buildHighlightProducts(products: AggregatedProduct[]): AggregatedProduct[] {
  const offers = flattenAggregatedToListings(products ?? []).filter(
    (offer) => offer.isAvailable !== false,
  );

  return selectHighlightListings(offers).map(listingToAggregatedHighlight);
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
