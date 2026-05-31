"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { LayoutGrid, LayoutList } from "lucide-react";

import { FilterSidebar } from "@/components/FilterSidebar";
import {
  getTotalPages,
  paginateItems,
  ProductPagination,
} from "@/components/ProductPagination";
import { ProductResultsGrid, type ProductViewMode } from "@/components/ProductResultsGrid";
import { TechCategoryPicker } from "@/components/TechCategoryPicker";
import {
  buildFilterOptionsFromAggregated,
  buildHighlightProducts,
  catalogFiltersForView,
  computeMinPrice,
  deduplicateByBestPricePerStore,
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
  "appearance-none rounded-lg border border-slate-200 bg-white px-3 py-1.5 pr-8 text-sm text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.04)] focus:outline-none focus:ring-2 focus:ring-emerald-500/20";

const VIEW_TOGGLE_CLASS =
  "inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-sm font-medium transition";

function viewToggleClass(active: boolean): string {
  return active
    ? `${VIEW_TOGGLE_CLASS} border-emerald-900 bg-emerald-900 text-white shadow-sm`
    : `${VIEW_TOGGLE_CLASS} border-slate-200 bg-white text-slate-600 hover:border-emerald-300 hover:bg-emerald-50/50`;
}

type ProductSortBarProps = {
  sortOrder: ProductSortOption;
  onSortChange: (value: ProductSortOption) => void;
  viewMode: ProductViewMode;
  onViewModeChange: (mode: ProductViewMode) => void;
  title?: string;
  resultLabel?: string;
};

function ProductSortBar({
  sortOrder,
  onSortChange,
  viewMode,
  onViewModeChange,
  title,
  resultLabel,
}: ProductSortBarProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
      {title ? (
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      ) : resultLabel ? (
        <span className="text-sm text-slate-600">{resultLabel}</span>
      ) : (
        <span className="text-sm font-medium text-slate-900">Ordenar por</span>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-md border border-slate-200 bg-white p-0.5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
          <button
            type="button"
            onClick={() => onViewModeChange("grid")}
            className={viewToggleClass(viewMode === "grid")}
            aria-label="Ver em grelha"
            aria-pressed={viewMode === "grid"}
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Grelha</span>
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("list")}
            className={viewToggleClass(viewMode === "list")}
            aria-label="Ver em lista"
            aria-pressed={viewMode === "list"}
          >
            <LayoutList className="h-4 w-4" />
            <span className="hidden sm:inline">Lista</span>
          </button>
        </div>

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
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<ProductViewMode>("grid");

  const filters = parseMarketplaceFilters({
    tech: searchParams?.get("tech") ?? defaultFilters.tech ?? undefined,
    brand: searchParams?.get("brand") ?? defaultFilters.brand ?? undefined,
    model: searchParams?.get("model") ?? defaultFilters.model ?? undefined,
    storage: searchParams?.get("storage") ?? defaultFilters.storage ?? undefined,
    grade: searchParams?.get("grade") ?? defaultFilters.grade ?? undefined,
    q: searchParams?.get("q") ?? defaultFilters.q ?? undefined,
    store: searchParams?.get("store") ?? undefined,
    stores: searchParams?.get("stores") ?? defaultFilters.stores?.join(",") ?? undefined,
  });

  const viewAll = searchParams?.get("view") === "all";
  const catalogMode = isCatalogView(filters, viewAll);
  const showFilterSidebar =
    hasActiveTechFilter(filters.tech) ||
    viewAll ||
    (filters.stores?.length ?? 0) > 0;

  const safeProducts = useMemo(() => filterLaunchProducts(allProducts ?? []), [allProducts]);
  const scopedForOptions = filterAggregatedProducts(safeProducts, {
    tech: filters.tech,
    brand: filters.brand,
    model: null,
    storage: null,
    grade: null,
    color: null,
    q: null,
    stores: filters.stores,
  });
  const options = buildFilterOptionsFromAggregated(scopedForOptions);

  const activeCatalogFilters = useMemo(
    () => catalogFiltersForView(filters, viewAll),
    [filters, viewAll],
  );

  const filteredProducts = useMemo(() => {
    if (!catalogMode) return safeProducts;
    return filterAggregatedProducts(safeProducts, activeCatalogFilters);
  }, [catalogMode, safeProducts, activeCatalogFilters]);

  const deduplicatedProducts = useMemo(
    () => deduplicateByBestPricePerStore(filteredProducts),
    [filteredProducts],
  );

  const baseProducts = useMemo(() => {
    if (!catalogMode) {
      return buildHighlightProducts(deduplicatedProducts);
    }
    return deduplicatedProducts;
  }, [catalogMode, deduplicatedProducts]);

  const displayProducts = useMemo(
    () => sortAggregatedProducts(baseProducts, sortOrder),
    [baseProducts, sortOrder],
  );

  const paginationResetKey = useMemo(
    () =>
      JSON.stringify({
        tech: filters.tech,
        brand: filters.brand,
        model: filters.model,
        storage: filters.storage,
        grade: filters.grade,
        q: filters.q,
        stores: filters.stores,
        viewAll,
        catalogMode,
        sortOrder,
      }),
    [filters, viewAll, catalogMode, sortOrder],
  );

  useEffect(() => {
    setCurrentPage(1);
  }, [paginationResetKey]);

  const totalPages = getTotalPages(displayProducts.length);
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedProducts = useMemo(
    () => paginateItems(displayProducts, safeCurrentPage),
    [displayProducts, safeCurrentPage],
  );

  const catalogCount = deduplicatedProducts.length;

  const minPrice = computeMinPrice(displayProducts);

  const handleSortChange = (value: ProductSortOption) => {
    setSortOrder(value);
    setCurrentPage(1);
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const showAllCatalog = () => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("view", "all");
    params.set("section", "comparador");
    router.push(`/?${params.toString()}#comparador`, { scroll: false });
  };

  const backToHighlights = () => {
    router.push("/#comparador", { scroll: false });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div
      className={
        showFilterSidebar
          ? "grid grid-cols-1 items-start gap-6 md:grid-cols-[280px_1fr] lg:gap-8"
          : "grid grid-cols-1 items-start gap-6 lg:gap-8"
      }
    >
      {showFilterSidebar ? (
        <div className="sticky top-28 z-10 self-start max-h-[calc(100vh-8rem)] w-full overflow-y-auto overscroll-y-contain md:w-[280px]">
          <FilterSidebar
            filters={filters}
            options={options}
            resultCount={catalogMode ? catalogCount : safeProducts.length}
          />
        </div>
      ) : null}

      <div
        className={`min-w-0 ${
          showFilterSidebar ? "" : "mx-auto w-full max-w-5xl"
        }`}
      >
        {!showFilterSidebar && <TechCategoryPicker activeTech={filters.tech} />}

        {catalogMode ? (
          <button
            type="button"
            onClick={backToHighlights}
            className="mb-4 flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-gray-700"
          >
            ← Voltar aos destaques
          </button>
        ) : null}

        {!catalogMode ? (
          <>
            <ProductSortBar
              sortOrder={sortOrder}
              onSortChange={handleSortChange}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              title="Destaques goRiCycle"
            />
            <ProductResultsGrid
              products={paginatedProducts}
              minPrice={minPrice}
              activeStoreSlugs={filters.stores}
              viewMode={viewMode}
            />
            <ProductPagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
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
              onSortChange={handleSortChange}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              resultLabel={`${catalogCount.toLocaleString("pt-PT")} resultado${catalogCount !== 1 ? "s" : ""}`}
            />
            <ProductResultsGrid
              products={paginatedProducts}
              minPrice={minPrice}
              activeStoreSlugs={filters.stores}
              viewMode={viewMode}
            />
            <ProductPagination
              currentPage={safeCurrentPage}
              totalPages={totalPages}
              onPageChange={handlePageChange}
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
