import type { Metadata } from "next";

import { Breadcrumbs } from "@/components/Breadcrumbs";
import { HubProductGrid } from "@/components/HubProductGrid";
import { JsonLd } from "@/components/JsonLd";
import { RelatedBlogPosts } from "@/components/RelatedBlogPosts";
import { SiteFooter } from "@/components/SiteFooter";
import {
  formatModelosOfertas,
  getHub,
  getHubCatalog,
  getRelatedBlogPosts,
  type HubId,
} from "@/lib/hubs";
import { getCatalogStats } from "@/lib/products";
import { canonicalPath } from "@/lib/seo";
import { buildItemListJsonLd } from "@/lib/structured-data";

export function generateHubMetadata(hubId: HubId): Metadata {
  const hub = getHub(hubId);
  const canonical = canonicalPath(hub.path);

  return {
    title: hub.metaTitle,
    description: hub.metaDescription,
    alternates: {
      canonical,
    },
    openGraph: {
      type: "website",
      siteName: "goRiCycle",
      title: hub.metaTitle,
      description: hub.metaDescription,
      url: canonical,
      locale: "pt_PT",
    },
  };
}

type HubPageProps = {
  hubId: HubId;
};

export function HubPage({ hubId }: HubPageProps) {
  const hub = getHub(hubId);
  const catalog = getHubCatalog(hub);
  const posts = getRelatedBlogPosts(hub.relatedBlogSlugs);
  const stats = getCatalogStats();

  return (
    <>
      <JsonLd
        data={buildItemListJsonLd(
          catalog.products.map((product) => ({
            url: canonicalPath(product.href),
            name: `${product.name} Recondicionado`,
          })),
        )}
      />
      <main className="flex-1 bg-[#F8FAFC]">
        <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
          <Breadcrumbs
            items={[
              { label: "goRiCycle", href: "/" },
              { label: hub.label, href: hub.path },
            ]}
          />

          <p className="text-sm font-medium uppercase tracking-wider text-emerald-600">
            {hub.kind === "brand" ? "Marca" : "Categoria"}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            {hub.title}
          </h1>
          <p className="mt-3 text-sm text-slate-500">
            {formatModelosOfertas(catalog.totalModels, catalog.totalOffers)} no catálogo indexável
          </p>

          <div className="mt-8 max-w-3xl space-y-4 text-base leading-relaxed text-slate-700">
            {hub.intro.map((paragraph) => (
              <p key={paragraph.slice(0, 48)}>{paragraph}</p>
            ))}
          </div>

          <HubProductGrid hub={hub} catalog={catalog} />
          <RelatedBlogPosts posts={posts} />
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
