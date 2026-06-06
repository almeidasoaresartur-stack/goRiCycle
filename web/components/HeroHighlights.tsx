"use client";

import Image from "next/image";

import { cleanBaseModel } from "@/lib/product-display";
import type { HeroHighlight } from "@/lib/hero-highlights";

type HeroHighlightsProps = {
  highlights: HeroHighlight[];
};

export function HeroHighlights({ highlights }: HeroHighlightsProps) {
  if (highlights.length === 0) return null;

  return (
    <div className="mx-auto mb-2 mt-3 w-full max-w-5xl px-1">
      <div className="scrollbar-hide flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 md:grid md:grid-cols-5 md:overflow-visible md:snap-none">
        {highlights.map((product) => (
          <a
            key={`${product.storeSlug}-${product.productId}`}
            href={product.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex min-h-[44px] min-w-[150px] max-w-[170px] flex-shrink-0 snap-start items-center gap-2 rounded-xl border border-gray-100 bg-white px-3 py-2 transition-all duration-150 hover:border-gray-300 hover:shadow-sm md:min-w-0 md:max-w-none md:w-full"
          >
            <div className="relative h-9 w-9 flex-shrink-0 overflow-hidden rounded-lg bg-gray-50">
              {product.imageUrl ? (
                <Image
                  src={product.imageUrl}
                  alt={product.model}
                  fill
                  className="object-contain p-0.5"
                  sizes="36px"
                />
              ) : (
                <div className="h-full w-full rounded-lg bg-gray-100" />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium leading-tight text-gray-800">
                {cleanBaseModel(product.model)}
              </p>
              <p className="truncate text-[10px] leading-tight text-gray-400">
                {product.storeLabel}
                {product.priceFrom ? " · a partir de" : ""}
              </p>
              <p className="text-[12px] font-bold leading-tight text-green-600">
                {product.price.toLocaleString("pt-PT", {
                  style: "currency",
                  currency: "EUR",
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}
