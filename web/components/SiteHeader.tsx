"use client";

import Link from "next/link";
import { useState } from "react";

import { Logo } from "@/components/Logo";

type SiteHeaderProps = {
  ctaHref?: string;
  ctaLabel?: string;
};

export function SiteHeader({
  ctaHref = "/#comparador",
  ctaLabel = "Explorar ofertas",
}: SiteHeaderProps) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/70 bg-[#F8FAFC]/95 shadow-[0_1px_3px_rgba(0,0,0,0.04)] backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 md:min-h-[4rem] lg:px-8">
        <Logo size="md" className="md:hidden" href="/" />
        <Logo size="header" className="hidden md:flex" href="/" />

        <button
          type="button"
          onClick={() => setMobileMenuOpen((open) => !open)}
          className="min-h-[44px] min-w-[44px] p-2 text-gray-600 md:hidden"
          aria-label={mobileMenuOpen ? "Fechar menu" : "Abrir menu"}
          aria-expanded={mobileMenuOpen}
        >
          {mobileMenuOpen ? (
            "✕"
          ) : (
            <svg
              width="22"
              height="22"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          )}
        </button>

        <nav className="hidden items-center gap-5 md:flex lg:gap-6">
          <Link
            href="/smartphones"
            className="text-sm font-medium text-slate-600 transition hover:text-emerald-600"
          >
            Smartphones
          </Link>
          <Link
            href="/tablets"
            className="text-sm font-medium text-slate-600 transition hover:text-emerald-600"
          >
            Tablets
          </Link>
          <Link
            href="/blog"
            className="text-sm font-medium text-slate-600 transition hover:text-emerald-600"
          >
            Blog
          </Link>
          <Link
            href="/faq"
            className="text-sm font-medium text-slate-600 transition hover:text-emerald-600"
          >
            FAQs
          </Link>
          <Link
            href="/termos"
            className="text-sm font-medium text-slate-600 transition hover:text-emerald-600"
          >
            Termos
          </Link>
          <a
            href={ctaHref}
            className="min-h-[44px] rounded-xl bg-emerald-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-950"
          >
            {ctaLabel}
          </a>
        </nav>
      </div>

      {mobileMenuOpen ? (
        <div className="flex flex-col gap-3 border-t border-gray-100 bg-white px-4 py-3 md:hidden">
          <Link
            href="/smartphones"
            className="py-2 text-sm text-gray-700"
            onClick={() => setMobileMenuOpen(false)}
          >
            Smartphones
          </Link>
          <Link
            href="/tablets"
            className="py-2 text-sm text-gray-700"
            onClick={() => setMobileMenuOpen(false)}
          >
            Tablets
          </Link>
          <Link
            href="/blog"
            className="py-2 text-sm text-gray-700"
            onClick={() => setMobileMenuOpen(false)}
          >
            Blog
          </Link>
          <Link
            href="/faq"
            className="py-2 text-sm text-gray-700"
            onClick={() => setMobileMenuOpen(false)}
          >
            FAQs
          </Link>
          <Link
            href="/termos"
            className="py-2 text-sm text-gray-700"
            onClick={() => setMobileMenuOpen(false)}
          >
            Termos
          </Link>
          <a
            href={ctaHref}
            className="min-h-[44px] rounded-xl bg-green-600 px-4 py-2.5 text-center text-sm font-semibold text-white"
            onClick={() => setMobileMenuOpen(false)}
          >
            {ctaLabel}
          </a>
        </div>
      ) : null}
    </header>
  );
}
