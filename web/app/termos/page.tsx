import type { Metadata } from "next";
import Link from "next/link";

import { DisclaimerBlock } from "@/components/DisclaimerBlock";
import { SiteFooter } from "@/components/SiteFooter";
import { getCatalogStats } from "@/lib/products";

export const metadata: Metadata = {
  title: "Termos e Responsabilidade — goRiCycle",
  description:
    "Aviso de isenção de responsabilidade do goRiCycle: plataforma informativa, preços agregados e limitação de responsabilidade.",
};

export default function TermosPage() {
  const stats = getCatalogStats();

  return (
    <>
      <main className="flex-1">
        <section className="border-b border-slate-100 bg-gradient-to-b from-white to-[#f5f5f7] px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-medium uppercase tracking-wider text-emerald-600">
              Informação legal
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Termos e responsabilidade
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-600">
              Condições de utilização da plataforma e limites da nossa responsabilidade como
              agregador de preços.
            </p>
          </div>
        </section>

        <section className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm sm:p-8">
              <DisclaimerBlock />
            </div>

            <p className="mt-8 text-center text-xs text-slate-500">
              Última actualização: Maio 2026 · Dúvidas? Consulta as{" "}
              <Link href="/faq" className="font-medium text-emerald-700 hover:text-emerald-800">
                perguntas frequentes
              </Link>
              .
            </p>
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
