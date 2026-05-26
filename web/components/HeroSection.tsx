"use client";

import { Search } from "lucide-react";
import { Logo, SLOGAN } from "@/components/Logo";

type HeroSectionProps = {
  defaultQuery?: string;
};

export function HeroSection({ defaultQuery = "" }: HeroSectionProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-[#fafafa] to-emerald-50/40 px-4 pb-16 pt-10 sm:px-6 sm:pb-20 sm:pt-14 lg:px-8">
      <div className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-100/60 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-teal-100/50 blur-3xl" />

      <div className="relative mx-auto max-w-4xl text-center animate-fade-up">
        <div className="mb-6 flex justify-center">
          <Logo size="lg" href={null} />
        </div>

        <p className="mb-5 inline-flex max-w-2xl items-center rounded-full border border-emerald-200/80 bg-emerald-50 px-4 py-2 text-xs font-medium leading-relaxed tracking-wide text-emerald-800 sm:text-sm">
          {SLOGAN}
        </p>

        <h1 className="text-3xl font-semibold leading-tight tracking-tight text-slate-900 sm:text-4xl lg:text-[2.75rem] lg:leading-[1.15]">
          Compara recondicionados em Portugal —{" "}
          <span className="bg-gradient-to-r from-emerald-600 to-teal-600 bg-clip-text text-transparent">
            num só sítio
          </span>
        </h1>

        <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-slate-600 sm:text-lg">
          Comparamos Apple, Samsung, Google Pixel, Xiaomi, Huawei e mais — num só sítio, com
          preços claros e condições que percebes.
        </p>

        <form
          className="mx-auto mt-10 flex max-w-2xl flex-col gap-3 sm:flex-row"
          onSubmit={(e) => {
            e.preventDefault();
            const q = String(new FormData(e.currentTarget).get("q") ?? "").trim();
            const params = new URLSearchParams();
            if (q) params.set("q", q);
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
              placeholder="iPhone, Galaxy S23, Pixel 8, Xiaomi 13..."
              className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-base text-slate-900 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
            />
          </div>
          <button
            type="submit"
            className="h-14 shrink-0 rounded-2xl bg-slate-900 px-8 text-base font-semibold text-white shadow-lg shadow-slate-900/10 transition hover:bg-slate-800 active:scale-[0.98]"
          >
            Comparar
          </button>
        </form>

        <p className="mt-4 text-sm text-slate-500">
          4 lojas · Apple & Android · iServices · Refurbed · Swappie · Certideal
        </p>
      </div>
    </section>
  );
}
