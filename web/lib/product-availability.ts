import type { ScrapedProduct } from "./types";

const OUT_OF_STOCK_MARKERS = [
  "sem stock",
  "out of stock",
  "sold out",
  "esgotado",
  "indisponível",
  "indisponivel",
  "currently unavailable",
  "not available",
] as const;

type AvailabilityFields = {
  is_available?: boolean | null;
  availability?: string | null;
  status?: string | null;
  stock_status?: string | null;
};

type ListingAvailability = {
  isAvailable?: boolean;
};

type AggregatedAvailability = ListingAvailability & {
  bestListing?: ListingAvailability | null;
  offers?: ListingAvailability[];
};

export function textIndicatesOutOfStock(text: string | null | undefined): boolean {
  if (!text?.trim()) return false;
  const normalized = text.toLowerCase().replace(/\s+/g, " ").trim();
  return OUT_OF_STOCK_MARKERS.some((marker) => normalized.includes(marker));
}

export function resolveScrapedAvailability(product: AvailabilityFields): boolean {
  if (product.is_available === false) return false;

  for (const field of [
    product.availability,
    product.status,
    product.stock_status,
  ] as const) {
    if (textIndicatesOutOfStock(field)) return false;
  }

  return true;
}

export function scrapedProductIsAvailable(product: ScrapedProduct): boolean {
  return resolveScrapedAvailability(product);
}

export function listingIsAvailable(listing: ListingAvailability | null | undefined): boolean {
  if (!listing) return false;
  return listing.isAvailable !== false;
}

export function aggregatedProductIsAvailable(
  product: AggregatedAvailability | null | undefined,
): boolean {
  if (!product) return false;
  if (product.isAvailable === false) return false;

  const offers = (product.offers ?? []).filter(listingIsAvailable);
  if (offers.length > 0) return true;

  return listingIsAvailable(product.bestListing);
}

export function filterAvailableAggregatedProducts<T extends AggregatedAvailability>(
  products: T[],
): T[] {
  return (products ?? []).filter(aggregatedProductIsAvailable);
}
