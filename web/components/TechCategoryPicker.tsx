"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { TECH_TYPES, type TechType } from "@/lib/marketplace";

type TechCategoryPickerProps = {
  activeTech?: string | null;
};

export function TechCategoryPicker({ activeTech }: TechCategoryPickerProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const selectTech = (tech: TechType) => {
    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.set("tech", tech);
    params.set("view", "all");
    params.set("section", "comparador");
    router.push(`/?${params.toString()}#comparador`, { scroll: false });
  };

  return (
    <div className="mb-5">
      <p className="mb-3 text-sm font-medium text-slate-700">Explorar por categoria</p>
      <div className="flex flex-wrap gap-2 sm:gap-3">
        {TECH_TYPES.map(({ id, label, icon }) => {
          const active = activeTech === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => selectTech(id)}
              className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                active
                  ? "border-emerald-500 bg-emerald-50 text-emerald-700 shadow-sm"
                  : "border-slate-200 bg-white text-slate-700 shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:border-emerald-300 hover:bg-emerald-50/50"
              }`}
            >
              <span aria-hidden>{icon}</span>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
