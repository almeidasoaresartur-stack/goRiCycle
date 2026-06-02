import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { PriceAlertForm } from "@/components/PriceAlertForm";
import { ProductCardImage } from "@/components/ProductCardImage";
import { SiteFooter } from "@/components/SiteFooter";
import { StoreLogo } from "@/components/StoreLogo";
import {
  formatProductPageName,
  getAllProductSlugs,
  getListingsForProductSlug,
} from "@/lib/product-pages";
import { getProductImage, techToImageCategory } from "@/lib/productImages";
import { getCatalogStats } from "@/lib/products";
import { resolveListingUrl } from "@/lib/product-urls";
import type { TechType } from "@/lib/marketplace";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function formatPrice(value: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function techLabel(tech: TechType): string {
  switch (tech) {
    case "tablets":
      return "Tablets";
    case "laptops":
      return "Portáteis";
    case "wearables":
      return "Wearables";
    default:
      return "Smartphones";
  }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const group = getListingsForProductSlug(slug);

  if (!group.length) {
    return { title: "Produto não encontrado | goRiCycle" };
  }

  const best = group[0];
  const modelName = formatProductPageName(best.model, best.storage);
  const title = `${modelName} — Melhor Preço em Portugal`;

  return {
    title: `${title} | goRiCycle`,
    description: `Compara preços do ${modelName} nas melhores lojas portuguesas. A partir de ${formatPrice(best.price)}. iServices, Refurbed, Swappie, Certideal e Callphone.`,
    openGraph: {
      title,
      description: `Encontra o melhor preço do ${modelName} em Portugal.`,
      url: `https://goricycle.com/produto/${slug}`,
      siteName: "goRiCycle",
      locale: "pt_PT",
      type: "website",
    },
  };
}

export async function generateStaticParams() {
  return getAllProductSlugs().map((slug) => ({ slug }));
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const group = getListingsForProductSlug(slug);

  if (!group.length) notFound();

  const best = group[0];
  const modelName = formatProductPageName(best.model, best.storage);
  const storeCount = new Set(group.map((listing) => listing.storeSlug)).size;
  const stats = getCatalogStats();
  const imageUrl =
    best.imageUrl ?? getProductImage(best.model, techToImageCategory(best.tech));

  const bestStoreUrl = resolveListingUrl({
    store: best.storeSlug,
    model: best.model,
    storage: best.storage,
    url: best.url,
    affiliateEnabled: best.storeSlug === "swappie" || best.storeSlug === "refurbed",
  });

  return (
    <>
      <main className="flex-1 bg-[#F8FAFC]">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          <nav className="mb-6 text-sm text-slate-400">
            <Link href="/" className="transition hover:text-slate-600">
              goRiCycle
            </Link>
            <span className="mx-2">›</span>
            <Link href="/" className="transition hover:text-slate-600">
              {techLabel(best.tech)}
            </Link>
            <span className="mx-2">›</span>
            <span className="text-slate-700">{modelName}</span>
          </nav>

          <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="mx-auto w-full max-w-[220px] shrink-0 sm:mx-0">
                <ProductCardImage
                  src={imageUrl}
                  fallbackSrc={getProductImage("", techToImageCategory(best.tech))}
                  alt={modelName}
                  containerClassName="relative aspect-square w-full overflow-hidden rounded-xl border border-slate-100 bg-white"
                  sizes="220px"
                />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                  {modelName} — Melhor Preço em Portugal
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Comparámos {group.length} oferta{group.length > 1 ? "s" : ""} em {storeCount}{" "}
                  loja{storeCount > 1 ? "s" : ""} parceira{storeCount > 1 ? "s" : ""}. Actualizado
                  diariamente.
                </p>
              </div>
            </div>
          </div>

          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50/80 p-5">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">
              Melhor preço encontrado
            </p>
            <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-3xl font-bold tracking-tight text-slate-900">
                  {formatPrice(best.price)}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StoreLogo
                    storeSlug={best.storeSlug}
                    storeLabel={best.store}
                    className="max-w-[140px]"
                    height={36}
                  />
                  <span className="text-sm text-slate-500">· {best.grade}</span>
                </div>
              </div>
              <a
                href={bestStoreUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 text-sm font-semibold text-white transition hover:bg-emerald-900"
              >
                Ver oferta
                <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          </div>

          <PriceAlertForm
            model={modelName}
            storage={best.storage}
            price={best.price}
            grade={best.grade}
            className="mb-8"
          />

          <h2 className="mb-3 text-base font-semibold text-slate-900">
            Todas as ofertas disponíveis
          </h2>
          <div className="space-y-3">
            {group.map((listing) => {
              const storeUrl = resolveListingUrl({
                store: listing.storeSlug,
                model: listing.model,
                storage: listing.storage,
                url: listing.url,
                affiliateEnabled:
                  listing.storeSlug === "swappie" || listing.storeSlug === "refurbed",
              });

              return (
                <div
                  key={listing.id}
                  className="flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <StoreLogo
                      storeSlug={listing.storeSlug}
                      storeLabel={listing.store}
                      className="max-w-[160px]"
                      height={32}
                    />
                    <p className="mt-1 text-xs text-slate-500">
                      {listing.grade}
                      {listing.storage ? ` · ${listing.storage}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-4 sm:justify-end">
                    <span className="text-lg font-bold text-slate-900">
                      {formatPrice(listing.price)}
                    </span>
                    <a
                      href={storeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-200"
                    >
                      Ver loja
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-10 border-t border-slate-200 pt-8">
            <h2 className="text-base font-semibold text-slate-900">
              Sobre o {modelName} Recondicionado
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-slate-500">
              O {modelName} recondicionado é uma alternativa sustentável e económica ao produto
              novo. No goRiCycle comparamos os preços em tempo real nas principais lojas
              portuguesas de recondicionados — iServices, Refurbed, Swappie, Certideal e
              Callphone — para que encontres sempre a melhor oferta com garantia.
            </p>
          </div>
        </div>
      </main>

      <SiteFooter
        totalProducts={stats.totalProducts}
        lastScraped={stats.lastScraped}
        brandCounts={stats.brandCounts}
      />
    </>
  );
}
