import Link from "next/link";

import type { BlogCta } from "@/lib/blog-ctas";

type BlogMoneyCtasProps = {
  ctas: BlogCta[];
};

export function BlogMoneyCtas({ ctas }: BlogMoneyCtasProps) {
  if (ctas.length === 0) {
    return (
      <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-emerald-100 bg-emerald-50/60 p-6 text-center sm:p-8">
        <p className="text-sm font-medium text-emerald-800">Pronto para comparar preços?</p>
        <p className="mt-2 text-sm text-emerald-900/80">
          Compara em tempo real nas principais lojas portuguesas de recondicionados.
        </p>
        <Link
          href="/"
          className="mt-5 inline-flex rounded-xl bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600"
        >
          Ir para o comparador →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto mt-12 max-w-3xl rounded-2xl border border-emerald-100 bg-emerald-50/60 p-6 sm:p-8">
      <p className="text-center text-sm font-medium text-emerald-800">Compara estes modelos agora</p>
      <p className="mt-2 text-center text-sm text-emerald-900/80">
        Páginas de produto com ofertas actuais nas lojas portuguesas.
      </p>
      <ul className="mt-5 space-y-2">
        {ctas.map((cta) => (
          <li key={cta.href}>
            <Link
              href={cta.href}
              className="flex items-center justify-between rounded-xl border border-emerald-100 bg-white px-4 py-3 text-sm font-medium text-slate-900 transition hover:border-emerald-300 hover:text-emerald-700"
            >
              <span>{cta.label}</span>
              <span aria-hidden>→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
