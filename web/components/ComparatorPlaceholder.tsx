import { Search } from "lucide-react";

type ComparatorPlaceholderProps = {
  query?: string;
};

export function ComparatorPlaceholder({ query }: ComparatorPlaceholderProps) {
  return (
    <section
      className="scroll-mt-20 px-4 py-16 sm:px-6 lg:px-8"
      id="comparador"
    >
      <div className="mx-auto max-w-6xl">
        <div className="rounded-3xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center shadow-sm sm:px-12">
          <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
            <Search className="h-6 w-6" />
          </div>
          {query ? (
            <>
              <h2 className="text-xl font-semibold text-slate-900">
                Sem resultados para &ldquo;{query}&rdquo;
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">
                Tenta &ldquo;iPhone 13 128GB&rdquo;, &ldquo;Samsung Galaxy S23 128GB&rdquo; ou
                &ldquo;Google Pixel 8 128GB&rdquo;.
              </p>
            </>
          ) : (
            <>
              <h2 className="text-xl font-semibold text-slate-900">
                Escolhe um modelo para comparar
              </h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-slate-500">
                Pesquisa acima ou clica num dos recondicionados mais procurados. Mostramos o preço
                de cada loja lado a lado.
              </p>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
