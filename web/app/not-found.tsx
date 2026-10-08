import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/SiteFooter";
import { getCatalogStats } from "@/lib/products";

export const metadata: Metadata = {
  title: "Página não encontrada — goRiCycle",
  robots: "noindex",
};

const LINKS = [
  { href: "/", label: "Início" },
  { href: "/smartphones", label: "Smartphones" },
  { href: "/tablets", label: "Tablets" },
] as const;

export default function NotFound() {
  const stats = getCatalogStats();

  return (
    <>
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-20 text-center sm:py-28">
        <p className="text-sm font-medium uppercase tracking-wider text-emerald-600">404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Página não encontrada
        </h1>
        <p className="mt-4 max-w-md text-base leading-relaxed text-slate-600">
          Esta página não existe ou foi removida.
        </p>
        <nav className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="inline-flex min-h-[44px] items-center rounded-xl border border-slate-200 bg-white px-5 text-sm font-semibold text-slate-900 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              {link.label}
            </Link>
          ))}
        </nav>
      </main>
      <SiteFooter
        totalProducts={stats.totalProducts}
        uniqueModels={stats.uniqueModels}
        lastScraped={stats.lastScraped}
        brandCounts={stats.brandCounts}
      />
    </>
  );
}
