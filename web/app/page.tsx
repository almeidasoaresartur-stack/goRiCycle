import { BenefitsSection } from "@/components/BenefitsSection";
import { FaqSection } from "@/components/FaqSection";
import { HeroSection } from "@/components/HeroSection";
import { MarketplaceShell } from "@/components/MarketplaceShell";
import { ScrollToHash } from "@/components/ScrollToHash";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { getAllAggregatedProducts } from "@/lib/load-listings";
import { parseMarketplaceFilters, type MarketplaceFilters } from "@/lib/marketplace";
import { inferTechFromQuery } from "@/lib/inference";
import { getCatalogStats, inferBrand, parseSearchQuery } from "@/lib/products";

type PageProps = {
  searchParams: Promise<Record<string, string | undefined>>;
};

export default async function HomePage({ searchParams }: PageProps) {
  const params = await searchParams;
  const query = params.q?.trim() ?? "";

  const defaultFilters: MarketplaceFilters = parseMarketplaceFilters({
    tech: params.tech ?? (query ? inferTechFromQuery(query) ?? "smartphones" : "smartphones"),
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

      <SiteHeader />

      <main className="bg-[#F8FAFC]">
        <HeroSection defaultQuery={query} />
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
