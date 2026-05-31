"use client";

function FilterIcon() {
  return (
    <svg
      width="16"
      height="16"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 4h18M7 12h10M11 20h2" />
    </svg>
  );
}

type MobileFilterFabProps = {
  activeFilterCount: number;
  onOpen: () => void;
};

export function MobileFilterFab({ activeFilterCount, onOpen }: MobileFilterFabProps) {
  return (
    <div className="fixed bottom-4 left-1/2 z-30 -translate-x-1/2 md:hidden">
      <button
        type="button"
        onClick={onOpen}
        className="flex min-h-[44px] items-center gap-2 rounded-full bg-gray-900 px-5 py-3 text-sm font-semibold text-white shadow-lg"
      >
        <FilterIcon />
        Filtros
        {activeFilterCount > 0 ? (
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500 text-xs font-bold text-white">
            {activeFilterCount}
          </span>
        ) : null}
      </button>
    </div>
  );
}
