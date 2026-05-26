import { Crown, ExternalLink, Shield, Store } from "lucide-react";

import { StoreLogo } from "@/components/StoreLogo";
import type { AggregatedProduct } from "@/lib/marketplace";
import { GRADE_TIER_OPTIONS } from "@/lib/marketplace";

const GRADE_STYLES: Record<string, string> = {
  Premium: "bg-purple-50 text-purple-800 ring-purple-100",
  Excelente: "bg-emerald-50 text-emerald-800 ring-emerald-100",
  "Muito Bom": "bg-teal-50 text-teal-800 ring-teal-100",
  Bom: "bg-amber-50 text-amber-900 ring-amber-100",
};

function formatPrice(value: number | null | undefined): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function gradeEmoji(tier: string): string {
  return GRADE_TIER_OPTIONS.find((g) => g.id === tier)?.emoji ?? "🌱";
}

type ProductResultsGridProps = {
  products: AggregatedProduct[];
  minPrice?: number | null;
};

export function ProductResultsGrid({ products, minPrice }: ProductResultsGridProps) {
  const safeProducts = (products ?? []).filter(
    (item) => item?.id && typeof item.minPrice === "number" && item.bestListing,
  );
  const globalMin = minPrice ?? safeProducts[0]?.minPrice ?? null;

  if (safeProducts.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center shadow-sm">
        <p className="text-lg font-semibold text-slate-800">Nenhum resultado encontrado</p>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          Ajusta os filtros ou pesquisa por exemplo &ldquo;iPhone 13&rdquo; ou &ldquo;Galaxy
          S23&rdquo;.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3">
      {safeProducts.map((item) => {
        const best = item.bestListing;
        const isBest = globalMin != null && item.minPrice === globalMin;
        const gradeStyle = GRADE_STYLES[item.grade] ?? GRADE_STYLES.Bom;
        const imageUrl = item.imageUrl ?? best?.imageUrl ?? undefined;
        const storeCount = item.storeCount ?? item.offers?.length ?? 1;

        return (
          <article
            key={item.id}
            className={`group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
              isBest ? "border-emerald-300 ring-2 ring-emerald-100" : "border-slate-200/80"
            }`}
          >
            <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt={item.model ?? "Produto"}
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                  loading="lazy"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-4xl text-slate-300">
                  📱
                </div>
              )}
              {isBest && (
                <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                  <Crown className="h-3 w-3" />
                  Melhor preço
                </span>
              )}
              {item.brand && (
                <span className="absolute right-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-700 shadow-sm backdrop-blur-sm">
                  {item.brand}
                </span>
              )}
            </div>

            <div className="flex flex-1 flex-col p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <StoreLogo
                  storeSlug={best?.storeSlug}
                  storeLabel={best?.store}
                  className="max-w-[120px]"
                />
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${gradeStyle}`}
                >
                  <span>{gradeEmoji(item.gradeTier)}</span>
                  {item.gradeTier ?? "Bom"}
                </span>
              </div>

              <h3 className="line-clamp-2 text-base font-semibold leading-snug text-slate-900">
                {item.model ?? "Modelo desconhecido"}
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {[
                  item.storage,
                  best?.warrantyMonths ? `${best.warrantyMonths} meses garantia` : null,
                  storeCount > 1 ? `${storeCount} lojas comparadas` : null,
                ]
                  .filter(Boolean)
                  .join(" · ") || "Recondicionado certificado"}
              </p>

              {storeCount > 1 && item.offers?.length > 1 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {item.offers.slice(0, 4).map((offer) => (
                    <span
                      key={offer?.id}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600"
                    >
                      <Store className="h-3 w-3" />
                      {offer?.store}: {formatPrice(offer?.price)}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-auto flex items-end justify-between pt-5">
                <div>
                  <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                    A partir de
                  </p>
                  <p className="text-2xl font-bold tracking-tight text-slate-900">
                    {formatPrice(item.minPrice)}
                  </p>
                </div>
                <a
                  href={best?.url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-600"
                >
                  Ver loja
                  <ExternalLink className="h-4 w-4" />
                </a>
              </div>

              <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-slate-400">
                <Shield className="h-3.5 w-3.5" />
                Preço e link recolhidos do scrape · {best?.store ?? "loja parceira"}
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
