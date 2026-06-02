import { cleanBaseModel, formatStorageLabel } from "./product-display";
import { getAllListings } from "./load-listings";
import type { ProductListing } from "./marketplace";
import { slugify } from "./slugify";

export function loadAllProducts(): ProductListing[] {
  return getAllListings();
}

export function listingProductSlug(listing: ProductListing): string {
  return slugify(listing.model, listing.storage);
}

export function getListingsForProductSlug(slug: string): ProductListing[] {
  return loadAllProducts()
    .filter((listing) => listingProductSlug(listing) === slug)
    .sort((a, b) => a.price - b.price);
}

export function getAllProductSlugs(): string[] {
  const slugs = new Set<string>();
  for (const listing of loadAllProducts()) {
    slugs.add(listingProductSlug(listing));
  }
  return Array.from(slugs);
}

export function formatProductPageName(model: string, storage?: string | null): string {
  const displayName = cleanBaseModel(model);
  const storageLabel = formatStorageLabel(storage);
  if (!storage || storageLabel === "NFPM*") return displayName;
  return `${displayName} ${storageLabel}`;
}
