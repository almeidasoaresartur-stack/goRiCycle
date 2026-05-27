import type { ProductSource } from "./types";

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

export function formatBannerPrice(value: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}
