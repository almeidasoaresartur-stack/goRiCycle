import { FaqAccordion } from "@/components/FaqAccordion";
import { FAQ_ITEMS } from "@/lib/faq";

export function FaqSection() {
  return (
    <section className="bg-slate-900 px-4 py-16 sm:px-6 sm:py-20 lg:px-8" id="faq">
      <div className="mx-auto max-w-3xl">
        <div className="mb-10 text-center">
          <p className="text-sm font-medium uppercase tracking-wider text-emerald-400">
            Ajuda
          </p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Perguntas frequentes
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-relaxed text-slate-400 sm:text-base">
            Tudo o que precisas de saber sobre como comparar recondicionados no goRiCycle.
          </p>
        </div>

        <FaqAccordion items={FAQ_ITEMS} />
      </div>
    </section>
  );
}
