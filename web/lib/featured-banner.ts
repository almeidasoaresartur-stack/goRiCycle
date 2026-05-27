import type { ProductSource } from "./types";
import { getProductImage } from "./productImages";

export type FeaturedBannerSlide = {
  id: string;
  store: ProductSource;
  storeLabel: string;
  headline: string;
  model: string;
  subtitle: string;
  price: number;
  url: string;
  imageUrl: string;
  /** Classes Tailwind para fundo do slide */
  backgroundClass: string;
  accentClass: string;
  buttonClass: string;
};

const SLIDE_DEFINITIONS = [
  {
    id: "swappie-iphone-15-pro",
    store: "swappie" as const,
    storeLabel: "Swappie",
    headline: "Destaque do Dia na Swappie",
    model: "iPhone 15 Pro",
    subtitle: "128GB · Titanium · Premium recondicionado",
    price: 519,
    url: "https://swappie.com/pt/modelo/iphone-15-pro/",
    catalogModel: "iPhone 15 Pro",
    imageCategory: "smartphone",
    backgroundClass: "bg-gradient-to-br from-emerald-50 via-white to-teal-50",
    accentClass: "text-emerald-700",
    buttonClass: "bg-emerald-600 hover:bg-emerald-500",
  },
  {
    id: "iservices-iphone-14",
    store: "iservices" as const,
    storeLabel: "iServices",
    headline: "Destaque do Dia na iServices",
    model: "iPhone 14",
    subtitle: "128GB · Garantia até 36 meses",
    price: 320,
    url: "https://loja.iservices.pt/iphone-14/1117-iphone-14",
    catalogModel: "iPhone 14",
    imageCategory: "smartphone",
    backgroundClass: "bg-gradient-to-br from-orange-50 via-white to-amber-50",
    accentClass: "text-orange-700",
    buttonClass: "bg-orange-600 hover:bg-orange-500",
  },
  {
    id: "refurbed-macbook-air",
    store: "refurbed" as const,
    storeLabel: "Refurbed",
    headline: "Destaque do Dia na Refurbed",
    model: 'MacBook Air 15" (2023)',
    subtitle: "Chip M2 · Portátil premium recondicionado",
    price: 879,
    url: "https://www.refurbed.pt/c/macs/",
    catalogModel: 'MacBook Air 15" 2023',
    imageCategory: "laptop",
    backgroundClass: "bg-gradient-to-br from-violet-50 via-white to-purple-50",
    accentClass: "text-violet-700",
    buttonClass: "bg-violet-600 hover:bg-violet-500",
  },
  {
    id: "certideal-ipad-pro",
    store: "certideal" as const,
    storeLabel: "Certideal",
    headline: "Destaque do Dia na Certideal",
    model: 'iPad Pro (2024) 13"',
    subtitle: "512GB · Ecrã Liquid Retina XDR",
    price: 999,
    url: "https://www.certideal.pt/ipad-recondicionados-118",
    catalogModel: 'iPad Pro (2024) 13"',
    imageCategory: "tablet",
    backgroundClass: "bg-gradient-to-br from-sky-50 via-white to-cyan-50",
    accentClass: "text-sky-700",
    buttonClass: "bg-sky-600 hover:bg-sky-500",
  },
] as const;

export function getFeaturedBannerSlides(): FeaturedBannerSlide[] {
  return SLIDE_DEFINITIONS.map((slide) => ({
    id: slide.id,
    store: slide.store,
    storeLabel: slide.storeLabel,
    headline: slide.headline,
    model: slide.model,
    subtitle: slide.subtitle,
    price: slide.price,
    url: slide.url,
    imageUrl: getProductImage(slide.catalogModel, slide.imageCategory),
    backgroundClass: slide.backgroundClass,
    accentClass: slide.accentClass,
    buttonClass: slide.buttonClass,
  }));
}

export function formatBannerPrice(value: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
