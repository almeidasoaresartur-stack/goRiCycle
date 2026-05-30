"use client";

import { useRouter, useSearchParams } from "next/navigation";

import { getStoreInfo } from "@/lib/stores";
import type { ProductSource } from "@/lib/types";

type StoreFilterBadgeProps = {
  storeSlug: ProductSource;
  storeLabel?: string | null;
  /** Destaque quando o filtro desta loja está activo. */
  active?: boolean;
  className?: string;
};

export function StoreFilterBadge({
  storeSlug,
  storeLabel,
  active = false,
  className = "",
}: StoreFilterBadgeProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const label = storeLabel ?? getStoreInfo(storeSlug)?.label ?? storeSlug;

  const handleClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();

    const params = new URLSearchParams(searchParams?.toString() ?? "");
    params.delete("store");
    const current = new Set(
      (params.get("stores") ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
    );

    if (current.has(storeSlug)) {
      current.delete(storeSlug);
    } else {
      current.add(storeSlug);
    }

    if (current.size > 0) {
      params.set("stores", [...current].join(","));
    } else {
      params.delete("stores");
    }

    params.set("view", "all");
    params.set("section", "comparador");
    router.push(`/?${params.toString()}#comparador`, { scroll: false });
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      title={`Filtrar por ${label}`}
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold transition ${
        active
          ? "bg-emerald-900 text-white ring-1 ring-emerald-800"
          : "bg-slate-100 text-slate-700 ring-1 ring-slate-200 hover:bg-emerald-50 hover:text-emerald-700 hover:ring-emerald-200"
      } ${className}`}
    >
      {label}
    </button>
  );
}
