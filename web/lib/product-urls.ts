import { makeAffiliateUrl } from "./affiliate";
import type { ProductSource } from "./types";

export type ProductUrlInput = {
  store: ProductSource;
  model: string;
  storage?: string | null;
  url?: string | null;
  affiliateEnabled?: boolean;
  /** "search" salta reconstrução de slug e usa pesquisa directa na loja. */
  fallback?: "rebuild" | "search";
};

const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "mc_cid",
  "mc_eid",
]);

function safeTrim(value: string | null | undefined): string {
  return (value ?? "").trim();
}

function stripDiacritics(value: string): string {
  return value.normalize("NFD").replace(/\p{M}/gu, "");
}

/** Remove hash, tracking params e normaliza o URL capturado pelo scraper. */
export function cleanScrapedUrl(rawUrl: string | null | undefined): string {
  const trimmed = safeTrim(rawUrl);
  if (!trimmed || trimmed === "#") return "";

  try {
    const parsed = new URL(trimmed);
    parsed.hash = "";

    for (const key of [...parsed.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        parsed.searchParams.delete(key);
      }
    }

    let cleaned = parsed.toString();
    if (cleaned.endsWith("?")) cleaned = cleaned.slice(0, -1);
    return cleaned;
  } catch {
    return trimmed.split("#")[0] ?? "";
  }
}

