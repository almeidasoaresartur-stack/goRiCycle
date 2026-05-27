"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { SlidersHorizontal } from "lucide-react";

import {
  BRAND_OPTIONS,
  COLOR_SWATCHES,
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
    <div className="border-b border-slate-100 pb-4 last:border-0 last:pb-0">
      <p className="mb-2.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
        {title}
      </p>
      {children}
    </div>
  );
}

const selectClass =
  "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15";

export function FilterSidebar({ filters, options, resultCount }: FilterSidebarProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (value) params.set(key, value);
    else params.delete(key);
    params.set("view", "all");
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
        ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm"
        : "border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50"
    }`;

  const availableBrands = BRAND_OPTIONS.filter(
    (brand) => options.brands.length === 0 || options.brands.includes(brand),
  );

  return (
    <aside className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)] lg:sticky lg:top-[5.5rem] lg:max-h-[calc(100vh-6.5rem)] lg:overflow-y-auto">
      <div className="mb-5 flex items-center justify-between">
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

      <p className="mb-4 text-xs text-slate-500">
        {resultCount.toLocaleString("pt-PT")} resultado{resultCount !== 1 ? "s" : ""}
      </p>

      <div className="space-y-4">
        <FilterGroup title="Tipo de tecnologia">
          <div className="flex flex-col gap-1.5">
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
          <select
            value={filters.brand ?? ""}
            onChange={(e) => updateFilter("brand", e.target.value || null)}
            className={selectClass}
          >
            <option value="">Todas as marcas</option>
            {availableBrands.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
        </FilterGroup>

        <FilterGroup title="Modelo">
          <select
            value={filters.model ?? ""}
            onChange={(e) => updateFilter("model", e.target.value || null)}
            className={selectClass}
          >
            <option value="">Todos os modelos</option>
            {(options.models.length ? options.models : []).map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
        </FilterGroup>

        <FilterGroup title="Cor">
          <div className="flex flex-wrap gap-2">
            {COLOR_SWATCHES.map(({ id, label, hex }) => {
              const active = filters.color === id;
              return (
                <button
                  key={id}
                  type="button"
                  title={label}
                  aria-label={label}
                  onClick={() => updateFilter("color", active ? null : id)}
                  className={`h-7 w-7 rounded-full border-2 transition ${
                    active
                      ? "border-emerald-500 ring-2 ring-emerald-100"
                      : "border-white shadow-sm ring-1 ring-slate-200 hover:ring-emerald-200"
                  }`}
                  style={{ backgroundColor: hex }}
                />
              );
            })}
          </div>
          {filters.color && (
            <p className="mt-2 text-xs text-slate-500">
              {COLOR_SWATCHES.find((c) => c.id === filters.color)?.label ?? filters.color}
            </p>
          )}
        </FilterGroup>

        <FilterGroup title="Capacidade">
          <div className="flex flex-wrap gap-1.5">
            {STORAGE_OPTIONS.map((storage) => (
              <button
                key={storage}
                type="button"
                onClick={() =>
                  updateFilter("storage", filters.storage === storage ? null : storage)
                }
                className={`${chipClass(filters.storage === storage)} px-2.5 py-1.5 text-xs`}
              >
                {storage}
              </button>
            ))}
          </div>
        </FilterGroup>

        <FilterGroup title="Estado estético">
          <div className="flex flex-col gap-1.5">
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
