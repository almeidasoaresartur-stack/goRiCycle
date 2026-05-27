import type { FeaturedBannerSlide } from "./featured-banner-shared";
import type { ProductSource } from "./types";
import { loadAllScrapedProducts } from "./scraper-data";
import { getProductImage } from "./productImages";
import { resolveInfallibleProductUrl } from "./product-urls";

export type { FeaturedBannerSlide } from "./featured-banner-shared";
export { formatBannerPrice } from "./featured-banner-shared";

const SLIDE_DEFINITIONS = [
  {
    id: "swappie-iphone-13",
    store: "swappie" as const,
    storeLabel: "Swappie",
    headline: "Destaque do Dia na Swappie",
    model: "iPhone 13",
    subtitle: "128GB · Best-seller com stock abundante",
    price: 219,
    searchModel: "iPhone 13",
    storage: "128GB",
    catalogModel: "iPhone 13",
    imageCategory: "smartphone",
    backgroundClass: "bg-gradient-to-br from-emerald-50 via-white to-teal-50",
    accentClass: "text-emerald-700",
    buttonClass: "bg-emerald-600 hover:bg-emerald-500",
  },
  {
    id: "iservices-iphone-13-pro",
    store: "iservices" as const,
    storeLabel: "iServices",
    headline: "Destaque do Dia na iServices",
    model: "iPhone 13 Pro",
    subtitle: "128GB · Garantia até 36 meses",
    price: 397,
    searchModel: "iPhone 13 Pro",
    storage: "128GB",
    catalogModel: "iPhone 13 Pro",
    imageCategory: "smartphone",
    backgroundClass: "bg-gradient-to-br from-orange-50 via-white to-amber-50",
    accentClass: "text-orange-700",
    buttonClass: "bg-orange-600 hover:bg-orange-500",
  },
  {
    id: "refurbed-macbook-air-m2",
    store: "refurbed" as const,
    storeLabel: "Refurbed",
    headline: "Destaque do Dia na Refurbed",
    model: 'MacBook Air 13" (2022)',
    subtitle: "Chip M2 · O portátil recondicionado mais procurado",
    price: 649,
    searchModel: "MacBook Air M2",
    storage: "256GB",
    catalogModel: 'MacBook Air 13" 2022',
    imageCategory: "laptop",
    backgroundClass: "bg-gradient-to-br from-violet-50 via-white to-purple-50",
    accentClass: "text-violet-700",
    buttonClass: "bg-violet-600 hover:bg-violet-500",
  },
  {
    id: "certideal-iphone-11-pro",
    store: "certideal" as const,
    storeLabel: "Certideal",
    headline: "Destaque do Dia na Certideal",
    model: "iPhone 11 Pro",
    subtitle: "256GB · Excelente relação qualidade-preço",
    price: 146,
    searchModel: "iPhone 11 Pro",
    storage: "256GB",
    catalogModel: "iPhone 11 Pro",
    imageCategory: "smartphone",
    backgroundClass: "bg-gradient-to-br from-sky-50 via-white to-cyan-50",
    accentClass: "text-sky-700",
    buttonClass: "bg-sky-600 hover:bg-sky-500",
  },
] as const;

function normalizeBannerModel(value: string): string {
  return value
    .toLowerCase()
    .replace(/[""″''']/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function findCatalogListing(store: ProductSource, catalogModel: string) {
  const target = normalizeBannerModel(catalogModel);
  let best: { price: number; url: string } | null = null;

  for (const product of loadAllScrapedProducts()) {
    if (product.source !== store) continue;
    if (normalizeBannerModel(product.model) !== target) continue;
    if (typeof product.price !== "number" || !Number.isFinite(product.price)) continue;
    if (!product.url) continue;

    if (!best || product.price < best.price) {
      best = { price: product.price, url: product.url };
    }
  }

  return best;
}

export function getFeaturedBannerSlides(): FeaturedBannerSlide[] {
  return SLIDE_DEFINITIONS.map((slide) => {
    const catalogListing = findCatalogListing(slide.store, slide.catalogModel);

    return {
      id: slide.id,
      store: slide.store,
      storeLabel: slide.storeLabel,
      headline: slide.headline,
      model: slide.model,
      subtitle: slide.subtitle,
      price: catalogListing?.price ?? slide.price,
      url: resolveInfallibleProductUrl({
        store: slide.store,
        model: slide.searchModel,
        storage: slide.storage,
        url: catalogListing?.url ?? null,
        affiliateEnabled: slide.store === "swappie" || slide.store === "refurbed",
      }),
      imageUrl: getProductImage(slide.catalogModel, slide.imageCategory),
      backgroundClass: slide.backgroundClass,
      accentClass: slide.accentClass,
      buttonClass: slide.buttonClass,
    };
  });
}
