import { cleanBaseModel, formatStorageLabel } from "./product-display";
import { getAllListings } from "./load-listings";
import type { ProductListing } from "./marketplace";
import { canonicalPath } from "./seo";
import { slugify } from "./slugify";

const STORAGE_SLUG_SUFFIX = /-\d+-?gb-recondicionado$/i;

export type ProductSlugIndexation = {
  slug: string;
  /** False when a storage-less slug has at least one model+GB sibling. */
  indexable: boolean;
  /** Self-ref when indexable; otherwise the preferred storage-specific sibling. */
  canonicalSlug: string;
};

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

export function listingHasStorage(listing: ProductListing): boolean {
  return formatStorageLabel(listing.storage) !== "NFPM*";
}

export function isStorageSpecificProductSlug(slug: string): boolean {
  return STORAGE_SLUG_SUFFIX.test(slug);
}

/** Family key shared by `iphone-13-recondicionado` and `iphone-13-128gb-recondicionado`. */
export function productSlugFamilyKey(slug: string): string {
  return slug.replace(STORAGE_SLUG_SUFFIX, "-recondicionado");
}

function pickPreferredStorageSlug(
  siblings: string[],
  listingsBySlug: Map<string, ProductListing[]>,
): string {
  const [preferred] = [...siblings].sort((a, b) => {
    const priceA = listingsBySlug.get(a)?.[0]?.price ?? Infinity;
    const priceB = listingsBySlug.get(b)?.[0]?.price ?? Infinity;
    if (priceA !== priceB) return priceA - priceB;
    return a.localeCompare(b);
  });
  return preferred ?? siblings[0] ?? "";
}

/**
 * Phase-1 policy: a generic (no-storage) PDP that has ≥1 storage-specific sibling
 * is not indexed and is omitted from the sitemap. Its canonical points at the
 * cheapest storage variant. Every indexable PDP keeps a self-ref canonical.
 */
export function buildProductSlugIndexationMap(
  listings: ProductListing[] = loadAllProducts(),
): Map<string, ProductSlugIndexation> {
  const listingsBySlug = new Map<string, ProductListing[]>();
  for (const listing of listings) {
    const slug = listingProductSlug(listing);
    const group = listingsBySlug.get(slug);
    if (group) group.push(listing);
    else listingsBySlug.set(slug, [listing]);
  }

  for (const group of listingsBySlug.values()) {
    group.sort((a, b) => a.price - b.price);
  }

  const slugsByFamily = new Map<string, string[]>();
  for (const slug of listingsBySlug.keys()) {
    const family = productSlugFamilyKey(slug);
    const familySlugs = slugsByFamily.get(family);
    if (familySlugs) familySlugs.push(slug);
    else slugsByFamily.set(family, [slug]);
  }

  const result = new Map<string, ProductSlugIndexation>();
  for (const [slug, group] of listingsBySlug) {
    const isGeneric = !group.some(listingHasStorage) && !isStorageSpecificProductSlug(slug);
    const siblings = (slugsByFamily.get(productSlugFamilyKey(slug)) ?? []).filter(
      (candidate) => candidate !== slug && isStorageSpecificProductSlug(candidate),
    );

    if (isGeneric && siblings.length > 0) {
      result.set(slug, {
        slug,
        indexable: false,
        canonicalSlug: pickPreferredStorageSlug(siblings, listingsBySlug),
      });
      continue;
    }

    result.set(slug, { slug, indexable: true, canonicalSlug: slug });
  }

  return result;
}

export function getProductSlugIndexation(slug: string): ProductSlugIndexation {
  return (
    buildProductSlugIndexationMap().get(slug) ?? {
      slug,
      indexable: false,
      canonicalSlug: slug,
    }
  );
}

export function getIndexableProductSlugs(): string[] {
  return [...buildProductSlugIndexationMap().entries()]
    .filter(([, indexation]) => indexation.indexable)
    .map(([slug]) => slug);
}

export function productPageCanonical(slug: string): string {
  return canonicalPath(`/produto/${getProductSlugIndexation(slug).canonicalSlug}`);
}
