"use client";

import { useEffect } from "react";

type FilterDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  activeFilterCount: number;
  resultCount: number;
  children: React.ReactNode;
};

export function FilterDrawer({
  isOpen,
  onClose,
  activeFilterCount,
  resultCount,
  children,
}: FilterDrawerProps) {
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  const resultLabel = `${resultCount.toLocaleString("pt-PT")} resultado${resultCount !== 1 ? "s" : ""}`;

  return (
    <>
      {isOpen ? (
        <div
          className="fixed inset-0 z-40 bg-black/40 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      ) : null}

      <div
        className={`fixed bottom-0 left-0 right-0 z-50 flex max-h-[85vh] transform flex-col rounded-t-2xl bg-white shadow-2xl transition-transform duration-300 ease-out md:hidden ${
          isOpen ? "translate-y-0" : "translate-y-full pointer-events-none"
        }`}
        aria-hidden={!isOpen}
      >
        <div className="flex-shrink-0 border-b border-gray-100 px-4 pb-2 pt-3">
          <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-gray-300" />
          <div className="flex items-center justify-between">
            <span className="text-base font-semibold text-gray-900">
              Filtros
              {activeFilterCount > 0 ? (
                <span className="ml-2 rounded-full bg-green-600 px-2 py-0.5 text-xs font-bold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </span>
            <button
              type="button"
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600"
              aria-label="Fechar filtros"
            >
              ✕
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">{children}</div>

        <div className="flex-shrink-0 border-t border-gray-100 bg-white px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="min-h-[44px] w-full rounded-xl bg-gray-900 py-3.5 text-sm font-semibold text-white"
          >
            Ver {resultLabel} →
          </button>
        </div>
      </div>
    </>
  );
}
