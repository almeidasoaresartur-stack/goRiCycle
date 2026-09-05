import Link from "next/link";

import { JsonLd } from "@/components/JsonLd";
import { buildBreadcrumbJsonLd } from "@/lib/structured-data";

export type BreadcrumbItem = {
  label: string;
  href?: string;
};

type BreadcrumbsProps = {
  items: BreadcrumbItem[];
  jsonLd?: boolean;
};

export function Breadcrumbs({ items, jsonLd = true }: BreadcrumbsProps) {
  if (items.length === 0) return null;

  return (
    <>
      {jsonLd ? (
        <JsonLd
          data={buildBreadcrumbJsonLd(
            items.map((item) => ({
              name: item.label,
              path: item.href,
            })),
          )}
        />
      ) : null}
      <nav aria-label="Breadcrumb" className="mb-6 text-sm text-slate-400">
        <ol className="flex flex-wrap items-center gap-x-0">
          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            return (
              <li key={`${item.label}-${index}`} className="flex items-center">
                {index > 0 ? (
                  <span className="mx-2" aria-hidden>
                    ›
                  </span>
                ) : null}
                {item.href && !isLast ? (
                  <Link href={item.href} className="transition hover:text-slate-600">
                    {item.label}
                  </Link>
                ) : (
                  <span className={isLast ? "text-slate-700" : undefined}>{item.label}</span>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
