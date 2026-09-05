import Link from "next/link";

import { ProductCardImage } from "@/components/ProductCardImage";
import type { HubCatalog, HubConfig } from "@/lib/hubs";
import { formatModelosOfertas, HUB_PRODUCT_LIMIT } from "@/lib/hubs";
import { productImageAlt } from "@/lib/product-display";
import { getProductImage, techToImageCategory } from "@/lib/productImages";

function formatPrice(value: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

type HubProductGridProps = {
  hub: HubConfig;
  catalog: HubCatalog;
};

export function HubProductGrid({ hub, catalog }: HubProductGridProps) {
  const { products, totalModels, totalOffers } = catalog;
  const showingSubset = totalModels > products.length;

  return (
    <section className="mt-12">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Modelos em destaque</h2>
          <p className="mt-1 text-sm text-slate-500">
            {formatModelosOfertas(totalModels, totalOffers)}
            {showingSubset
              ? ` · a mostrar os ${products.length} mais acessíveis`
              : " · ordenados por preço"}
          </p>
        </div>
        <Link
          href={hub.marketplaceHref}
          className="text-sm font-medium text-emerald-700 transition hover:text-emerald-800"
        >
          Ver todas as ofertas no comparador →
        </Link>
      </div>

      {products.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
          Não há modelos indexáveis nesta categoria neste momento.{" "}
          <Link href={hub.marketplaceHref} className="font-medium text-emerald-700 hover:underline">
            Ver o comparador
          </Link>
          .
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {products.map((product) => {
            const imageUrl =
              product.imageUrl ?? getProductImage(product.model, techToImageCategory(product.tech));

            return (
              <li key={product.slug}>
                <article className="h-full overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-[0_2px_8px_rgba(0,0,0,0.04)] transition hover:-translate-y-0.5 hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
                  <a href={product.href} className="flex h-full flex-col">
                    <ProductCardImage
                      src={imageUrl}
                      fallbackSrc={getProductImage("", techToImageCategory(product.tech))}
                      alt={productImageAlt(product.model, product.storage, "loja parceira")}
                    />
                    <div className="flex flex-1 flex-col p-5">
                      <h3 className="line-clamp-2 text-base font-semibold leading-snug text-slate-900">
                        {product.name}
                      </h3>
                      <p className="mt-1 text-sm text-slate-500">
                        {[
                          product.brand,
                          product.storeCount > 1 ? `${product.storeCount} lojas` : null,
                          `${product.offerCount} oferta${product.offerCount > 1 ? "s" : ""}`,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                      </p>
                      <p className="mt-auto pt-4 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                        A partir de
                      </p>
                      <p className="text-2xl font-bold tracking-tight text-slate-900">
                        {formatPrice(product.price)}
                      </p>
                    </div>
                  </a>
                </article>
              </li>
            );
          })}
        </ul>
      )}

      {showingSubset ? (
        <p className="mt-6 text-center text-sm text-slate-500">
          A mostrar {HUB_PRODUCT_LIMIT} de {totalModels.toLocaleString("pt-PT")} modelos.{" "}
          <Link href={hub.marketplaceHref} className="font-medium text-emerald-700 hover:underline">
            Ver o catálogo completo no comparador
          </Link>
          .
        </p>
      ) : null}
    </section>
  );
}
