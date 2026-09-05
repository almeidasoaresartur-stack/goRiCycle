import type { ProductListing } from "@/lib/marketplace";
import { inferBrand } from "@/lib/inference";
import { formatProductPageName } from "@/lib/product-pages";
import { resolveListingUrl } from "@/lib/product-urls";

export const SITE_URL = "https://goricycle.com";
export const SITE_LOGO_URL = `${SITE_URL}/images/goricycle-logo.png`;

export function absoluteMediaUrl(url: string): string {
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${SITE_URL}${url.startsWith("/") ? url : `/${url}`}`;
}

export function formatOgPrice(value: number): string {
  return new Intl.NumberFormat("pt-PT", {
    maximumFractionDigits: 0,
  }).format(value);
}

export function buildOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "goRiCycle",
    url: SITE_URL,
    logo: SITE_LOGO_URL,
    description:
      "Descobre em primeira mão a melhor opção em segunda mão. Comparador de preços de smartphones e tablets recondicionados em Portugal.",
  };
}

export function buildWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "goRiCycle",
    url: SITE_URL,
  };
}

function buildOfferJsonLd(listing: ProductListing) {
  return {
    "@type": "Offer",
    price: listing.price.toFixed(2),
    priceCurrency: "EUR",
    availability:
      listing.isAvailable === false
        ? "https://schema.org/OutOfStock"
        : "https://schema.org/InStock",
    url: resolveListingUrl({
      store: listing.storeSlug,
      model: listing.model,
      storage: listing.storage,
      url: listing.url,
      affiliateEnabled: listing.storeSlug === "swappie" || listing.storeSlug === "refurbed",
    }),
    seller: {
      "@type": "Organization",
      name: listing.store,
    },
  };
}

export function buildProductJsonLd(params: {
  listings: ProductListing[];
  imageUrl: string;
  productName: string;
  brand: string | null;
}) {
  const offers = params.listings.map(buildOfferJsonLd);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: params.productName,
    image: [absoluteMediaUrl(params.imageUrl)],
    brand: {
      "@type": "Brand",
      name: params.brand ?? "Desconhecida",
    },
    offers: offers.length === 1 ? offers[0] : offers,
  };
}

export function productSchemaName(model: string, storage?: string | null): string {
  return `${formatProductPageName(model, storage)} Recondicionado`;
}

export function resolveProductBrand(listing: ProductListing): string | null {
  return listing.brand ?? inferBrand(listing.model);
}

export function buildBreadcrumbJsonLd(
  items: { name: string; path?: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      ...(item.path ? { item: `${SITE_URL}${item.path === "/" ? "" : item.path}` } : {}),
    })),
  };
}

export function buildItemListJsonLd(
  items: { url: string; name: string }[],
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    numberOfItems: items.length,
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      url: item.url,
      name: item.name,
    })),
  };
}
