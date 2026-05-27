import Link from "next/link";

import { Logo } from "@/components/Logo";

type SiteHeaderProps = {
  ctaHref?: string;
  ctaLabel?: string;
};

export function SiteHeader({
  ctaHref = "/#comparador",
  ctaLabel = "Explorar ofertas",
}: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-[#F8FAFC]/95 shadow-[0_1px_3px_rgba(0,0,0,0.04)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Logo size="header" />
        <nav className="flex items-center gap-4 sm:gap-6">
          <Link
            href="/faq"
            className="hidden text-sm font-medium text-slate-600 transition hover:text-emerald-600 sm:inline"
          >
            FAQs
          </Link>
          <Link
            href="/termos"
            className="hidden text-sm font-medium text-slate-600 transition hover:text-emerald-600 sm:inline"
          >
            Termos
          </Link>
          <a
            href={ctaHref}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-500"
          >
            {ctaLabel}
          </a>
        </nav>
      </div>
    </header>
  );
}
