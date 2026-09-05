import { getIndexableProductSlugs } from "@/lib/product-pages";

export type BlogCta = {
  href: string;
  label: string;
};

type PdpOption = {
  slug: string;
  label: string;
};

type CtaSpec =
  | { kind: "pdp"; options: readonly PdpOption[] }
  | { kind: "path"; href: string; label: string };

/**
 * Money CTAs for commercial posts. Product slugs are resolved against the
 * indexable PDP set (same set as the sitemap) so we never emit junk/404 links.
 */
const BLOG_CTA_SPECS: Record<string, readonly CtaSpec[]> = {
  "iphone-13-vale-a-pena-2026": [
    {
      kind: "pdp",
      options: [
        { slug: "iphone-13-128gb-recondicionado", label: "iPhone 13 128GB recondicionado" },
        { slug: "iphone-13-256gb-recondicionado", label: "iPhone 13 256GB recondicionado" },
      ],
    },
    {
      kind: "pdp",
      options: [
        { slug: "iphone-13-pro-128gb-recondicionado", label: "iPhone 13 Pro 128GB recondicionado" },
        { slug: "iphone-13-pro-256gb-recondicionado", label: "iPhone 13 Pro 256GB recondicionado" },
      ],
    },
    {
      kind: "pdp",
      options: [
        { slug: "iphone-13-mini-128gb-recondicionado", label: "iPhone 13 Mini 128GB recondicionado" },
        { slug: "iphone-13-mini-256gb-recondicionado", label: "iPhone 13 Mini 256GB recondicionado" },
      ],
    },
  ],
  "iphone-15-vs-iphone-16-recondicionado": [
    {
      kind: "pdp",
      options: [
        { slug: "iphone-15-128gb-recondicionado", label: "iPhone 15 128GB recondicionado" },
        { slug: "iphone-15-256gb-recondicionado", label: "iPhone 15 256GB recondicionado" },
      ],
    },
    {
      kind: "pdp",
      options: [
        { slug: "iphone-16-128gb-recondicionado", label: "iPhone 16 128GB recondicionado" },
        { slug: "iphone-16-256gb-recondicionado", label: "iPhone 16 256GB recondicionado" },
      ],
    },
    {
      kind: "pdp",
      options: [
        { slug: "iphone-15-pro-128gb-recondicionado", label: "iPhone 15 Pro 128GB recondicionado" },
        { slug: "iphone-15-pro-256gb-recondicionado", label: "iPhone 15 Pro 256GB recondicionado" },
      ],
    },
  ],
  "iphone-se-2022-recondicionado-2026": [
    {
      kind: "pdp",
      options: [
        { slug: "iphone-se-2022-128gb-recondicionado", label: "iPhone SE (2022) 128GB recondicionado" },
        { slug: "iphone-se-2022-64gb-recondicionado", label: "iPhone SE (2022) 64GB recondicionado" },
      ],
    },
    {
      kind: "pdp",
      options: [
        { slug: "iphone-se-2022-64gb-recondicionado", label: "iPhone SE (2022) 64GB recondicionado" },
        { slug: "iphone-se-2022-256gb-recondicionado", label: "iPhone SE (2022) 256GB recondicionado" },
      ],
    },
    {
      kind: "pdp",
      options: [
        { slug: "iphone-13-128gb-recondicionado", label: "iPhone 13 128GB recondicionado" },
        { slug: "iphone-13-256gb-recondicionado", label: "iPhone 13 256GB recondicionado" },
      ],
    },
  ],
  "garantia-bateria-recondicionados-comparacao-lojas": [
    {
      kind: "pdp",
      options: [
        { slug: "iphone-13-128gb-recondicionado", label: "iPhone 13 128GB recondicionado" },
        { slug: "iphone-15-128gb-recondicionado", label: "iPhone 15 128GB recondicionado" },
      ],
    },
    { kind: "path", href: "/smartphones", label: "Ver smartphones recondicionados" },
  ],
  "comparacao-lojas-certideal-iservices-swappie-refurbed-callphone": [
    {
      kind: "pdp",
      options: [
        { slug: "iphone-13-128gb-recondicionado", label: "iPhone 13 128GB recondicionado" },
        { slug: "iphone-15-128gb-recondicionado", label: "iPhone 15 128GB recondicionado" },
      ],
    },
    { kind: "path", href: "/smartphones", label: "Ver smartphones recondicionados" },
  ],
  "google-pixel-vs-iphone-pro-recondicionado": [
    {
      kind: "pdp",
      options: [
        // Prefer a standard Pixel Pro when it is in the indexable set; Fold is the
        // only live Pixel PDP in the current catalogue.
        { slug: "pixel-9-pro-128gb-recondicionado", label: "Pixel 9 Pro 128GB recondicionado" },
        { slug: "pixel-9-pro-256gb-recondicionado", label: "Pixel 9 Pro 256GB recondicionado" },
        { slug: "pixel-8-pro-128gb-recondicionado", label: "Pixel 8 Pro 128GB recondicionado" },
        { slug: "pixel-10-pro-fold-256gb-recondicionado", label: "Pixel 10 Pro Fold 256GB recondicionado" },
      ],
    },
    {
      kind: "pdp",
      options: [
        { slug: "iphone-15-pro-128gb-recondicionado", label: "iPhone 15 Pro 128GB recondicionado" },
        { slug: "iphone-15-pro-256gb-recondicionado", label: "iPhone 15 Pro 256GB recondicionado" },
      ],
    },
    {
      kind: "pdp",
      options: [
        { slug: "iphone-15-pro-max-256gb-recondicionado", label: "iPhone 15 Pro Max 256GB recondicionado" },
        { slug: "iphone-15-pro-max-512gb-recondicionado", label: "iPhone 15 Pro Max 512GB recondicionado" },
      ],
    },
  ],
};

function firstIndexablePdp(
  options: readonly PdpOption[],
  indexable: Set<string>,
  usedSlugs: Set<string>,
): BlogCta | null {
  for (const option of options) {
    if (usedSlugs.has(option.slug)) continue;
    if (!indexable.has(option.slug)) continue;
    return { href: `/produto/${option.slug}`, label: option.label };
  }
  return null;
}

export function getBlogCtas(postSlug: string): BlogCta[] {
  const specs = BLOG_CTA_SPECS[postSlug];
  if (!specs?.length) return [];

  const indexable = new Set(getIndexableProductSlugs());
  const usedSlugs = new Set<string>();
  const ctas: BlogCta[] = [];

  for (const spec of specs) {
    if (spec.kind === "path") {
      ctas.push({ href: spec.href, label: spec.label });
      continue;
    }

    const match = firstIndexablePdp(spec.options, indexable, usedSlugs);
    if (!match) continue;
    usedSlugs.add(match.href.slice("/produto/".length));
    ctas.push(match);
  }

  return ctas;
}
