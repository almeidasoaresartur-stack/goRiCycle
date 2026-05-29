import type { ProductListing } from "./marketplace";
import { isGenericListingUrl, resolveListingUrl } from "./product-urls";

const INVALID_URL_MARKERS = ["/search/", "search_query=", "/procurar", "?q="];

function urlHasInvalidMarkers(url: string): boolean {
  const lower = url.toLowerCase();
  return INVALID_URL_MARKERS.some((marker) => lower.includes(marker));
}

/** Indica links genéricos/corrompidos — útil para debug em desenvolvimento. */
export function isSuspiciousListing(listing: ProductListing | null | undefined): boolean {
  if (!listing?.storeSlug) return true;

  const raw = (listing.url ?? "").trim();
  if (!raw || raw === "#") return true;

  if (isGenericListingUrl(listing.storeSlug, raw)) return true;
  if (urlHasInvalidMarkers(raw)) return true;

  const resolved = resolveListingUrl({
    store: listing.storeSlug,
    model: listing.model,
    storage: listing.storage,
    url: listing.url,
    affiliateEnabled: listing.storeSlug === "swappie" || listing.storeSlug === "refurbed",
  });

  if (!resolved || resolved === "#") return true;
  if (isGenericListingUrl(listing.storeSlug, resolved)) return true;
  if (urlHasInvalidMarkers(resolved)) return true;

  return false;
}

export function isDevDebugMode(): boolean {
  return process.env.NODE_ENV === "development";
}
