"use client";

import { Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { FilterSidebar } from "@/components/FilterSidebar";
import { ProductResultsGrid } from "@/components/ProductResultsGrid";
import { TechCategoryPicker } from "@/components/TechCategoryPicker";
import {
  buildFilterOptionsFromAggregated,
  buildHighlightProducts,
  catalogFiltersForView,
  computeMinPrice,
  filterAggregatedProducts,
  filterLaunchProducts,
  hasActiveTechFilter,
  isCatalogView,
  parseMarketplaceFilters,
  sortAggregatedProducts,
  type AggregatedProduct,
  type MarketplaceFilters,
  type ProductSortOption,
} from "@/lib/marketplace";

const SORT_OPTIONS: { value: ProductSortOption; label: string }[] = [
  { value: "relevance", label: "Relevância" },
  { value: "newest", label: "Novidades" },
  { value: "price_asc", label: "Preço (mais baixo)" },
  { value: "price_desc", label: "Preço (mais alto)" },
];

const SORT_SELECT_CLASS =
  "ml-auto appearance-none rounded-lg border border-slate-200 bg-white px-3 py-1.5 pr-8 text-sm text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

type ProductSortBarProps = {
  sortOrder: ProductSortOption;
  onSortChange: (value: ProductSortOption) => void;
  title?: string;
  resultLabel?: string;
};

function ProductSortBar({ sortOrder, onSortChange, title, resultLabel }: ProductSortBarProps) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      {title ? (
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      ) : resultLabel ? (
        <span className="text-sm text-slate-600">{resultLabel}</span>
      ) : (
        <span className="text-sm font-medium text-slate-900">Ordenar por</span>
      )}
      <select
        value={sortOrder}
        onChange={(e) => onSortChange(e.target.value as ProductSortOption)}
        className={SORT_SELECT_CLASS}
        aria-label="Ordenar produtos"
      >
        {SORT_OPTIONS.map(({ value, label }) => (
          <option key={value} value={value}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
}

type MarketplaceShellProps = {
  allProducts: AggregatedProduct[];
  defaultFilters: MarketplaceFilters;
};

function MarketplaceContent({ allProducts, defaultFilters }: MarketplaceShellProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [sortOrder, setSortOrder] = useState<ProductSortOption>("relevance");

  const filters = parseMarketplaceFilters({
    tech: searchParams?.get("tech") ?? defaultFilters.tech ?? undefined,
    brand: searchParams?.get("brand") ?? defaultFilters.brand ?? undefined,
    model: searchParams?.get("model") ?? defaultFilters.model ?? undefined,
    storage: searchParams?.get("storage") ?? defaultFilters.storage ?? undefined,
    grade: searchParams?.get("grade") ?? defaultFilters.grade ?? undefined,
    color: searchParams?.get("color") ?? defaultFilters.color ?? undefined,
    q: searchParams?.get("q") ?? defaultFilters.q ?? undefined,
  });

  const viewAll = searchParams?.get("view") === "all";
  const catalogMode = isCatalogView(filters, viewAll);
  const showFilterSidebar = hasActiveTechFilter(filters.tech);

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

  const baseProducts = useMemo(() => {
    if (!catalogMode) {
      return buildHighlightProducts(safeProducts);
    }
    const activeFilters = catalogFiltersForView(filters, viewAll);
    return filterAggregatedProducts(safeProducts, activeFilters);
  }, [catalogMode, filters, viewAll, safeProducts]);

  const displayProducts = useMemo(
    () => sortAggregatedProducts(baseProducts, sortOrder),
    [baseProducts, sortOrder],
  );

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
    <div
      className={`grid grid-cols-1 gap-6 transition-[grid-template-columns,gap] duration-300 ease-in-out lg:gap-8 ${
        showFilterSidebar ? "lg:grid-cols-[minmax(260px,30%)_minmax(0,1fr)]" : ""
      }`}
    >
      <div
        className={`min-w-0 overflow-hidden transition-all duration-300 ease-in-out ${
          showFilterSidebar
            ? "max-h-[3000px] opacity-100"
            : "pointer-events-none max-h-0 opacity-0 lg:max-h-0"
        }`}
        aria-hidden={!showFilterSidebar}
      >
        <div
          className={`transition-transform duration-300 ease-in-out ${
            showFilterSidebar ? "translate-x-0" : "-translate-x-3"
          }`}
        >
          <FilterSidebar
            filters={filters}
            options={options}
            resultCount={catalogMode ? catalogCount : safeProducts.length}
          />
        </div>
      </div>

      <div
        className={`min-w-0 transition-all duration-300 ease-in-out ${
          showFilterSidebar ? "" : "mx-auto w-full max-w-5xl"
        }`}
      >
        {!showFilterSidebar && <TechCategoryPicker activeTech={filters.tech} />}

        {!catalogMode ? (
          <>
            <ProductSortBar
              sortOrder={sortOrder}
              onSortChange={setSortOrder}
              title="Destaques goRiCycle"
            />
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
            <ProductSortBar
              sortOrder={sortOrder}
              onSortChange={setSortOrder}
              resultLabel={`${catalogCount.toLocaleString("pt-PT")} resultado${catalogCount !== 1 ? "s" : ""}`}
            />
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
    <div className="grid grid-cols-1 gap-6 lg:gap-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="mb-5 h-20 animate-pulse rounded-xl bg-slate-200/60" />
        <div className="grid gap-5 sm:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-xl bg-slate-200/60" />
          ))}
        </div>
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
