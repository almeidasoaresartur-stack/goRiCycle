import type { MetadataRoute } from "next";

import { BLOG_POSTS } from "@/lib/blog";
import { getIndexableProductSlugs } from "@/lib/product-pages";
import { SITE_URL } from "@/lib/seo";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const slugs = getIndexableProductSlugs();
  const latestPost = BLOG_POSTS.reduce(
    (latest, post) => (post.publishedAt > latest ? post.publishedAt : latest),
    BLOG_POSTS[0]?.publishedAt ?? "",
  );

  const productPages: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${SITE_URL}/produto/${slug}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  const blogPosts: MetadataRoute.Sitemap = BLOG_POSTS.map((post) => ({
    url: `${SITE_URL}/blog/${post.slug}`,
    lastModified: new Date(post.publishedAt),
    changeFrequency: "monthly",
    priority: 0.5,
  }));

  return [
    {
      url: SITE_URL,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${SITE_URL}/faq`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${SITE_URL}/termos`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    {
      url: `${SITE_URL}/blog`,
      lastModified: latestPost ? new Date(latestPost) : new Date(),
      changeFrequency: "weekly",
      priority: 0.6,
    },
    ...blogPosts,
    ...productPages,
  ];
}
