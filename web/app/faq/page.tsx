import type { Metadata } from "next";
import Link from "next/link";

import { FaqAccordion } from "@/components/FaqAccordion";
import { SiteFooter } from "@/components/SiteFooter";
import { FAQ_ITEMS } from "@/lib/faq";
import { getCatalogStats } from "@/lib/products";

export const metadata: Metadata = {
  title: "FAQs — goRiCycle",
  description:
    "Perguntas frequentes sobre o goRiCycle: o que somos, como comparar recondicionados, graus estéticos e garantia.",
};

export default function FaqPage() {
  const stats = getCatalogStats();

  return (
    <>
      <main className="flex-1">
        <section className="border-b border-slate-100 bg-gradient-to-b from-white to-[#f5f5f7] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-medium uppercase tracking-wider text-emerald-600">
              Centro de ajuda
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Perguntas frequentes
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-600">
              Respostas claras sobre como o goRiCycle te ajuda a encontrar a melhor opção em
              segunda mão — sem complicações.
            </p>
          </div>
        </section>

        <section className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <FaqAccordion items={FAQ_ITEMS} defaultOpenId="o-que-e" />

            <div className="mt-12 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-6 text-center sm:p-8">
              <p className="text-sm font-medium text-emerald-800">Pronto para comparar?</p>
              <p className="mt-2 text-sm text-emerald-900/80">
                Explora ofertas de iPhones, Samsung, Google Pixel e mais — num só sítio.
              </p>
              <Link
                href="/#comparador"
                className="mt-5 inline-flex rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
              >
                Ir para o comparador
              </Link>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter
        totalProducts={stats.totalProducts}
        lastScraped={stats.lastScraped}
        brandCounts={stats.brandCounts}
      />
    </>
  );
}
