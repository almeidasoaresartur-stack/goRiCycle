import Link from "next/link";
import { Laptop, Smartphone, Tablet, Watch } from "lucide-react";

import { ANDROID_CATEGORIES, APPLE_CATEGORIES, type QuickCategory } from "@/lib/catalog";

const ICONS = {
  smartphone: Smartphone,
  tablet: Tablet,
  laptop: Laptop,
  watch: Watch,
} as const;

type CategoryQuickBarProps = {
  activeQuery?: string;
  availableBrands?: string[];
};

function CategoryRow({
  title,
  categories,
  activeQuery,
}: {
  title: string;
  categories: QuickCategory[];
  activeQuery?: string;
}) {
  return (
    <div>
      <p className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-400">{title}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {categories.map(({ id, label, query, icon }) => {
          const Icon = ICONS[icon];
          const href = `/?q=${encodeURIComponent(query)}#comparador`;
          const isActive = activeQuery?.toLowerCase() === query.toLowerCase();

          return (
            <Link
              key={id}
              href={href}
              className={`group flex flex-col items-center gap-3 rounded-2xl border bg-white px-4 py-5 text-center shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md ${
                isActive
                  ? "border-emerald-400 ring-2 ring-emerald-100"
                  : "border-slate-200"
              }`}
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-xl transition-colors ${
                  isActive
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-50 text-slate-600 group-hover:bg-emerald-50 group-hover:text-emerald-600"
                }`}
              >
                <Icon className="h-6 w-6" strokeWidth={1.75} />
              </div>
              <span className="text-sm font-semibold text-slate-800">{label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

export function CategoryQuickBar({ activeQuery, availableBrands = [] }: CategoryQuickBarProps) {
  const hasAndroid = availableBrands.some((b) =>
    ["Samsung", "Google"].includes(b),
  );

  return (
    <section className="bg-[#fafafa] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-10">
        <div className="text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-slate-500">
            Explora por categoria
          </p>
          {hasAndroid && (
            <p className="mt-2 text-sm text-emerald-700">
              Apple + Android — {availableBrands.join(" · ")}
            </p>
          )}
        </div>

        <CategoryRow title="Apple" categories={APPLE_CATEGORIES} activeQuery={activeQuery} />
        <CategoryRow
          title="Android & mais"
          categories={ANDROID_CATEGORIES}
          activeQuery={activeQuery}
        />
      </div>
    </section>
  );
}
