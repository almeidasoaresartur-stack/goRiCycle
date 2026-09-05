import type { Metadata } from "next";
import { notFound, permanentRedirect } from "next/navigation";
import { ExternalLink } from "lucide-react";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { PriceAlertForm } from "@/components/PriceAlertForm";
import { JsonLd } from "@/components/JsonLd";
import { ProductCardImage } from "@/components/ProductCardImage";
import { RelatedBlogPosts } from "@/components/RelatedBlogPosts";
import { SiteFooter } from "@/components/SiteFooter";
import { StoreLogo } from "@/components/StoreLogo";
import {
  brandHubPath,
  getRelatedBlogPosts,
  getRelatedBlogSlugsForListing,
  techHubPath,
} from "@/lib/hubs";
import {
  formatProductPageName,
  getAllProductSlugs,
  getListingsForProductSlug,
  getProductSlugIndexation,
  getProductSlugRedirect,
  productPageCanonical,
} from "@/lib/product-pages";
import { productImageAlt } from "@/lib/product-display";
import { getProductImage, techToImageCategory } from "@/lib/productImages";
import { getCatalogStats } from "@/lib/products";
import { resolveListingUrl } from "@/lib/product-urls";
import {
  absoluteMediaUrl,
  buildProductJsonLd,
  formatOgPrice,
  productSchemaName,
  resolveProductBrand,
  SITE_URL,
} from "@/lib/structured-data";
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

function redirectJunkStorageSlug(slug: string): void {
  const destination = getProductSlugRedirect(slug);
  if (destination) permanentRedirect(destination);
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  redirectJunkStorageSlug(slug);
  const group = getListingsForProductSlug(slug);

  if (!group.length) {
    return { title: "Produto não encontrado | goRiCycle" };
  }

  const best = group[0];
  const modelName = formatProductPageName(best.model, best.storage);
  const ogPrice = formatOgPrice(best.price);
  const pageUrl = `${SITE_URL}/produto/${slug}`;
  const indexation = getProductSlugIndexation(slug);
  const canonicalUrl = productPageCanonical(slug);
  const imageUrl =
    best.imageUrl ?? getProductImage(best.model, techToImageCategory(best.tech));
  const absoluteImageUrl = absoluteMediaUrl(imageUrl);

  return {
    title: `${modelName} Recondicionado — a partir de ${ogPrice}€ | goRiCycle`,
    description: `Compara o preço de ${modelName} recondicionado em várias lojas portuguesas. A partir de ${ogPrice}€.`,
    alternates: {
      canonical: canonicalUrl,
    },
    robots: indexation.indexable
      ? { index: true, follow: true }
      : { index: false, follow: true },
    openGraph: {
      type: "website",
      siteName: "goRiCycle",
      title: `${modelName} Recondicionado — a partir de ${ogPrice}€ | goRiCycle`,
      description: `Compara o preço de ${modelName} recondicionado em várias lojas portuguesas. A partir de ${ogPrice}€.`,
      url: pageUrl,
      locale: "pt_PT",
      images: [
        {
          url: absoluteImageUrl,
          alt: productImageAlt(best.model, best.storage, best.store),
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${modelName} Recondicionado — a partir de ${ogPrice}€`,
      description: `Compara o preço de ${modelName} recondicionado em várias lojas portuguesas. A partir de ${ogPrice}€.`,
      images: [absoluteImageUrl],
    },
    other: {
      "og:type": "product",
      "product:price:amount": best.price.toFixed(2),
      "product:price:currency": "EUR",
    },
  };
}

export async function generateStaticParams() {
  return getAllProductSlugs().map((slug) => ({ slug }));
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  redirectJunkStorageSlug(slug);
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

  const brand = resolveProductBrand(best);
  const categoryHref = techHubPath(best.tech);
  const brandHref = brandHubPath(brand);
  const relatedPosts = getRelatedBlogPosts(getRelatedBlogSlugsForListing(best));

  return (
    <>
      <JsonLd
        data={buildProductJsonLd({
          listings: group,
          imageUrl,
          productName: productSchemaName(best.model, best.storage),
          brand,
        })}
      />
      <main className="flex-1 bg-[#F8FAFC]">
        <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[
              { label: "goRiCycle", href: "/" },
              {
                label: techLabel(best.tech),
                href: categoryHref ?? undefined,
              },
              ...(brand && brandHref ? [{ label: brand, href: brandHref }] : []),
              { label: modelName },
            ]}
          />

          <div className="mb-8 overflow-hidden rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm sm:p-6">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
              <div className="mx-auto w-full max-w-[220px] shrink-0 sm:mx-0">
                <ProductCardImage
                  src={imageUrl}
                  fallbackSrc={getProductImage("", techToImageCategory(best.tech))}
                  alt={productImageAlt(best.model, best.storage, best.store)}
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

          <RelatedBlogPosts posts={relatedPosts} title="Guias relacionados" />
        </div>
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
