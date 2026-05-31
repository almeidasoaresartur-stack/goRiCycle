"use client";

import { Search } from "lucide-react";

import { SLOGAN } from "@/components/Logo";
import { HeroHighlights } from "@/components/HeroHighlights";
import type { HeroHighlight } from "@/lib/hero-highlights";

type HeroSectionProps = {
  defaultQuery?: string;
  highlights?: HeroHighlight[];
};

export function HeroSection({ defaultQuery = "", highlights = [] }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden bg-[#F8FAFC] px-4 pb-4 pt-2 sm:px-6 sm:pb-5 sm:pt-3 lg:px-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl" />

      <div className="relative mx-auto max-w-4xl text-center animate-fade-up">
        <p className="mb-2 inline-flex max-w-2xl items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium leading-relaxed tracking-wide text-emerald-700 sm:text-sm">
          {SLOGAN}
        </p>

        <h1 className="text-xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-2xl lg:text-3xl lg:leading-[1.2]">
          Compara recondicionados em Portugal —{" "}
          <span className="text-emerald-900">num só sítio</span>
        </h1>

        <p className="mx-auto mt-2 max-w-2xl text-sm leading-relaxed text-slate-600">
          Smartphones e tablets premium — preços claros de 5 lojas parceiras.
        </p>

        <form
          className="mx-auto mt-4 flex max-w-2xl flex-col gap-2.5 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            params.set("view", "all");
            params.set("section", "comparador");
            window.location.href = `/?${params.toString()}#comparador`;
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
            <input
              name="q"
              type="search"
              defaultValue={defaultQuery}
              placeholder="iPhone 14, Galaxy S23, iPad Air, Galaxy Tab..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-12 pr-4 text-base text-slate-900 shadow-[0_2px_8px_rgba(0,0,0,0.04)] outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15"
            />
          </div>
          <button
            type="submit"
            className="h-11 shrink-0 rounded-xl bg-emerald-900 px-7 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-950 active:scale-[0.98]"
          >
            Comparar
          </button>
        </form>

        <HeroHighlights highlights={highlights} />
      </div>
    </section>
  );
}
