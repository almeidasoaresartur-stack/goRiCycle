import { BenefitsSection } from "@/components/BenefitsSection";
import { FaqSection } from "@/components/FaqSection";
import { PartnerStoresSection } from "@/components/PartnerStoresSection";
import { HeroSection } from "@/components/HeroSection";
import { MarketplaceShell } from "@/components/MarketplaceShell";
import { ScrollToHash } from "@/components/ScrollToHash";
import { SiteFooter } from "@/components/SiteFooter";
import { getAllAggregatedProducts } from "@/lib/load-listings";
import { parseMarketplaceFilters, type MarketplaceFilters } from "@/lib/marketplace";
import { getCatalogStats, inferBrand, parseSearchQuery } from "@/lib/products";

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
    color: params.color,
    q: query || undefined,
  });

  const allProducts = getAllAggregatedProducts();
  const stats = getCatalogStats();
  return (
    <>
      <ScrollToHash trigger={`${query}-${params.tech ?? ""}`} />

      <main className="bg-[#F8FAFC]">
        <HeroSection defaultQuery={query} />
        <PartnerStoresSection />
        <MarketplaceShell allProducts={allProducts} defaultFilters={defaultFilters} />
        <BenefitsSection />
        <FaqSection />
      </main>

      <SiteFooter
        totalProducts={stats.totalProducts}
        lastScraped={stats.lastScraped}
        brandCounts={stats.brandCounts}
      />
    </>
  );
}
