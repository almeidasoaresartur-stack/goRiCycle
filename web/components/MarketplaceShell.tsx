"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { FilterSidebar } from "@/components/FilterSidebar";
import { ProductResultsGrid } from "@/components/ProductResultsGrid";
import {
  buildFilterOptionsFromAggregated,
  buildHighlightProducts,
  catalogFiltersForView,
  computeMinPrice,
  filterAggregatedProducts,
  filterLaunchProducts,
  isCatalogView,
  parseMarketplaceFilters,
  type AggregatedProduct,
  type MarketplaceFilters,
} from "@/lib/marketplace";

type SortOrder = "price_asc" | "price_desc";

type MarketplaceShellProps = {
  allProducts: AggregatedProduct[];
  defaultFilters: MarketplaceFilters;
};

function MarketplaceContent({ allProducts, defaultFilters }: MarketplaceShellProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [sortOrder, setSortOrder] = useState<SortOrder>("price_asc");

  const filters = parseMarketplaceFilters({
    tech: searchParams?.get("tech") ?? defaultFilters.tech ?? "smartphones",
    brand: searchParams?.get("brand") ?? defaultFilters.brand ?? undefined,
    model: searchParams?.get("model") ?? defaultFilters.model ?? undefined,
    storage: searchParams?.get("storage") ?? defaultFilters.storage ?? undefined,
    grade: searchParams?.get("grade") ?? defaultFilters.grade ?? undefined,
    color: searchParams?.get("color") ?? defaultFilters.color ?? undefined,
    q: searchParams?.get("q") ?? defaultFilters.q ?? undefined,
  });

  const viewAll = searchParams?.get("view") === "all";
  const catalogMode = isCatalogView(filters, viewAll);

  const safeProducts = useMemo(() => filterLaunchProducts(allProducts ?? []), [allProducts]);
  const scopedForOptions = filterAggregatedProducts(safeProducts, {
    tech: filters.tech,
    brand: null,
    model: null,
    storage: null,
    grade: null,
    color: null,
    q: filters.q,
  });
  const options = buildFilterOptionsFromAggregated(scopedForOptions);

  const displayProducts = useMemo(() => {
    if (!catalogMode) {
      return buildHighlightProducts(safeProducts);
    }

    const activeFilters = catalogFiltersForView(filters, viewAll);
    const filtered = filterAggregatedProducts(safeProducts, activeFilters);

    return [...filtered].sort((a, b) =>
      sortOrder === "price_asc" ? a.minPrice - b.minPrice : b.minPrice - a.minPrice,
    );
  }, [catalogMode, filters, viewAll, safeProducts, sortOrder]);

  const catalogCount = useMemo(() => {
    const activeFilters = catalogFiltersForView(filters, viewAll);
    return filterAggregatedProducts(safeProducts, activeFilters).length;
  }, [filters, viewAll, safeProducts]);

  const minPrice = computeMinPrice(displayProducts);

  const showAllCatalog = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("view", "all");
    params.set("section", "comparador");
    router.push(`/?${params.toString()}#comparador`, { scroll: false });
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(260px,30%)_1fr] lg:gap-8">
      <FilterSidebar
        filters={filters}
        options={options}
        resultCount={catalogMode ? catalogCount : safeProducts.length}
      />

      <div>
        {!catalogMode ? (
          <>
            <h3 className="mb-3 text-lg font-semibold text-slate-900">Destaques goRiCycle</h3>
            <ProductResultsGrid
              products={displayProducts}
              minPrice={minPrice}
              activeColorFilter={filters.color}
            />
            <div className="mt-6 text-center">
              <button
                type="button"
                onClick={showAllCatalog}
                className="text-sm font-medium text-slate-600 transition hover:text-emerald-600"
              >
                Ver todos os {safeProducts.length.toLocaleString("pt-PT")} produtos →
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="mb-3 flex items-center justify-between">
              <span className="text-sm text-slate-600">
                {catalogCount.toLocaleString("pt-PT")} resultado
                {catalogCount !== 1 ? "s" : ""}
              </span>
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as SortOrder)}
                className="appearance-none rounded-lg border border-slate-200 bg-white px-3 py-1.5 pr-8 text-sm text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
              >
                <option value="price_asc">Preço: mais baixo primeiro</option>
                <option value="price_desc">Preço: mais alto primeiro</option>
              </select>
            </div>
            <ProductResultsGrid
              products={displayProducts}
              minPrice={minPrice}
              activeColorFilter={filters.color}
            />
          </>
        )}
      </div>
    </div>
  );
}

function MarketplaceFallback() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(260px,30%)_1fr] lg:gap-8">
      <div className="h-96 animate-pulse rounded-xl bg-slate-200/60" />
      <div className="grid gap-5 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-72 animate-pulse rounded-xl bg-slate-200/60" />
        ))}
      </div>
    </div>
  );
}

export function MarketplaceShell(props: MarketplaceShellProps) {
  return (
    <section
      className="scroll-mt-24 bg-[#F8FAFC] px-4 py-6 sm:px-6 sm:py-8 lg:px-8"
      id="comparador"
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-emerald-600">
              Marketplace
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Compara recondicionados
            </h2>
            <p className="mt-2 text-sm text-slate-600">
              Selecção curada de modelos recentes — pesquisa ou filtra para ver o catálogo completo.
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
