import { Crown, ExternalLink, Store } from "lucide-react";

import { ProductCardImage } from "@/components/ProductCardImage";
import { StoreLogo } from "@/components/StoreLogo";
import type { AggregatedProduct } from "@/lib/marketplace";
import { GRADE_TIER_OPTIONS } from "@/lib/marketplace";
import { getCleanProductData } from "@/lib/product-display";

const GRADE_STYLES: Record<string, string> = {
  Premium: "bg-purple-50 text-purple-800 ring-purple-100",
  Excelente: "bg-emerald-50 text-emerald-800 ring-emerald-100",
  "Muito Bom": "bg-teal-50 text-teal-800 ring-teal-100",
  Bom: "bg-amber-50 text-amber-900 ring-amber-100",
};

const CARD_SHADOW =
  "shadow-[0_4px_24px_rgba(0,0,0,0.12)] hover:shadow-[0_8px_32px_rgba(0,0,0,0.18)]";

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
  activeColorFilter?: string | null;
};

export function ProductResultsGrid({
  products,
  minPrice,
  activeColorFilter,
}: ProductResultsGridProps) {
  const safeProducts = (products ?? []).filter(
    (item) => item?.id && typeof item.minPrice === "number" && item.bestListing,
  );
  const globalMin = minPrice ?? safeProducts[0]?.minPrice ?? null;

  if (safeProducts.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-2xl border border-slate-200/60 bg-white p-12 text-center shadow-[0_4px_24px_rgba(0,0,0,0.12)]">
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
        const clean = getCleanProductData(item, { activeColorFilter });
        const storeCount = item.storeCount ?? item.offers?.length ?? 1;

        return (
          <article
            key={item.id}
            className={`group flex flex-col overflow-hidden rounded-2xl border bg-white transition-all duration-200 hover:-translate-y-0.5 ${CARD_SHADOW} ${
              isBest ? "border-emerald-200 ring-1 ring-emerald-100" : "border-slate-200/50"
            }`}
          >
            <div className="relative flex items-center justify-center overflow-hidden bg-white">
              <ProductCardImage
                src={clean.imageUrl}
                fallbackSrc={clean.scraperFallbackUrl}
                alt={clean.displayName}
              />
              {isBest && (
                <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-600 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
                  <Crown className="h-3 w-3" />
                  Melhor preço
                </span>
              )}
              {item.brand && (
                <span className="absolute right-3 top-3 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-600 shadow-sm ring-1 ring-slate-100">
                  {item.brand}
                </span>
              )}
            </div>

            <div className="flex flex-1 flex-col p-5">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <StoreLogo
                  storeSlug={best?.storeSlug}
                  storeLabel={best?.store}
                  className="max-w-[180px]"
                  height={42}
                />
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${gradeStyle}`}
                >
                  <span>{gradeEmoji(item.gradeTier)}</span>
                  {item.gradeTier ?? "Bom"}
                </span>
              </div>

              <h3 className="line-clamp-2 text-base font-semibold leading-snug text-slate-900">
                {clean.displayName}
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                {[
                  clean.storageLabel,
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

              <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
                Preço do site oficial · {best?.store ?? "loja parceira"}{" "}
                <span className="text-slate-300">|</span>{" "}
                <span className="font-medium text-green-600">✓ Atualizado diariamente</span>
              </p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
