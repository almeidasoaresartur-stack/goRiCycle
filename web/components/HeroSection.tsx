"use client";

import { Search } from "lucide-react";
import { Logo, SLOGAN } from "@/components/Logo";

type HeroSectionProps = {
  defaultQuery?: string;
};

export function HeroSection({ defaultQuery = "" }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden bg-slate-900 px-4 pb-8 pt-3 sm:px-6 sm:pb-10 sm:pt-4 lg:px-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-56 w-56 rounded-full bg-emerald-500/10 blur-3xl" />

      <div className="relative mx-auto max-w-4xl text-center animate-fade-up">
        <div className="mb-3 flex justify-center">
          <Logo size="lg" theme="dark" href={null} />
        </div>

        <p className="mb-3 inline-flex max-w-2xl items-center rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1.5 text-xs font-medium leading-relaxed tracking-wide text-emerald-300 sm:text-sm">
          {SLOGAN}
        </p>

        <h1 className="text-2xl font-semibold leading-tight tracking-tight text-white sm:text-3xl lg:text-4xl lg:leading-[1.15]">
          Compara recondicionados em Portugal —{" "}
          <span className="bg-gradient-to-r from-emerald-400 to-teal-400 bg-clip-text text-transparent">
            num só sítio
          </span>
        </h1>

        <p className="mx-auto mt-3 max-w-2xl text-sm leading-relaxed text-slate-300 sm:text-base">
          Smartphones, tablets e portáteis premium — preços claros de 4 lojas parceiras.
        </p>

        <form
          className="mx-auto mt-6 flex max-w-2xl flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
            const params = new URLSearchParams();
            if (q) params.set("q", q);
            params.set("view", "all");
            params.set("tech", "smartphones");
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
              placeholder="iPhone 14, Galaxy S23, iPad, MacBook M2..."
              className="h-12 w-full rounded-2xl border border-slate-700 bg-slate-800 pl-12 pr-4 text-base text-white shadow-sm outline-none transition placeholder:text-slate-500 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20"
            />
          </div>
          <button
            type="submit"
            className="h-12 shrink-0 rounded-2xl bg-emerald-600 px-8 text-base font-semibold text-white shadow-lg shadow-emerald-900/30 transition hover:bg-emerald-500 active:scale-[0.98]"
          >
            Comparar
          </button>
        </form>

        <p className="mt-3 text-xs text-slate-500 sm:text-sm">
          iServices · Refurbed · Swappie · Certideal
        </p>
      </div>
    </section>
  );
}
