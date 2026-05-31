"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { BRAND_OPTIONS } from "@/lib/marketplace";

const BRAND_META: Record<(typeof BRAND_OPTIONS)[number], { label: string; icon: string }> = {
  Apple: { label: "Apple", icon: "🍎" },
  Samsung: { label: "Samsung", icon: "📱" },
  Google: { label: "Google Pixel", icon: "🔍" },
};

type BrandPickerProps = {
  activeBrand?: string | null;
  availableBrands?: string[];
};

export function BrandPicker({ activeBrand, availableBrands = [] }: BrandPickerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const brands = BRAND_OPTIONS.filter(
    (brand) => availableBrands.length === 0 || availableBrands.includes(brand),
  );

  if (brands.length === 0) return null;

  const selectBrand = (brand: string | null) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    if (brand) params.set("brand", brand);
    else params.delete("brand");
    params.delete("model");
    params.set("view", "all");
    params.set("section", "comparador");
    router.push(`/?${params.toString()}#comparador`, { scroll: false });
  };

  const chipClass = (active: boolean) =>
    `inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
      active
        ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm"
        : "border-slate-200 bg-white text-slate-700 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-emerald-300 hover:bg-emerald-50/50"
    }`;

  return (
    <div>
      <p className="mb-3 text-sm font-medium text-slate-700">Explorar por marca</p>
      <div className="flex flex-wrap gap-2 sm:gap-3">
        <button
          type="button"
          onClick={() => selectBrand(null)}
          className={chipClass(!activeBrand)}
          aria-pressed={!activeBrand}
        >
          Todas as marcas
        </button>
        {brands.map((brand) => {
          const meta = BRAND_META[brand];
          const active = activeBrand === brand;
          return (
            <button
              key={brand}
              type="button"
              onClick={() => selectBrand(active ? null : brand)}
              className={chipClass(active)}
              aria-pressed={active}
            >
              <span aria-hidden>{meta.icon}</span>
              {meta.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
