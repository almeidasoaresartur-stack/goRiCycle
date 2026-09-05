import Link from "next/link";
import { Mail } from "lucide-react";

import { Logo, SLOGAN } from "@/components/Logo";
import { DisclaimerBlock } from "@/components/DisclaimerBlock";
import { NFPM_FOOTNOTE } from "@/lib/legal";
import { ACTIVE_SOURCES } from "@/lib/scraper-data";

type SiteFooterProps = {
  totalProducts?: number;
  uniqueModels?: number;
  lastScraped?: string | null;
  brandCounts?: Record<string, number>;
};

function catalogLabel(totalProducts?: number, uniqueModels?: number): string {
  if (!totalProducts) return "MVP";
  const ofertas = `${totalProducts.toLocaleString("pt-PT")} ofertas`;
  if (!uniqueModels) return ofertas;
  return `${uniqueModels.toLocaleString("pt-PT")} modelos · ${ofertas}`;
}

export function SiteFooter({
  totalProducts,
  uniqueModels,
  lastScraped,
  brandCounts,
}: SiteFooterProps) {
  const scrapedLabel = lastScraped
    ? new Date(lastScraped).toLocaleDateString("pt-PT", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
      })
    : null;

  const topBrands = brandCounts
    ? Object.entries(brandCounts)
        .filter(([b]) => b !== "?" && b !== "Outros")
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([b]) => b)
        .join(" · ")
    : null;

  return (
    <footer className="border-t border-slate-200 bg-white text-slate-600">
      <div className="border-b border-slate-100 px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <DisclaimerBlock compact />
          <p className="mt-4">
            <Link
              href="/termos"
              className="text-xs font-medium text-slate-500 underline-offset-2 transition hover:text-emerald-600 hover:underline"
            >
              Ler aviso completo
            </Link>
          </p>
        </div>
      </div>

      <div className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row sm:items-start">
          <div className="flex flex-col items-center sm:items-start">
            <Logo size="sm" href={null} />
            <p className="mt-3 max-w-sm text-center text-sm text-slate-600 sm:text-left">{SLOGAN}</p>
          </div>
          <div className="text-center text-xs text-slate-500 sm:text-right">
            <p>
              {catalogLabel(totalProducts, uniqueModels)}
              {scrapedLabel ? ` · actualizado ${scrapedLabel}` : ""}
              {` · ${ACTIVE_SOURCES.length} fontes activas`}
            </p>
            {topBrands && <p className="mt-1">{topBrands}</p>}
            <nav className="mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 sm:justify-end">
              <Link
                href="/smartphones"
                className="font-medium text-slate-600 transition hover:text-emerald-600"
              >
                Smartphones
              </Link>
              <span className="hidden text-slate-300 sm:inline" aria-hidden>
                ·
              </span>
              <Link
                href="/tablets"
                className="font-medium text-slate-600 transition hover:text-emerald-600"
              >
                Tablets
              </Link>
              <span className="hidden text-slate-300 sm:inline" aria-hidden>
                ·
              </span>
              <Link
                href="/marca/apple"
                className="font-medium text-slate-600 transition hover:text-emerald-600"
              >
                Apple
              </Link>
              <span className="hidden text-slate-300 sm:inline" aria-hidden>
                ·
              </span>
              <Link
                href="/marca/samsung"
                className="font-medium text-slate-600 transition hover:text-emerald-600"
              >
                Samsung
              </Link>
              <span className="hidden text-slate-300 sm:inline" aria-hidden>
                ·
              </span>
              <Link
                href="/faq"
                className="font-medium text-slate-600 transition hover:text-emerald-600"
              >
                Perguntas frequentes
              </Link>
              <span className="hidden text-slate-300 sm:inline" aria-hidden>
                ·
              </span>
              <Link
                href="/termos"
                className="font-medium text-slate-600 transition hover:text-emerald-600"
              >
                Termos e responsabilidade
              </Link>
              <span className="hidden text-slate-300 sm:inline" aria-hidden>
                ·
              </span>
              <a
                href="mailto:contact@goricycle.com"
                className="inline-flex items-center gap-1.5 font-medium text-slate-600 transition hover:text-emerald-600"
              >
                <Mail className="h-3.5 w-3.5" aria-hidden />
                contact@goricycle.com
              </a>
            </nav>
            <p className="mt-4 max-w-md text-[10px] leading-relaxed text-slate-400 sm:text-right">
              {NFPM_FOOTNOTE}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
