import type { ScrapedProduct } from "./types";

const PLACEHOLDER = "PLACEHOLDER";

type AffiliateConfig = {
  enabled: boolean;
  urlTemplate: string;
  baseTag: string;
};

const AFFILIATE_BY_SOURCE: Record<string, AffiliateConfig> = {
  iservices: { enabled: false, urlTemplate: "{product_url}", baseTag: PLACEHOLDER },
  refurbed: { enabled: true, urlTemplate: "{product_url}?tag={base_tag}", baseTag: PLACEHOLDER },
  swappie: { enabled: true, urlTemplate: "{product_url}?cuid={base_tag}", baseTag: PLACEHOLDER },
  certideal: { enabled: false, urlTemplate: "{product_url}", baseTag: PLACEHOLDER },
  backmarket: { enabled: true, urlTemplate: "{product_url}?awc={base_tag}", baseTag: PLACEHOLDER },
};

export function makeAffiliateUrl(product: Pick<ScrapedProduct, "source" | "url" | "affiliate_enabled">): string {
  const original = product.url || "";
  if (!original) return original;

  const cfg = AFFILIATE_BY_SOURCE[product.source];
  if (!cfg?.enabled || !product.affiliate_enabled) return original;
  if (!cfg.baseTag || cfg.baseTag.toUpperCase() === PLACEHOLDER) return original;

  return cfg.urlTemplate
    .replace("{product_url}", original)
    .replace("{base_tag}", encodeURIComponent(cfg.baseTag));
}
