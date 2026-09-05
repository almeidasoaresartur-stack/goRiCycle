import Link from "next/link";
import { Smartphone, Tablet } from "lucide-react";

import { HUBS, type HubId } from "@/lib/hubs";

const ICONS: Record<HubId, typeof Smartphone> = {
  smartphones: Smartphone,
  tablets: Tablet,
  apple: Smartphone,
  samsung: Smartphone,
};

const TEASERS: Record<HubId, string> = {
  smartphones: "iPhone, Galaxy e Pixel",
  tablets: "iPad e Galaxy Tab",
  apple: "iPhone e iPad",
  samsung: "Galaxy — telemóveis e tablets",
};

export function HubExploreSection() {
  return (
    <section className="border-y border-slate-100 bg-white px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl">
        <p className="text-sm font-medium uppercase tracking-wider text-slate-500">
          Explorar por categoria / marca
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
          Páginas para começar a comparar
        </h2>
        <ul className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {HUBS.map((hub) => {
            const Icon = ICONS[hub.id] ?? Smartphone;
            return (
              <li key={hub.id}>
                <Link
                  href={hub.path}
                  className="flex h-full flex-col gap-3 rounded-2xl border border-slate-200 bg-[#F8FAFC] px-4 py-5 transition hover:-translate-y-0.5 hover:border-emerald-400 hover:shadow-md"
                >
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 shadow-sm ring-1 ring-slate-100">
                    <Icon className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                  </span>
                  <span className="text-sm font-semibold text-slate-900">{hub.label}</span>
                  <span className="text-xs leading-relaxed text-slate-500">{TEASERS[hub.id]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
