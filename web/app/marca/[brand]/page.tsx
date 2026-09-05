import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { generateHubMetadata, HubPage } from "@/components/HubPage";
import { BRAND_HUB_SLUGS, getBrandHub, isBrandHubSlug } from "@/lib/hubs";

type PageProps = {
  params: Promise<{ brand: string }>;
};

export const dynamicParams = false;

export function generateStaticParams() {
  return BRAND_HUB_SLUGS.map((brand) => ({ brand }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { brand } = await params;
  if (!isBrandHubSlug(brand) || !getBrandHub(brand)) {
    return { title: "Marca não encontrada | goRiCycle" };
  }
  return generateHubMetadata(brand);
}

export default async function BrandHubPage({ params }: PageProps) {
  const { brand } = await params;
  const hub = getBrandHub(brand);
  if (!hub) notFound();
  return <HubPage hubId={hub.id} />;
}
