"use client";

import { Crown, ExternalLink } from "lucide-react";

import { ProductCardImage } from "@/components/ProductCardImage";
import { PriceAlertForm } from "@/components/PriceAlertForm";
import { StoreFilterBadge } from "@/components/StoreFilterBadge";
import { StoreLogo } from "@/components/StoreLogo";
import { trackHighlightClick, trackStoreClick } from "@/lib/analytics";
import type { AggregatedProduct, ProductListing } from "@/lib/marketplace";
import { GRADE_TIER_OPTIONS } from "@/lib/marketplace";
import { aggregatedProductIsAvailable } from "@/lib/product-availability";
import { isDevDebugMode, isSuspiciousListing } from "@/lib/listing-url-debug";
import { getCleanProductData } from "@/lib/product-display";
import { getProductImage, techToImageCategory } from "@/lib/productImages";
import { resolveListingUrl } from "@/lib/product-urls";
import type { ProductSource } from "@/lib/types";

export type ProductViewMode = "grid" | "list";

const GRADE_STYLES: Record<string, string> = {
  Premium: "bg-purple-50 text-purple-800 ring-purple-100",
  Excelente: "bg-emerald-50 text-emerald-800 ring-emerald-100",
  "Muito Bom": "bg-teal-50 text-teal-800 ring-teal-100",
  Bom: "bg-amber-50 text-amber-900 ring-amber-100",
};

const CARD_SHADOW =
  "shadow-[0_2px_8px_rgba(0,0,0,0.04)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]";

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
  activeStoreSlugs?: ProductSource[] | null;
  viewMode?: ProductViewMode;
  variant?: "highlights" | "catalog";
};

type ProductCardProps = {
  item: AggregatedProduct;
  isBest: boolean;
  activeStoreSlugs?: ProductSource[] | null;
  index: number;
  variant: "highlights" | "catalog";
};

function listingHref(listing: ProductListing | null | undefined): string {
  if (!listing) return "#";

  return resolveListingUrl({
    store: listing.storeSlug,
    model: listing.model,
    storage: listing.storage,
    url: listing.url,
    affiliateEnabled: listing.storeSlug === "swappie" || listing.storeSlug === "refurbed",
  });
}

function handleVerOfertaClick(
  item: AggregatedProduct,
  index: number,
  variant: "highlights" | "catalog",
) {
  const best = item.bestListing;
  if (!best) return;

  trackStoreClick({
    model: item.model,
    store: best.store,
    price: best.price,
    category: best.category,
    grade: item.gradeTier,
    storage: item.storage ?? undefined,
  });

  if (variant === "highlights") {
    trackHighlightClick(item.model, index);
  }
}

