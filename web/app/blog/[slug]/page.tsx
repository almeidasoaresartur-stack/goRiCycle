import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { SiteFooter } from "@/components/SiteFooter";
import { BLOG_POSTS, getBlogPost } from "@/lib/blog";
import { getCatalogStats } from "@/lib/products";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function renderInlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} className="font-semibold text-slate-900">
          {part.slice(2, -2)}
        </strong>
      );
    }

    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={index}>{part.slice(1, -1)}</em>;
    }

    return part;
  });
}

function BlogContent({ content }: { content: string }) {
  const blocks = content.split("\n\n");

  return (
    <div className="space-y-4 text-base leading-relaxed text-slate-700">
      {blocks.map((block, index) => {
        const trimmed = block.trim();
        if (!trimmed) return null;

        if (trimmed.startsWith("## ")) {
          return (
            <h2 key={index} className="mt-10 text-xl font-semibold text-slate-900 first:mt-0">
              {trimmed.replace("## ", "")}
            </h2>
          );
        }

        const lines = trimmed.split("\n");
        if (lines.every((line) => line.startsWith("- "))) {
          return (
            <ul key={index} className="list-disc space-y-2 pl-5">
              {lines.map((line, lineIndex) => (
                <li key={lineIndex}>{renderInlineMarkdown(line.replace(/^- /, ""))}</li>
              ))}
            </ul>
          );
        }

        return (
          <p key={index}>
            {lines.map((line, lineIndex) => (
              <span key={lineIndex}>
                {lineIndex > 0 ? <br /> : null}
                {renderInlineMarkdown(line)}
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}

export function generateStaticParams() {
  return BLOG_POSTS.map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) return {};

  return {
    title: `${post.title} — goRiCycle`,
    description: post.description,
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const stats = getCatalogStats();

  return (
    <>
      <main className="flex-1">
        <section className="border-b border-slate-100 bg-gradient-to-b from-white to-[#f5f5f7] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <Link href="/blog" className="text-sm text-emerald-600 hover:underline">
              ← Voltar ao blog
            </Link>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              {post.title}
            </h1>
            <p className="mt-3 text-sm text-slate-400">
              {new Date(post.publishedAt).toLocaleDateString("pt-PT", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
              {" · "}
              {post.readingMinutes} min de leitura
            </p>
          </div>
        </section>

        <section className="px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <BlogContent content={post.content} />
          </div>

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
        </section>
      </main>

      <SiteFooter
        totalProducts={stats.totalProducts}
        lastScraped={stats.lastScraped}
        brandCounts={stats.brandCounts}
      />
    </>
  );
}
