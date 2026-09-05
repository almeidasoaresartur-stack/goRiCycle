import type { Metadata } from "next";
import { Suspense } from "react";

import { BenefitsSection } from "@/components/BenefitsSection";
import { FaqSection } from "@/components/FaqSection";
import { JsonLd } from "@/components/JsonLd";
import { PartnerStoresSection } from "@/components/PartnerStoresSection";
import { HeroSection } from "@/components/HeroSection";
import { HubExploreSection } from "@/components/HubExploreSection";
import { MarketplaceShell } from "@/components/MarketplaceShell";
import { ScrollToHash } from "@/components/ScrollToHash";
import { SiteFooter } from "@/components/SiteFooter";
import { buildHeroHighlights } from "@/lib/hero-highlights";
import { getAllListings } from "@/lib/load-listings";
import { aggregateListings, parseMarketplaceFilters, type MarketplaceFilters } from "@/lib/marketplace";
import { filterAvailableAggregatedProducts } from "@/lib/product-availability";
import { getCatalogStats, inferBrand, parseSearchQuery } from "@/lib/products";
import { canonicalPath } from "@/lib/seo";
import { buildOrganizationJsonLd, buildWebSiteJsonLd } from "@/lib/structured-data";

export const metadata: Metadata = {
  alternates: {
    canonical: canonicalPath("/"),
  },
};

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";

  const defaultFilters: MarketplaceFilters = parseMarketplaceFilters({
    tech: params.tech,
    brand: params.brand ?? (query ? inferBrand(parseSearchQuery(query).model) ?? undefined : undefined),
    model: params.model ?? (query ? parseSearchQuery(query).model : undefined),
    storage: params.storage ?? (query ? parseSearchQuery(query).storage ?? undefined : undefined),
    grade: params.grade,
    q: query || undefined,
  });

  const listings = getAllListings();
  const allProducts = filterAvailableAggregatedProducts(aggregateListings(listings));
  const heroHighlights = buildHeroHighlights(listings);
  const stats = getCatalogStats();
  return (
    <>
      <JsonLd data={buildOrganizationJsonLd()} />
      <JsonLd data={buildWebSiteJsonLd()} />
      <ScrollToHash trigger={`${query}-${params.tech ?? ""}`} />

      <main className="bg-[#F8FAFC]">
        <HeroSection defaultQuery={query} highlights={heroHighlights} />
        <HubExploreSection />
        <MarketplaceShell
          allProducts={allProducts}
          defaultFilters={defaultFilters}
          totalProducts={stats.totalProducts}
        />
        <Suspense fallback={<div className="h-36 animate-pulse bg-slate-100/50" aria-hidden />}>
          <PartnerStoresSection />
        </Suspense>
        <BenefitsSection />
        <FaqSection />
      </main>

      <SiteFooter
        totalProducts={stats.totalProducts}
        uniqueModels={stats.uniqueModels}
        lastScraped={stats.lastScraped}
        brandCounts={stats.brandCounts}
      />
    </>
  );
}
