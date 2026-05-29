import { ArrowDownRight, Crown, ExternalLink } from "lucide-react";

export type StoreOffer = {
  id: string;
  store: string;
  storeSlug: "iservices" | "refurbed" | "swappie" | "certideal" | "callphone";
  grade: "Premium" | "Excelente" | "Muito Bom" | "Bom";
  price: number;
  currency: "EUR";
  warrantyMonths: number;
  url: string;
  affiliateEnabled: boolean;
  brand?: string | null;
  isBestPrice?: boolean;
};

type ComparatorSectionProps = {
  model: string;
  storage: string;
  brand?: string | null;
  offers: StoreOffer[];
};

const STORE_STYLES: Record<StoreOffer["storeSlug"], { bg: string; text: string; ring: string }> = {
  iservices: { bg: "bg-sky-50", text: "text-sky-700", ring: "ring-sky-100" },
  refurbed: { bg: "bg-violet-50", text: "text-violet-700", ring: "ring-violet-100" },
  swappie: { bg: "bg-orange-50", text: "text-orange-700", ring: "ring-orange-100" },
  certideal: { bg: "bg-emerald-50", text: "text-emerald-700", ring: "ring-emerald-100" },
  callphone: { bg: "bg-teal-50", text: "text-teal-700", ring: "ring-teal-100" },
};

const GRADE_STYLES: Record<StoreOffer["grade"], string> = {
  Premium: "bg-purple-100 text-purple-800 ring-purple-200/60",
  Excelente: "bg-emerald-100 text-emerald-800 ring-emerald-200/60",
  "Muito Bom": "bg-teal-100 text-teal-800 ring-teal-200/60",
  Bom: "bg-amber-100 text-amber-900 ring-amber-200/60",
};

function formatPrice(value: number) {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

export function ComparatorSection({ model, storage, brand, offers }: ComparatorSectionProps) {
  const sorted = [...offers].sort((a, b) => a.price - b.price);
  const bestPrice = sorted[0]?.price;
  const brandLabel = brand ?? sorted[0]?.brand ?? null;

  return (
    <section className="scroll-mt-20 px-4 py-16 sm:px-6 sm:py-20 lg:px-8" id="comparador">
      <div className="mx-auto max-w-6xl animate-fade-up">
        <div className="mb-8 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-emerald-600">
              Comparador ao vivo
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              {model}{" "}
              <span className="font-normal text-slate-500">{storage}</span>
            </h2>
            {brandLabel && (
              <p className="mt-1 text-sm text-slate-500">
                Marca: <span className="font-medium text-slate-700">{brandLabel}</span>
              </p>
            )}
          </div>
          <p className="text-sm text-slate-500">
            {sorted.length} ofertas · ordenadas por preço
          </p>
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/80 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <th className="px-6 py-4">Loja</th>
                <th className="px-6 py-4">Condição</th>
                <th className="px-6 py-4">Garantia</th>
                <th className="px-6 py-4 text-right">Preço</th>
                <th className="px-6 py-4 text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((offer) => {
                const style = STORE_STYLES[offer.storeSlug];
                const isBest = offer.price === bestPrice;
                return (
                  <tr
                    key={offer.id}
                    className={`border-b border-slate-50 last:border-0 ${isBest ? "bg-emerald-50/40" : ""}`}
                  >
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-3">
                        <span
                          className={`inline-flex rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ${style.bg} ${style.text} ${style.ring}`}
                        >
                          {offer.store}
                        </span>
                        {isBest && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                            <Crown className="h-3 w-3" />
                            Melhor
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <span
                        className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${GRADE_STYLES[offer.grade]}`}
                      >
                        {offer.grade}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-sm text-slate-600">
                      {offer.warrantyMonths} meses
                    </td>
                    <td className="px-6 py-5 text-right">
                      <span className="text-2xl font-bold tracking-tight text-slate-900">
                        {formatPrice(offer.price)}
                      </span>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <a
                        href={offer.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                      >
                        Ver melhor preço
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="flex flex-col gap-4 md:hidden">
          {sorted.map((offer) => {
            const style = STORE_STYLES[offer.storeSlug];
            const isBest = offer.price === bestPrice;
            return (
              <article
                key={offer.id}
                className={`rounded-2xl border bg-white p-5 shadow-sm ${isBest ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200"}`}
              >
                <div className="mb-4 flex items-start justify-between gap-3">
                  <span
                    className={`inline-flex rounded-lg px-3 py-1.5 text-sm font-semibold ring-1 ${style.bg} ${style.text} ${style.ring}`}
                  >
                    {offer.store}
                  </span>
                  {isBest && (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700">
                      <Crown className="h-4 w-4" />
                      Melhor preço
                    </span>
                  )}
                </div>
                <div className="mb-4 flex flex-wrap items-center gap-2">
                  <span
                    className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ring-1 ${GRADE_STYLES[offer.grade]}`}
                  >
                    {offer.grade}
                  </span>
                  <span className="text-xs text-slate-500">{offer.warrantyMonths} meses garantia</span>
                </div>
                <p className="text-3xl font-bold tracking-tight text-slate-900">
                  {formatPrice(offer.price)}
                </p>
                <a
                  href={offer.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
                >
                  Ver melhor preço
                  <ExternalLink className="h-4 w-4" />
                </a>
              </article>
            );
          })}
        </div>

        {bestPrice && sorted.length > 1 && (
          <p className="mt-6 flex items-center justify-center gap-2 text-sm text-emerald-700">
            <ArrowDownRight className="h-4 w-4" />
            Poupança até{" "}
            {formatPrice(sorted[sorted.length - 1].price - bestPrice)} vs. oferta mais cara
          </p>
        )}
      </div>
    </section>
  );
}
