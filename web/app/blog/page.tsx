import type { Metadata } from "next";
import Link from "next/link";

import { SiteFooter } from "@/components/SiteFooter";
import { BLOG_POSTS } from "@/lib/blog";
import { getCatalogStats } from "@/lib/products";
import { canonicalPath } from "@/lib/seo";

export const metadata: Metadata = {
  title: "Blog — goRiCycle",
  description:
    "Guias, comparações e conselhos para comprar smartphones e tablets recondicionados em Portugal.",
  alternates: {
    canonical: canonicalPath("/blog"),
  },
};

export default function BlogPage() {
  const stats = getCatalogStats();

  return (
    <>
      <main className="flex-1">
        <section className="border-b border-slate-100 bg-gradient-to-b from-white to-[#f5f5f7] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-medium uppercase tracking-wider text-emerald-600">
              Conteúdo editorial
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Blog goRiCycle
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-slate-600">
              Guias de compra, comparações entre modelos e conselhos honestos para comprares bem
              no mercado de recondicionados.
            </p>
          </div>
        </section>

        <section className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-3xl space-y-6">
            {BLOG_POSTS.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="block rounded-2xl border border-slate-100 bg-white p-6 transition hover:border-emerald-200 hover:shadow-sm"
              >
                <p className="text-xs text-slate-400">
                  {new Date(post.publishedAt).toLocaleDateString("pt-PT", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                  {" · "}
                  {post.readingMinutes} min de leitura
                </p>
                <h2 className="mt-2 text-lg font-semibold text-slate-900">{post.title}</h2>
                <p className="mt-1 text-sm leading-relaxed text-slate-600">{post.description}</p>
                <p className="mt-3 text-sm font-medium text-emerald-600">Ler artigo →</p>
              </Link>
            ))}
          </div>
        </section>
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
