import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { BlogMoneyCtas } from "@/components/BlogMoneyCtas";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { JsonLd } from "@/components/JsonLd";
import { SiteFooter } from "@/components/SiteFooter";
import { BLOG_POSTS, getBlogPost } from "@/lib/blog";
import { getBlogCtas } from "@/lib/blog-ctas";
import { getCatalogStats } from "@/lib/products";
import { canonicalPath } from "@/lib/seo";
import { buildArticleJsonLd } from "@/lib/structured-data";

type PageProps = {
  params: Promise<{ slug: string }>;
};

function renderInlineMarkdown(text: string): ReactNode[] {
  const parts = text.split(/(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*|\*[^*]+\*)/g);

  return parts.map((part, index) => {
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const [, label, href] = linkMatch;
      const isInternal = href.startsWith("/");

      if (isInternal) {
        return (
          <Link key={index} href={href} className="font-medium text-emerald-600 hover:underline">
            {label}
          </Link>
        );
      }

      return (
        <a
          key={index}
          href={href}
          className="font-medium text-emerald-600 hover:underline"
          rel="noopener noreferrer"
          target="_blank"
        >
          {label}
        </a>
      );
    }

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

function parseTableCells(line: string): string[] {
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((cell) => cell.trim());
}

function isTableSeparator(line: string): boolean {
  return /^\|?[\s:|-]+\|[\s:|-]*\|?$/.test(line.trim()) && line.includes("-");
}

function isMarkdownTable(lines: string[]): boolean {
  if (lines.length < 2) return false;
  if (!lines.every((line) => line.trim().startsWith("|"))) return false;
  return isTableSeparator(lines[1]);
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
              {renderInlineMarkdown(trimmed.replace("## ", ""))}
            </h2>
          );
        }

        const lines = trimmed.split("\n");

        if (isMarkdownTable(lines)) {
          const headerCells = parseTableCells(lines[0]);
          const bodyRows = lines.slice(2).map(parseTableCells);

          return (
            <div key={index} className="overflow-x-auto">
              <table className="w-full min-w-[36rem] border-collapse text-left text-sm leading-relaxed text-slate-700 sm:text-base">
                <thead>
                  <tr className="border-b border-slate-200">
                    {headerCells.map((cell, cellIndex) => (
                      <th
                        key={cellIndex}
                        className="px-3 py-2 font-semibold text-slate-900 first:pl-0 last:pr-0"
                      >
                        {renderInlineMarkdown(cell)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {bodyRows.map((row, rowIndex) => (
                    <tr key={rowIndex} className="border-b border-slate-100">
                      {row.map((cell, cellIndex) => (
                        <td key={cellIndex} className="px-3 py-2 align-top first:pl-0 last:pr-0">
                          {renderInlineMarkdown(cell)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

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
    title: post.metaTitle ?? `${post.title} — goRiCycle`,
    description: post.description,
    alternates: {
      canonical: canonicalPath(`/blog/${slug}`),
    },
  };
}

export default async function BlogPostPage({ params }: PageProps) {
  const { slug } = await params;
  const post = getBlogPost(slug);
  if (!post) notFound();

  const stats = getCatalogStats();
  const moneyCtas = getBlogCtas(slug);

  return (
    <>
      <JsonLd
        data={buildArticleJsonLd({
          slug: post.slug,
          title: post.title,
          description: post.description,
          publishedAt: post.publishedAt,
        })}
      />
      <main className="flex-1">
        <section className="border-b border-slate-100 bg-gradient-to-b from-white to-[#f5f5f7] px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <Breadcrumbs
              items={[
                { label: "goRiCycle", href: "/" },
                { label: "Blog", href: "/blog" },
                { label: post.title },
              ]}
            />
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

          <BlogMoneyCtas ctas={moneyCtas} />
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
