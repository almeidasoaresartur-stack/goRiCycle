import type { ProductSource } from "./types";

export type StoreInfo = {
  slug: ProductSource;
  label: string;
  logoSrc: string;
  accentClass: string;
};

export const STORES: Record<ProductSource, StoreInfo> = {
  iservices: {
    slug: "iservices",
    label: "iServices",
    logoSrc: "/stores/iservices.svg",
    accentClass: "text-sky-700",
  },
  refurbed: {
    slug: "refurbed",
    label: "Refurbed",
    logoSrc: "/stores/refurbed.svg",
    accentClass: "text-violet-700",
  },
  swappie: {
    slug: "swappie",
    label: "Swappie",
    logoSrc: "/stores/swappie.svg",
    accentClass: "text-orange-700",
  },
  certideal: {
    slug: "certideal",
    label: "Certideal",
    logoSrc: "/stores/certideal.svg",
    accentClass: "text-emerald-700",
  },
  callphone: {
    slug: "callphone",
    label: "Callphone",
    logoSrc: "/stores/callphone.svg",
    accentClass: "text-teal-700",
  },
};

export function getStoreInfo(slug: ProductSource | string | null | undefined): StoreInfo | null {
  if (!slug || !(slug in STORES)) return null;
  return STORES[slug as ProductSource];
}

/** Ordem de exibição das lojas parceiras na navegação e filtros. */
export const PARTNER_STORE_SLUGS = Object.keys(STORES) as ProductSource[];
