/**
 * Storage normalisation for scrape leftovers vs PDP slugs.
 *
 * Refurbed (and similar) emit RAM as "8GB"/"12GB" and 1TB/2TB as 1000GB/2000GB.
 * Slugs only use 16–1024GB. 1TB maps to 1024GB (not 1000GB pages).
 */

export const MIN_SLUG_STORAGE_GB = 16;
export const MAX_SLUG_STORAGE_GB = 1024;

/** Decimal-TB marketing aliases that must not appear in slugs. */
const DECIMAL_TB_TO_BINARY_GB: Record<number, number> = {
  1000: 1024,
  2000: 2048,
};

const STORAGE_TOKEN_RE = /(\d+(?:\.\d+)?)\s*(TB|GB)/gi;
const SLUG_STORAGE_RE = /-(\d+)-?gb-recondicionado$/i;

export function parseStorageGb(raw: string | null | undefined): number | null {
  if (!raw?.trim()) return null;

  const candidates: number[] = [];
  const text = raw.trim();
  for (const match of text.matchAll(STORAGE_TOKEN_RE)) {
    const value = Number.parseFloat(match[1]);
    if (!Number.isFinite(value) || value <= 0) continue;
    const unit = match[2].toUpperCase();
    let gb = unit === "TB" ? Math.round(value * 1024) : Math.round(value);
    gb = DECIMAL_TB_TO_BINARY_GB[gb] ?? gb;
    candidates.push(gb);
  }

  if (!candidates.length) return null;

  const plausible = candidates.filter((gb) => gb >= MIN_SLUG_STORAGE_GB);
  if (plausible.length) return Math.max(...plausible);
  return Math.max(...candidates);
}

/** Label kept on listings: RAM dropped; 1TB→1024GB; 2TB stays 2048GB. */
export function normalizeListingStorage(
  raw: string | null | undefined,
): string | null {
  const gb = parseStorageGb(raw);
  if (gb == null || gb < MIN_SLUG_STORAGE_GB) return null;
  return `${gb}GB`;
}

/** Storage that may appear in an indexable `/produto/…-{n}gb-…` slug. */
export function normalizeStorageForSlug(
  raw: string | null | undefined,
): string | null {
  const gb = parseStorageGb(raw);
  if (gb == null || !isCanonicalSlugStorageGb(gb)) return null;
  return `${gb}GB`;
}

export function isCanonicalSlugStorageGb(gb: number): boolean {
  if (gb in DECIMAL_TB_TO_BINARY_GB) return false;
  return gb >= MIN_SLUG_STORAGE_GB && gb <= MAX_SLUG_STORAGE_GB;
}

export function storageGbFromProductSlug(slug: string): number | null {
  const match = slug.match(SLUG_STORAGE_RE);
  if (!match) return null;
  const gb = Number.parseInt(match[1], 10);
  return Number.isFinite(gb) ? gb : null;
}

export function isNonCanonicalStorageSlug(slug: string): boolean {
  const gb = storageGbFromProductSlug(slug);
  return gb != null && !isCanonicalSlugStorageGb(gb);
}

export function remapStorageSlug(slug: string, fromGb: number, toGb: number): string {
  return slug.replace(
    new RegExp(`-${fromGb}-?gb-recondicionado$`, "i"),
    `-${toGb}gb-recondicionado`,
  );
}

/** Hub fallback when a junk slug has no sensible PDP sibling. */
export function hubPathForProductSlug(slug: string): string {
  const key = slug.toLowerCase();
  if (key.includes("ipad") || /(?:^|-)tab(?:-|$)/.test(key)) return "/tablets";
  if (key.includes("samsung") || key.includes("galaxy")) return "/marca/samsung";
  if (key.includes("iphone") || key.includes("ipad") || key.includes("apple")) {
    return "/marca/apple";
  }
  return "/smartphones";
}
