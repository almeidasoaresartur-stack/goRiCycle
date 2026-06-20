import type { ProductListing } from "@/lib/marketplace";
import { cleanBaseModel } from "@/lib/product-display";
import { generateExactProductUrl, isGenericListingUrl } from "@/lib/product-urls";
import { getStoreInfo } from "@/lib/stores";
import type { ProductSource } from "@/lib/types";

export const HERO_HIGHLIGHT_STORES: ProductSource[] = [
  "iservices",
  "swappie",
  "certideal",
  "refurbed",
  "callphone",
];

export type HeroHighlight = {
  productId: string;
  model: string;
  storage: string | null;
  storeSlug: ProductSource;
  storeLabel: string;
  price: number;
  url: string;
  imageUrl: string | null;
  /** Preço mínimo confirmado no catálogo para este modelo+loja (nunca variante cara isolada). */
  priceFrom: boolean;
};

const INVALID_URL_MARKERS = ["/search", "search_query", "/procurar"];

function isValidHighlightUrl(url: string): boolean {
  const lower = url.toLowerCase();
  if (!url || url === "#") return false;
  if (INVALID_URL_MARKERS.some((marker) => lower.includes(marker))) return false;
  return true;
}

function isRecognizableSmartphone(model: string): boolean {
  const m = model.toLowerCase();
  return (
    m.includes("iphone") ||
    m.includes("samsung") ||
    m.includes("galaxy") ||
    m.includes("pixel")
  );
}

function storeMatches(listing: ProductListing, storeName: ProductSource): boolean {
  return (listing.storeSlug ?? "").toLowerCase() === storeName.toLowerCase();
}

function baseEligibility(listing: ProductListing, storeName: ProductSource): boolean {
  if (!storeMatches(listing, storeName)) return false;
  if (listing.tech !== "smartphones") return false;
  if (listing.isAvailable === false) return false;
  if (listing.price == null || listing.price < 80 || listing.price > 1200) return false;
  if (!listing.model || listing.model.trim().split(/\s+/).length < 2) return false;
  if (!listing.url || !isValidHighlightUrl(listing.url)) return false;
  if (isGenericListingUrl(listing.storeSlug, listing.url)) return false;
  return true;
}

function premiumEligibility(listing: ProductListing, storeName: ProductSource): boolean {
  return baseEligibility(listing, storeName) && isRecognizableSmartphone(listing.model);
}

function sameBaseModel(a: string, b: string): boolean {
  return cleanBaseModel(a).toLowerCase() === cleanBaseModel(b).toLowerCase();
}

/** Ofertas do mesmo modelo base na mesma loja — preço/link reflectem o mínimo real. */
function bestOfferForModel(
  listings: ProductListing[],
  storeName: ProductSource,
  model: string,
): ProductListing | null {
  const matches = listings
    .filter((listing) => baseEligibility(listing, storeName) && sameBaseModel(listing.model, model))
    .sort((a, b) => a.price - b.price);

  return matches[0] ?? null;
}

const PRICE_FROM_STORES: ReadonlySet<ProductSource> = new Set([
  "swappie",
  "refurbed",
  "certideal",
  "iservices",
]);

export function getStoreHighlight(
  listings: ProductListing[],
  storeName: ProductSource,
): HeroHighlight | null {
  const premiumCandidates = listings
    .filter((listing) => premiumEligibility(listing, storeName))
    .sort((a, b) => b.price - a.price);

  const baseCandidates = listings
    .filter((listing) => baseEligibility(listing, storeName))
    .sort((a, b) => b.price - a.price);

  const candidates = premiumCandidates.length > 0 ? premiumCandidates : baseCandidates;
  if (candidates.length === 0) return null;

  const indexBase = baseCandidates.length;
  const pickIndex = Math.min(Math.floor(indexBase * 0.25), candidates.length - 1);
  const picked = candidates[pickIndex];
  if (!picked) return null;

  const best = bestOfferForModel(listings, storeName, picked.model) ?? picked;
  const storeLabel = getStoreInfo(best.storeSlug)?.label ?? best.store;
  const displayModel = cleanBaseModel(best.model);

  return {
    productId: best.id,
    model: displayModel,
    storage: best.storage ?? null,
    storeSlug: best.storeSlug,
    storeLabel,
    price: best.price,
    url: generateExactProductUrl({
      store: best.storeSlug,
      model: best.model,
      storage: best.storage,
      url: best.url,
      affiliateEnabled: best.storeSlug === "swappie" || best.storeSlug === "refurbed",
    }),
    imageUrl: best.imageUrl,
    priceFrom: PRICE_FROM_STORES.has(best.storeSlug),
  };
}

export function buildHeroHighlights(listings: ProductListing[]): HeroHighlight[] {
  return HERO_HIGHLIGHT_STORES.map((store) => getStoreHighlight(listings, store)).filter(
    (item): item is HeroHighlight => item != null,
  );
}
