import type { ProductListing } from "@/lib/marketplace";
import { isGenericListingUrl } from "@/lib/product-urls";
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
  storeSlug: ProductSource;
  storeLabel: string;
  price: number;
  url: string;
  imageUrl: string | null;
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

function baseEligibility(listing: ProductListing, storeName: ProductSource): boolean {
  if (listing.storeSlug !== storeName) return false;
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

export function getStoreHighlight(
  listings: ProductListing[],
  storeName: ProductSource,
): HeroHighlight | null {
  const premiumCandidates = listings
    .filter((listing) => premiumEligibility(listing, storeName))
    .sort((a, b) => b.price - a.price);

  if (premiumCandidates.length === 0) return null;

  const indexBase = listings.filter((listing) => baseEligibility(listing, storeName)).length;
  const pickIndex = Math.min(Math.floor(indexBase * 0.25), premiumCandidates.length - 1);
  const picked = premiumCandidates[pickIndex];
  if (!picked) return null;

  const storeLabel = getStoreInfo(picked.storeSlug)?.label ?? picked.store;

  return {
    productId: picked.id,
    model: picked.model,
    storeSlug: picked.storeSlug,
    storeLabel,
    price: picked.price,
    url: picked.url,
    imageUrl: picked.imageUrl,
  };
}

export function buildHeroHighlights(listings: ProductListing[]): HeroHighlight[] {
  return HERO_HIGHLIGHT_STORES.map((store) => getStoreHighlight(listings, store)).filter(
    (item): item is HeroHighlight => item != null,
  );
}
