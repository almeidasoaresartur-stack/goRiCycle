"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { FilterSidebar } from "@/components/FilterSidebar";
import { ProductResultsGrid } from "@/components/ProductResultsGrid";
import {
  buildFilterOptionsFromAggregated,
  computeMinPrice,
  filterAggregatedProducts,
  parseMarketplaceFilters,
  type AggregatedProduct,
  type MarketplaceFilters,
} from "@/lib/marketplace";

type MarketplaceShellProps = {
  allProducts: AggregatedProduct[];
  defaultFilters: MarketplaceFilters;
};

function MarketplaceContent({ allProducts, defaultFilters }: MarketplaceShellProps) {
  const searchParams = useSearchParams();

  const filters = parseMarketplaceFilters({
    tech: searchParams?.get("tech") ?? defaultFilters.tech ?? "smartphones",
    brand: searchParams?.get("brand") ?? defaultFilters.brand ?? undefined,
    model: searchParams?.get("model") ?? defaultFilters.model ?? undefined,
    storage: searchParams?.get("storage") ?? defaultFilters.storage ?? undefined,
    grade: searchParams?.get("grade") ?? defaultFilters.grade ?? undefined,
    q: searchParams?.get("q") ?? defaultFilters.q ?? undefined,
  });

  const safeProducts = allProducts ?? [];
  const scopedForOptions = filterAggregatedProducts(safeProducts, {
    tech: filters.tech,
    brand: null,
    model: null,
    storage: null,
    grade: null,
    q: filters.q,
  });
  const options = buildFilterOptionsFromAggregated(scopedForOptions);
  const products = filterAggregatedProducts(safeProducts, filters);
  const minPrice = computeMinPrice(products);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(260px,30%)_1fr] lg:gap-8">
      <FilterSidebar filters={filters} options={options} resultCount={products.length} />
      <ProductResultsGrid products={products} minPrice={minPrice} />
    </div>
  );
}

function MarketplaceFallback() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(260px,30%)_1fr] lg:gap-8">
      <div className="h-96 animate-pulse rounded-2xl bg-slate-200/60" />
      <div className="grid gap-5 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-72 animate-pulse rounded-2xl bg-slate-200/60" />
        ))}
      </div>
    </div>
  );
}

export function MarketplaceShell(props: MarketplaceShellProps) {
  return (
    <section
      className="scroll-mt-24 bg-[#f5f5f7] px-4 py-10 sm:px-6 sm:py-14 lg:px-8"
      id="comparador"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-emerald-600">
              Marketplace
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Compara recondicionados
            </h2>
            <p className="mt-2 text-sm text-slate-500">
              Preços reais dos scrapers — filtra por marca, modelo e estado estético.
            </p>
          </div>
        </div>

        <Suspense fallback={<MarketplaceFallback />}>
          <MarketplaceContent {...props} />
        </Suspense>
      </div>
    </section>
  );
}
