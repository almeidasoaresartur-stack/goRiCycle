"use client";

import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo } from "react";

import { getSelectedStore, parseMarketplaceFilters } from "@/lib/marketplace";
import { getStoreInfo, PARTNER_STORE_SLUGS } from "@/lib/stores";
import type { ProductSource } from "@/lib/types";

const LOGO_WIDTH = 160;
const LOGO_HEIGHT = 44;

function storeButtonClass(active: boolean): string {
  return [
    "group flex min-h-[7.5rem] flex-col items-center justify-center rounded-2xl border p-5 transition-all duration-200",
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-500",
    active
      ? "border-emerald-500 bg-emerald-50 shadow-md ring-2 ring-emerald-200"
      : "border-gray-100 bg-white hover:border-gray-200 hover:shadow-md",
  ].join(" ");
}

export function PartnerStoresSection() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const filters = useMemo(
    () =>
      parseMarketplaceFilters({
        store: searchParams?.get("store") ?? undefined,
        stores: searchParams?.get("stores") ?? undefined,
      }),
    [searchParams],
  );

  const selectedStore = getSelectedStore(filters);

  const navigateCatalog = useCallback(
    (mutate: (params: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      mutate(params);
      params.set("view", "all");
      params.set("section", "comparador");
      router.push(`/?${params.toString()}#comparador`, { scroll: false });
    },
    [router, searchParams],
  );

  const selectStore = (slug: ProductSource | null) => {
    navigateCatalog((params) => {
      params.delete("stores");
      if (slug) {
        params.set("store", slug);
      } else {
        params.delete("store");
      }
    });
  };

  const clearAllFilters = () => {
    navigateCatalog((params) => {
      params.delete("store");
      params.delete("stores");
      params.delete("brand");
      params.delete("model");
      params.delete("storage");
      params.delete("grade");
      params.delete("tech");
    });
  };

  return (
    <section className="w-full px-4 py-10 md:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-col items-center gap-3 sm:flex-row sm:justify-between">
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-gray-400 sm:text-left">
            Lojas Parceiras — filtrar catálogo
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={() => selectStore(null)}
              className={`rounded-full px-4 py-2 text-sm font-semibold transition ${
                !selectedStore
                  ? "bg-emerald-600 text-white shadow-sm"
                  : "border border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50"
              }`}
              aria-pressed={!selectedStore}
            >
              Todos
            </button>
            {selectedStore ? (
              <button
                type="button"
                onClick={clearAllFilters}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-emerald-300 hover:text-emerald-700"
              >
                Limpar filtros
              </button>
            ) : null}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {PARTNER_STORE_SLUGS.map((slug) => {
            const info = getStoreInfo(slug);
            const active = selectedStore === slug;
            const label = info?.label ?? slug;

            return (
              <button
                key={slug}
                type="button"
                onClick={() => selectStore(slug)}
                aria-label={`Filtrar produtos ${label}`}
                aria-pressed={active}
                className={storeButtonClass(active)}
              >
                <div className="flex h-11 w-full items-center justify-center">
                  <Image
                    src={info?.logoSrc ?? `/stores/${slug}.svg`}
                    alt={`Logótipo ${label}`}
                    width={LOGO_WIDTH}
                    height={LOGO_HEIGHT}
                    className={`h-11 w-auto max-w-[90%] object-contain object-center transition-transform duration-200 ${
                      active ? "scale-[1.03]" : "group-hover:scale-[1.02]"
                    }`}
                  />
                </div>
                <span
                  className={`mt-3 text-[11px] font-medium transition-colors ${
                    active ? "text-emerald-700" : "text-gray-400 group-hover:text-gray-600"
                  }`}
                >
                  {active ? "Selecionada ✓" : "Filtrar produtos"}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </section>
  );
}
