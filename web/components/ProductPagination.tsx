"use client";

export const PRODUCTS_PER_PAGE = 12;

type ProductPaginationProps = {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
};

function pageButtonClass(active: boolean, disabled = false): string {
  const base =
    "inline-flex min-w-[2.25rem] items-center justify-center rounded-md border px-3 py-1.5 text-sm font-medium transition";

  if (disabled) {
    return `${base} cursor-not-allowed border-slate-200 bg-white text-slate-300`;
  }

  if (active) {
    return `${base} border-emerald-900 bg-emerald-900 text-white shadow-sm`;
  }

  return `${base} border-slate-200 bg-white text-slate-700 hover:border-emerald-300 hover:bg-emerald-50/50`;
}

function getVisiblePages(currentPage: number, totalPages: number): (number | "ellipsis")[] {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }

  const pages = new Set<number>([1, totalPages, currentPage]);

  if (currentPage > 1) pages.add(currentPage - 1);
  if (currentPage < totalPages) pages.add(currentPage + 1);
  if (currentPage <= 3) pages.add(2).add(3);
  if (currentPage >= totalPages - 2) pages.add(totalPages - 1).add(totalPages - 2);

  const sorted = [...pages].sort((a, b) => a - b);
  const result: (number | "ellipsis")[] = [];

  for (let index = 0; index < sorted.length; index += 1) {
    const page = sorted[index];
    const previous = sorted[index - 1];

    if (previous != null && page - previous > 1) {
      result.push("ellipsis");
    }

    result.push(page);
  }

  return result;
}

export function ProductPagination({
  currentPage,
  totalPages,
  onPageChange,
}: ProductPaginationProps) {
  if (totalPages <= 1) return null;

  const visiblePages = getVisiblePages(currentPage, totalPages);

  return (
    <nav
      className="mt-8 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2"
      aria-label="Paginação de produtos"
    >
      <button
        type="button"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage <= 1}
        className={pageButtonClass(false, currentPage <= 1)}
        aria-label="Página anterior"
      >
        Anterior
      </button>

      {visiblePages.map((page, index) =>
        page === "ellipsis" ? (
          <span
            key={`ellipsis-${index}`}
            className="inline-flex min-w-[2.25rem] items-center justify-center px-1 text-sm text-slate-400"
            aria-hidden
          >
            …
          </span>
        ) : (
          <button
            key={page}
            type="button"
            onClick={() => onPageChange(page)}
            className={pageButtonClass(page === currentPage)}
            aria-label={`Página ${page}`}
            aria-current={page === currentPage ? "page" : undefined}
          >
            {page}
          </button>
        ),
      )}

      <button
        type="button"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage >= totalPages}
        className={pageButtonClass(false, currentPage >= totalPages)}
        aria-label="Página seguinte"
      >
        Seguinte
      </button>
    </nav>
  );
}

export function paginateItems<T>(items: T[], page: number, perPage = PRODUCTS_PER_PAGE): T[] {
  const safePage = Math.max(1, page);
  const start = (safePage - 1) * perPage;
  return items.slice(start, start + perPage);
}

export function getTotalPages(itemCount: number, perPage = PRODUCTS_PER_PAGE): number {
  if (itemCount <= 0) return 1;
  return Math.ceil(itemCount / perPage);
}
