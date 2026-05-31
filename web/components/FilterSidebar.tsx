"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal } from "lucide-react";

import {
  BRAND_OPTIONS,
  GRADE_TIER_OPTIONS,
  STORAGE_OPTIONS,
  TECH_TYPES,
  type FilterOptions,
  type MarketplaceFilters,
} from "@/lib/marketplace";
import {
  modelMatchesFilterSearch,
  sortFilterModelNames,
} from "@/lib/product-display";
import { getStoreInfo } from "@/lib/stores";
import type { ProductSource } from "@/lib/types";

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
  const [searchText, setSearchText] = useState(filters.q ?? "");
  const [modelSearch, setModelSearch] = useState("");

  useEffect(() => {
    setSearchText(filters.q ?? "");
  }, [filters.q]);

  const displayModels = useMemo(() => {
    const base = options.models.length ? options.models : [];
    const filtered = base.filter((model) => modelMatchesFilterSearch(model, modelSearch));
    if (filters.model && !filtered.includes(filters.model)) {
      return sortFilterModelNames([filters.model, ...filtered]);
    }
    return filtered;
  }, [options.models, modelSearch, filters.model]);

  const pushParams = useCallback(
    (params: URLSearchParams) => {
      params.set("view", "all");
      params.set("section", "comparador");
      router.push(`/?${params.toString()}#comparador`, { scroll: false });
    },
    [router],
  );

  const updateFilter = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (value) params.set(key, value);
    else params.delete(key);
    if (key === "brand" || key === "tech") params.delete("model");
    pushParams(params);
  };

  useEffect(() => {
    const trimmed = searchText.trim();
    const current = filters.q?.trim() ?? "";
    if (trimmed === current) return;

    const timer = window.setTimeout(() => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      if (trimmed) params.set("q", trimmed);
      else params.delete("q");
      pushParams(params);
    }, 300);

    return () => window.clearTimeout(timer);
  }, [searchText, filters.q, searchParams, pushParams]);

  const toggleStore = (slug: ProductSource) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("store");
    const current = new Set(filters.stores ?? []);

    if (current.has(slug)) {
      current.delete(slug);
    } else {
      current.add(slug);
    }

    if (current.size > 0) {
      params.set("stores", [...current].join(","));
    } else {
      params.delete("stores");
    }

    pushParams(params);
  };

  const clearFilters = () => {
    const params = new URLSearchParams();
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
    <aside className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
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
        <FilterGroup title="Pesquisar">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Ex: iPhone SE, Galaxy S23..."
              className={`${selectClass} pl-9`}
              aria-label="Pesquisar produtos"
            />
          </div>
        </FilterGroup>

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

        <FilterGroup title="Lojas parceiras">
          <div className="flex flex-col gap-2">
            {options.stores.map((slug) => {
              const info = getStoreInfo(slug);
              const checked = filters.stores?.includes(slug) ?? false;
              return (
                <label
                  key={slug}
                  className={`flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition ${
                    checked
                      ? "border-emerald-500 bg-emerald-50"
                      : "border-slate-200 bg-white hover:border-emerald-300 hover:bg-emerald-50/40"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleStore(slug)}
                    className="h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500/30"
                  />
                  {info?.logoSrc ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={info.logoSrc}
                      alt=""
                      className="h-5 w-auto object-contain"
                    />
                  ) : null}
                  <span className="font-medium text-slate-800">{info?.label ?? slug}</span>
                </label>
              );
            })}
            {options.stores.length === 0 && (
              <p className="text-xs text-slate-500">Nenhuma loja disponível nesta selecção.</p>
            )}
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
          <input
            type="text"
            value={modelSearch}
            onChange={(e) => setModelSearch(e.target.value)}
            placeholder="Filtrar modelos (ex: 13, Pro, SE...)"
            className={`${selectClass} mb-2`}
            aria-label="Filtrar lista de modelos"
          />
          <select
            value={filters.model ?? ""}
            onChange={(e) => updateFilter("model", e.target.value || null)}
            className={selectClass}
          >
            <option value="">Todos os modelos</option>
            {displayModels.map((model) => (
              <option key={model} value={model}>
                {model}
              </option>
            ))}
          </select>
          {modelSearch.trim() && displayModels.length === 0 ? (
            <p className="mt-2 text-xs text-slate-500">
              Nenhum modelo corresponde a &ldquo;{modelSearch.trim()}&rdquo;.
            </p>
          ) : null}
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
            <button
              type="button"
              onClick={() => updateFilter("grade", null)}
              className={`${chipClass(!filters.grade)} text-left`}
            >
              Todos os estados
            </button>
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
