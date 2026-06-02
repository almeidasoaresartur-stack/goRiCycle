import type { MetadataRoute } from "next";

import { getAllProductSlugs } from "@/lib/product-pages";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = "https://goricycle.com";
  const slugs = getAllProductSlugs();

  const productPages: MetadataRoute.Sitemap = slugs.map((slug) => ({
    url: `${baseUrl}/produto/${slug}`,
    lastModified: new Date(),
    changeFrequency: "daily",
    priority: 0.8,
  }));

  return [
    {
      url: baseUrl,
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${baseUrl}/faq`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${baseUrl}/termos`,
      lastModified: new Date(),
      changeFrequency: "monthly",
      priority: 0.3,
    },
    ...productPages,
  ];
}
