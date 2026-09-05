import Link from "next/link";

import type { BlogPost } from "@/lib/blog";

type RelatedBlogPostsProps = {
  posts: BlogPost[];
  title?: string;
};

export function RelatedBlogPosts({
  posts,
  title = "Leituras relacionadas",
}: RelatedBlogPostsProps) {
  if (posts.length === 0) return null;

  return (
    <section className="mt-12 border-t border-slate-200 pt-8">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <ul className="mt-4 space-y-3">
        {posts.map((post) => (
          <li key={post.slug}>
            <Link
              href={`/blog/${post.slug}`}
              className="block rounded-xl border border-slate-200/80 bg-white p-4 transition hover:border-emerald-200 hover:shadow-sm"
            >
              <p className="text-sm font-semibold text-slate-900">{post.title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{post.description}</p>
              <p className="mt-2 text-sm font-medium text-emerald-700">Ler artigo →</p>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
