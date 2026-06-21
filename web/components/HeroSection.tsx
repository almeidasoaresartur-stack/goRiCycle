"use client";

import { Clock, Search, ShieldCheck, Tag } from "lucide-react";

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
        <p className="mb-2 text-xs font-medium text-emerald-700 sm:text-sm">{SLOGAN}</p>

        <h1 className="text-xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-2xl lg:text-3xl lg:leading-[1.2]">
          Compara recondicionados em Portugal —{" "}
          <span className="text-emerald-900">num só sítio</span>
        </h1>

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

        <section className="mx-auto mt-6 grid max-w-5xl grid-cols-3 gap-2 px-4 py-4 text-sm sm:gap-4 sm:py-6">
          <div className="flex flex-col items-center gap-1 text-center sm:flex-row sm:items-start sm:gap-2 sm:text-left">
            <Clock className="h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="text-xs font-semibold text-slate-900 sm:text-sm">Poupa tempo</p>
              <p className="hidden text-slate-600 sm:block">
                Compara várias lojas sem abrir um separador para cada uma.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 text-center sm:flex-row sm:items-start sm:gap-2 sm:text-left">
            <ShieldCheck className="h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="text-xs font-semibold text-slate-900 sm:text-sm">Só lojas de confiança</p>
              <p className="hidden text-slate-600 sm:block">
                Trabalhamos apenas com lojas com reputação reconhecida em Portugal.
              </p>
            </div>
          </div>
          <div className="flex flex-col items-center gap-1 text-center sm:flex-row sm:items-start sm:gap-2 sm:text-left">
            <Tag className="h-5 w-5 shrink-0 text-emerald-600" />
            <div>
              <p className="text-xs font-semibold text-slate-900 sm:text-sm">Preços claros</p>
              <p className="hidden text-slate-600 sm:block">
                Sabes sempre a que loja corresponde cada oferta, sem letra pequena.
              </p>
            </div>
          </div>
        </section>

        <HeroHighlights highlights={highlights} />
      </div>
    </section>
  );
}
