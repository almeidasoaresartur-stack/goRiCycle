"use client";

import type { ActiveFilterChip } from "@/lib/marketplace-active-filters";

function FilterIcon({ className }: { className?: string }) {
  return (
    <svg
      width="12"
      height="12"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      className={className}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10M11 20h2" />
    </svg>
  );
}

type MobileActiveFiltersBarProps = {
  activeFilterCount: number;
  activeFilters: ActiveFilterChip[];
  onOpenFilters: () => void;
  onRemoveFilter: (key: string) => void;
  onClearAll: () => void;
};

export function MobileActiveFiltersBar({
  activeFilterCount,
  activeFilters,
  onOpenFilters,
  onRemoveFilter,
  onClearAll,
}: MobileActiveFiltersBarProps) {
  if (activeFilterCount === 0) return null;

  return (
    <div className="sticky top-14 z-20 flex items-center gap-2 overflow-x-auto border-b border-gray-100 bg-white px-3 py-2 md:hidden">
      <button
        type="button"
        onClick={onOpenFilters}
        className="flex min-h-[44px] flex-shrink-0 items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700"
      >
        <FilterIcon />
        Filtros
        {activeFilterCount > 0 ? (
          <span className="rounded-full bg-green-600 px-1.5 text-xs font-bold text-white">
            {activeFilterCount}
          </span>
        ) : null}
      </button>

      {activeFilters.map((filter) => (
        <button
          key={filter.key}
          type="button"
          onClick={() => onRemoveFilter(filter.key)}
          className="flex min-h-[44px] flex-shrink-0 items-center gap-1 rounded-full bg-gray-900 px-3 py-1.5 text-xs font-medium text-white"
        >
          {filter.label} ✕
        </button>
      ))}

      <button
        type="button"
        onClick={onClearAll}
        className="min-h-[44px] flex-shrink-0 px-2 text-xs text-gray-400"
      >
        Limpar
      </button>
    </div>
  );
}