function buildSearchQuery(model: string, storage?: string | null): string {
  const base = model
    .replace(/[""″''']/g, "")
    .replace(/\s*\|\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const storageValue = safeTrim(storage);
  return storageValue ? `${base} ${storageValue}`.trim() : base;
}

function slugify(value: string): string {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[""″''']/g, "")
    .replace(/\([^)]*\)/g, " ")
    .replace(/\s*\|\s*/g, " ")
    .replace(/\b\d+\s*(gb|tb)\b/gi, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function toSwappieSlug(model: string): string {
  return stripDiacritics(model)
    .toLowerCase()
    .replace(/[""″''']/g, "")
    .replace(/\s*\|\s*/g, " ")
    .replace(/\((\d{4})\)/g, " $1 ")
    .replace(/\b\d+\s*(gb|tb)\b/gi, "")
    // Preserva polegadas decimais (10.2, 12.9) — Swappie usa ponto no slug
    .replace(/(\d)\.(\d)/g, "$1dot$2")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/dot/g, ".")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function toRefurbedSlug(model: string): string {
  const lower = stripDiacritics(model).toLowerCase();

  const ipadPro2024 = lower.match(/ipad\s*pro.*?2024.*?(13|11)/);
  if (ipadPro2024) {
    return `ipad-pro-7-2024-${ipadPro2024[1]}`;
  }

  const macbookAir152023 = lower.match(/macbook\s*air\s*15.*2023/);
  if (macbookAir152023) {
    return "macbook-air-15-inch-2023-m2";
  }

  const macbookAir132022 = lower.match(/macbook\s*air\s*13.*2022/);
  if (macbookAir132022) {
    return "macbook-air-13-inch-2022-m2";
  }

  return slugify(model);
}

function pathnameOf(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}

function lastPathSegment(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  return segments[segments.length - 1] ?? "";
}

export function isGenericListingUrl(store: ProductSource, rawUrl: string): boolean {
  const url = cleanScrapedUrl(rawUrl);
  if (!url) return true;

  const pathname = pathnameOf(url).toLowerCase();
  const lastSegment = lastPathSegment(pathname);

  switch (store) {
    case "swappie":
      if (pathname.includes("/modelo/")) return false;
      return (
        /\/pt\/?$/.test(pathname) ||
        /\/pt\/(iphone|ipad|macbook?|samsung|galaxy)(\/)?$/.test(pathname)
      );

    case "refurbed":
      if (pathname.includes("/p/")) return false;
      return /\/c\/[^/]+\/?$/.test(pathname);

    case "certideal":
      if (pathname.includes("/procurar")) return false;
      if (/recondicionad[oa]s?-\d+\/?$/.test(pathname)) return true;
      if (/-recondicionado-\d+\/?$/.test(lastSegment)) return true;
      if (pathname.split("/").filter(Boolean).length >= 2) return false;
      if (/^\d+$/.test(lastSegment)) return true;
      return false;

    case "iservices": {
      const segments = pathname.split("/").filter(Boolean);
      if (segments.length >= 2 && /\d+-/.test(segments[1] ?? "")) return false;
      if (segments.length >= 2 && /\d+/.test(segments[1] ?? "")) return false;
      return segments.length <= 1;
    }

    case "callphone":
      if (pathname.includes("/products/") && pathname.split("/").filter(Boolean).length >= 2) {
        return false;
      }
      return true;

    default:
      return false;
  }
}

function buildStoreSearchUrl(store: ProductSource, model: string, storage?: string | null): string {
  const query = buildSearchQuery(model, storage);

  switch (store) {
    case "certideal":
      return `https://www.certideal.pt/procurar?search_query=${encodeURIComponent(query)}`;
    case "iservices":
      return `https://iservices.pt/search?q=${encodeURIComponent(query)}`;
    case "refurbed":
      return `https://www.refurbed.pt/search/?q=${encodeURIComponent(query)}`;
    case "swappie":
      return `https://swappie.com/pt/procurar/?query=${encodeURIComponent(query)}`;
    default:
      return "#";
  }
}

function buildSwappieProductUrl(model: string): string {
  return `https://swappie.com/pt/modelo/${toSwappieSlug(model)}/`;
}

function buildRefurbedProductUrl(model: string): string {
  return `https://www.refurbed.pt/p/${toRefurbedSlug(model)}/`;
}

function buildCertidealProductUrl(model: string, storage?: string | null): string {
  return buildStoreSearchUrl("certideal", model, storage);
}

function buildIServicesProductUrl(model: string, storage?: string | null): string {
  return buildStoreSearchUrl("iservices", model, storage);
}

function rebuildStoreProductUrl(
  store: ProductSource,
  model: string,
  storage?: string | null,
): string {
  switch (store) {
    case "swappie":
      return buildSwappieProductUrl(model);
    case "refurbed":
      return buildRefurbedProductUrl(model);
    case "certideal":
      return buildCertidealProductUrl(model, storage);
    case "iservices":
      return buildIServicesProductUrl(model, storage);
    default:
      return buildStoreSearchUrl(store, model, storage);
  }
}

function urlMatchesModel(store: ProductSource, url: string, model: string): boolean {
  const pathname = pathnameOf(url).toLowerCase();

  switch (store) {
    case "swappie":
      return pathname.includes(`/modelo/${toSwappieSlug(model)}`);
    case "refurbed":
      return pathname.includes(`/p/${toRefurbedSlug(model)}`);
    default:
      return true;
  }
}

function applyAffiliateToUrl(
  url: string,
  store: ProductSource,
  affiliateEnabled?: boolean,
): string {
  if (!url || url === "#") return "#";

  return (
    makeAffiliateUrl({
      source: store,
      url,
      affiliate_enabled: Boolean(affiliateEnabled),
    }) || url
  );
}

/**
 * Reconstrói o URL mais específico possível para um produto numa loja parceira.
 * Se o scraper guardou uma categoria genérica, cai para pesquisa directa na loja.
 */
export function generateExactProductUrl(input: ProductUrlInput): string {
  const store = input.store;
  const model = safeTrim(input.model);
  const storage = input.storage ?? null;
  const cleaned = cleanScrapedUrl(input.url);

  if (!model) {
    return applyAffiliateToUrl(cleaned || "#", store, input.affiliateEnabled);
  }

  let resolved = cleaned;

  // URL do scraper (/modelo/...) é autoritativo — não reconstruir slug
  if (
    store === "swappie" &&
    resolved &&
    pathnameOf(resolved).toLowerCase().includes("/modelo/")
  ) {
    return applyAffiliateToUrl(resolved, store, input.affiliateEnabled);
  }

  if (!resolved || isGenericListingUrl(store, resolved)) {
    resolved =
      input.fallback === "search"
        ? buildStoreSearchUrl(store, model, storage)
        : rebuildStoreProductUrl(store, model, storage);
  } else if (!urlMatchesModel(store, resolved, model)) {
    resolved =
      input.fallback === "search"
        ? buildStoreSearchUrl(store, model, storage)
        : rebuildStoreProductUrl(store, model, storage);
  }

  if (!resolved || resolved === "#") {
    resolved = buildStoreSearchUrl(store, model, storage);
  }

  return applyAffiliateToUrl(resolved, store, input.affiliateEnabled);
}

export function resolveListingUrl(input: ProductUrlInput): string {
  return generateExactProductUrl(input);
}

/**
 * Link infalível: usa URL do catálogo se for específico; caso contrário pesquisa na loja.
 * Ideal para destaques do banner onde o stock muda frequentemente.
 */
export function resolveInfallibleProductUrl(input: ProductUrlInput): string {
  const cleaned = cleanScrapedUrl(input.url);

  if (cleaned && !isGenericListingUrl(input.store, cleaned)) {
    return generateExactProductUrl({ ...input, url: cleaned, fallback: "rebuild" });
  }

  return generateExactProductUrl({ ...input, url: null, fallback: "search" });
}

export { buildStoreSearchUrl };
