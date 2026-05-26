import Link from "next/link";
import { ArrowRight, Store } from "lucide-react";

import type { EnrichedPopularModel } from "@/lib/catalog";

type PopularModelsSectionProps = {
  appleModels: EnrichedPopularModel[];
  androidModels: EnrichedPopularModel[];
  activeQuery?: string;
};

function formatPrice(value: number | null) {
  if (value == null) return "—";
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function ModelCard({
  model,
  isActive,
}: {
  model: EnrichedPopularModel;
  isActive: boolean;
}) {
  const href = `/?q=${encodeURIComponent(model.query)}#comparador`;

  return (
    <Link
      href={href}
      className={`group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-emerald-300 hover:shadow-lg ${
        isActive ? "border-emerald-400 ring-2 ring-emerald-100" : "border-slate-200"
      }`}
    >
      <div className="relative aspect-square overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={model.imageUrl}
          alt={model.name}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-slate-700 shadow-sm backdrop-blur-sm">
          {model.brand}
        </span>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <h3 className="text-base font-semibold leading-snug text-slate-900">{model.name}</h3>

        <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500">
          <Store className="h-3.5 w-3.5" />
          {model.storeCount > 0
            ? `${model.storeCount} loja${model.storeCount > 1 ? "s" : ""} comparada${model.storeCount > 1 ? "s" : ""}`
            : "Refurbed · mais em breve"}
        </p>

        <div className="mt-auto flex items-end justify-between pt-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
              Preço desde
            </p>
            <p className="text-2xl font-bold tracking-tight text-slate-900">
              {formatPrice(model.minPrice)}
            </p>
          </div>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-900 text-white transition group-hover:bg-emerald-600">
            <ArrowRight className="h-4 w-4" />
          </span>
        </div>
      </div>
    </Link>
  );
}

function ModelGrid({
  title,
  models,
  activeQuery,
}: {
  title: string;
  models: EnrichedPopularModel[];
  activeQuery?: string;
}) {
  return (
    <div>
      <h3 className="mb-5 text-lg font-semibold text-slate-800">{title}</h3>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {models.map((model) => {
          const isActive =
            activeQuery?.toLowerCase().trim() === model.query.toLowerCase().trim();
          return <ModelCard key={model.id} model={model} isActive={isActive} />;
        })}
      </div>
    </div>
  );
}

export function PopularModelsSection({
  appleModels,
  androidModels,
  activeQuery,
}: PopularModelsSectionProps) {
  return (
    <section className="bg-white px-4 py-16 sm:px-6 sm:py-20 lg:px-8" id="explorar">
      <div className="mx-auto max-w-6xl">
        <div className="mb-12 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-medium uppercase tracking-wider text-emerald-600">
              Destaques
            </p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Os Recondicionados mais procurados em Portugal
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-slate-500">
            Apple e Android — preços mínimos das lojas que monitorizamos. Clica para comparar.
          </p>
        </div>

        <div className="space-y-14">
          <ModelGrid title="Apple" models={appleModels} activeQuery={activeQuery} />
          <ModelGrid title="Samsung, Google, Xiaomi & Huawei" models={androidModels} activeQuery={activeQuery} />
        </div>
      </div>
    </section>
  );
}
