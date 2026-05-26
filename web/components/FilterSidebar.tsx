"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";

import {
  BRAND_OPTIONS,
  GRADE_TIER_OPTIONS,
  STORAGE_OPTIONS,
  TECH_TYPES,
  type FilterOptions,
  type MarketplaceFilters,
} from "@/lib/marketplace";

type FilterSidebarProps = {
  filters: MarketplaceFilters;
  options: FilterOptions;
  resultCount: number;
};

function FilterGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b border-slate-100 pb-5 last:border-0 last:pb-0">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </p>
      {children}
    </div>
  );
}

export function FilterSidebar({ filters, options, resultCount }: FilterSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (value) params.set(key, value);
    else params.delete(key);
    params.set("section", "comparador");
    router.push(`/?${params.toString()}#comparador`, { scroll: false });
  };

  const clearFilters = () => {
    const params = new URLSearchParams();
    const q = searchParams?.get("q");
    if (q) params.set("q", q);
    params.set("tech", "smartphones");
    params.set("section", "comparador");
    router.push(`/?${params.toString()}#comparador`, { scroll: false });
  };

  const chipClass = (active: boolean) =>
    `rounded-xl border px-3 py-2 text-sm font-medium transition-all ${
      active
        ? "border-emerald-500 bg-emerald-50 text-emerald-800 shadow-sm"
        : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50"
    }`;

  return (
    <aside className="rounded-2xl border border-slate-200/80 bg-slate-50/80 p-5 shadow-sm backdrop-blur-sm lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-emerald-600" />
          <h2 className="text-base font-semibold text-slate-900">Filtros</h2>
        </div>
        <button
          type="button"
          onClick={clearFilters}
          className="text-xs font-medium text-slate-500 transition hover:text-emerald-600"
        >
          Limpar
        </button>
      </div>

      <p className="mb-5 text-xs text-slate-500">
        {resultCount.toLocaleString("pt-PT")} resultado{resultCount !== 1 ? "s" : ""}
      </p>

      <div className="space-y-5">
        <FilterGroup title="Tipo de tecnologia">
          <div className="flex flex-col gap-2">
            {TECH_TYPES.map(({ id, label, icon }) => (
              <button
                key={id}
                type="button"
                onClick={() => updateFilter("tech", id)}
                className={`${chipClass(filters.tech === id)} flex items-center gap-2 text-left`}
              >
                <span>{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="Marca">
          <div className="flex flex-wrap gap-2">
            {BRAND_OPTIONS.map((brand) => {
              const available =
                options.brands.length === 0 || options.brands.includes(brand);
              return (
                <button
                  key={brand}
                  type="button"
                  disabled={!available}
                  onClick={() =>
                    updateFilter("brand", filters.brand === brand ? null : brand)
                  }
                  className={`${chipClass(filters.brand === brand)} disabled:cursor-not-allowed disabled:opacity-40`}
                >
                  {brand}
                </button>
              );
            })}
          </div>
        </FilterGroup>

        <FilterGroup title="Modelo">
          <select
            value={filters.model ?? ""}
            onChange={(e) => updateFilter("model", e.target.value || null)}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
          >
            <option value="">Todos os modelos</option>
            {(options.models.length ? options.models : []).map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </FilterGroup>

        <FilterGroup title="Capacidade">
          <div className="flex flex-wrap gap-2">
            {STORAGE_OPTIONS.map((storage) => (
              <button
                key={storage}
                type="button"
                onClick={() =>
                  updateFilter("storage", filters.storage === storage ? null : storage)
                }
                className={chipClass(filters.storage === storage)}
              >
                {storage}
              </button>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="Estado estético">
          <div className="flex flex-col gap-2">
            {GRADE_TIER_OPTIONS.map(({ id, label, emoji }) => (
              <button
                key={id}
                type="button"
                onClick={() => updateFilter("grade", filters.grade === id ? null : id)}
                className={`${chipClass(filters.grade === id)} flex items-center gap-2 text-left`}
              >
                <span>{emoji}</span>
                {label}
              </button>
            ))}
          </div>
        </FilterGroup>
      </div>
    </aside>
  );
}