function ProductGridCard({ item, isBest, activeStoreSlugs, index, variant }: ProductCardProps) {
  const best = item.bestListing;
  const gradeStyle = GRADE_STYLES[item.grade] ?? GRADE_STYLES.Bom;
  const clean = getCleanProductData(item);
  const storeCount = item.storeCount ?? item.offers?.length ?? 1;
  const debugSuspicious = isDevDebugMode() && isSuspiciousListing(best);
  const storeBadgeActive = Boolean(best?.storeSlug && activeStoreSlugs?.includes(best.storeSlug));

  return (
    <article
      className={`group flex flex-col overflow-hidden rounded-xl border bg-white transition-all duration-200 hover:-translate-y-0.5 ${CARD_SHADOW} ${
        debugSuspicious
          ? "border-red-500 ring-2 ring-red-200"
          : isBest
            ? "border-emerald-200 ring-1 ring-emerald-100"
            : "border-slate-200/50"
      }`}
      title={debugSuspicious ? "Link suspeito (debug dev)" : undefined}
    >
      <div className="relative w-full overflow-hidden rounded-t-xl bg-white">
        <ProductCardImage
          src={clean.imageUrl}
          fallbackSrc={getProductImage("", techToImageCategory(item.tech))}
          alt={clean.displayName}
        />
        {isBest && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-900 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-sm">
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
          <div className="flex flex-wrap items-center gap-2">
            <StoreLogo
              storeSlug={best?.storeSlug}
              storeLabel={best?.store}
              className="max-w-[140px]"
              height={42}
            />
            {best?.storeSlug ? (
              <StoreFilterBadge
                storeSlug={best.storeSlug}
                storeLabel={best.store}
                active={storeBadgeActive}
              />
            ) : null}
          </div>
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
              <div
                key={offer?.id}
                className="inline-flex items-center gap-1.5 rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600"
              >
                {offer?.storeSlug ? (
                  <StoreFilterBadge
                    storeSlug={offer.storeSlug}
                    storeLabel={offer.store}
                    active={activeStoreSlugs?.includes(offer.storeSlug)}
                    className="px-1.5 py-0.5 text-[10px] font-medium"
                  />
                ) : (
                  <span>{offer?.store}</span>
                )}
                <span>{formatPrice(offer?.price)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-auto flex flex-col gap-3 pt-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              A partir de
            </p>
            <p className="text-2xl font-bold tracking-tight text-slate-900">
              {formatPrice(item.minPrice)}
            </p>
          </div>
          <a
            href={listingHref(best)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => handleVerOfertaClick(item, index, variant)}
            className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-emerald-900 sm:w-auto"
          >
            Ver Oferta
            <ExternalLink className="h-4 w-4" />
          </a>
        </div>

        <PriceAlertForm
          model={clean.displayName}
          storage={item.storage}
          price={item.minPrice}
          grade={item.gradeTier}
          compact={variant === "highlights"}
          className="mt-4"
        />

        <p className="mt-3 text-[10px] leading-relaxed text-slate-400">
          Preço do site oficial · {best?.store ?? "loja parceira"}{" "}
          <span className="text-slate-400">|</span>{" "}
          {best?.storeSlug === "refurbed" ||
          best?.storeSlug === "iservices" ||
          best?.storeSlug === "certideal" ||
          best?.storeSlug === "swappie" ? (
            <span className="inline-flex items-center gap-1 text-gray-400">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-gray-300" />
              A partir de · preços podem variar na loja
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 font-medium text-emerald-600">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-600" />
              Atualizado diariamente
            </span>
          )}
          {debugSuspicious && (
            <span className="ml-1 font-semibold text-red-600">· ⚠ link a verificar</span>
          )}
        </p>
      </div>
    </article>
  );
}

function ProductListRow({ item, isBest, activeStoreSlugs, index, variant }: ProductCardProps) {
  const best = item.bestListing;
  const gradeStyle = GRADE_STYLES[item.grade] ?? GRADE_STYLES.Bom;
  const clean = getCleanProductData(item);
  const storeCount = item.storeCount ?? item.offers?.length ?? 1;
  const debugSuspicious = isDevDebugMode() && isSuspiciousListing(best);
  const storeBadgeActive = Boolean(best?.storeSlug && activeStoreSlugs?.includes(best.storeSlug));

  return (
    <article
      className={`group grid grid-cols-1 gap-4 rounded-xl border bg-white p-4 transition-all duration-200 sm:grid-cols-[auto_1fr_auto] sm:items-center ${CARD_SHADOW} ${
        debugSuspicious
          ? "border-red-500 ring-2 ring-red-200"
          : isBest
            ? "border-emerald-200 ring-1 ring-emerald-100"
            : "border-slate-200/50"
      }`}
      title={debugSuspicious ? "Link suspeito (debug dev)" : undefined}
    >
      <div className="relative mx-auto shrink-0 sm:mx-0">
        <ProductCardImage
          src={clean.imageUrl}
          fallbackSrc={getProductImage("", techToImageCategory(item.tech))}
          alt={clean.displayName}
          containerClassName="relative h-28 w-28 overflow-hidden rounded-lg border border-slate-100 bg-white sm:h-32 sm:w-32"
          sizes="128px"
        />
        {isBest && (
          <span className="absolute left-1 top-1 inline-flex items-center gap-1 rounded-full bg-emerald-900 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-white shadow-sm">
            <Crown className="h-2.5 w-2.5" />
            Top
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {item.brand && (
            <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
              {item.brand}
            </span>
          )}
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${gradeStyle}`}
          >
            <span>{gradeEmoji(item.gradeTier)}</span>
            {item.gradeTier ?? "Bom"}
          </span>
        </div>

        <h3 className="text-base font-semibold leading-snug text-slate-900 sm:text-lg">
          {clean.displayName}
        </h3>

        <p className="mt-1 text-sm text-slate-600">
          {[
            clean.storageLabel,
            best?.warrantyMonths ? `${best.warrantyMonths} meses garantia` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Recondicionado certificado"}
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-3">
          <StoreLogo
            storeSlug={best?.storeSlug}
            storeLabel={best?.store}
            className="max-w-[160px]"
            height={36}
          />
          {best?.storeSlug ? (
            <StoreFilterBadge
              storeSlug={best.storeSlug}
              storeLabel={best.store}
              active={storeBadgeActive}
            />
          ) : null}
          {storeCount > 1 && (
            <span className="text-xs text-slate-500">{storeCount} lojas comparadas</span>
          )}
          {debugSuspicious && (
            <span className="text-xs font-semibold text-red-600">⚠ link a verificar</span>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-row items-center justify-between gap-4 border-t border-slate-100 pt-4 sm:flex-col sm:items-end sm:justify-center sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0 sm:min-w-[160px]">
        <div className="text-left sm:text-right">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
            A partir de
          </p>
          <p className="text-2xl font-bold tracking-tight text-slate-900">
            {formatPrice(item.minPrice)}
          </p>
        </div>
        <a
          href={listingHref(best)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => handleVerOfertaClick(item, index, variant)}
          className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-emerald-900 sm:w-auto"
        >
          Ver Oferta
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      <PriceAlertForm
        model={clean.displayName}
        storage={item.storage}
        price={item.minPrice}
        grade={item.gradeTier}
        className="sm:col-span-3"
      />
    </article>
  );
}

export function ProductResultsGrid({
  products,
  minPrice,
  activeStoreSlugs,
  viewMode = "grid",
  variant = "catalog",
}: ProductResultsGridProps) {
  const safeProducts = (products ?? []).filter(
    (item) =>
      item?.id &&
      typeof item.minPrice === "number" &&
      item.bestListing &&
      aggregatedProductIsAvailable(item),
  );
  const globalMin = minPrice ?? safeProducts[0]?.minPrice ?? null;

  if (safeProducts.length === 0) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-slate-200/80 bg-white p-12 text-center shadow-[0_2px_8px_rgba(0,0,0,0.04)]">
        <p className="text-lg font-semibold text-slate-800">Nenhum resultado encontrado</p>
        <p className="mt-2 max-w-sm text-sm text-slate-500">
          Ajusta os filtros ou pesquisa por exemplo &ldquo;iPhone 13&rdquo; ou &ldquo;Galaxy
          S23&rdquo;.
        </p>
      </div>
    );
  }

  if (viewMode === "list") {
    return (
      <div className="flex flex-col gap-3">
        {safeProducts.map((item, index) => (
          <ProductListRow
            key={item.id}
            item={item}
            isBest={globalMin != null && item.minPrice === globalMin}
            activeStoreSlugs={activeStoreSlugs}
            index={index}
            variant={variant}
          />
        ))}
      </div>
    );
  }

  return (
    <div
      className={
        variant === "highlights"
          ? "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
          : "grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-5 xl:grid-cols-2 2xl:grid-cols-3"
      }
    >
      {safeProducts.map((item, index) => (
        <ProductGridCard
          key={item.id}
          item={item}
          isBest={globalMin != null && item.minPrice === globalMin}
          activeStoreSlugs={activeStoreSlugs}
          index={index}
          variant={variant}
        />
      ))}
    </div>
  );
}
