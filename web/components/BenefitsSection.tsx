import { BadgeCheck, Link2, Scale } from "lucide-react";

const BENEFITS = [
  {
    icon: Scale,
    title: "Preços Transparentes",
    description: "Comparamos as maiores lojas em tempo real.",
  },
  {
    icon: BadgeCheck,
    title: "Graus Normalizados",
    description: "Traduzimos as condições estéticas para uma escala única.",
  },
  {
    icon: Link2,
    title: "Links Diretos",
    description: "Clica e compra na loja oficial com garantia.",
  },
] as const;

export function BenefitsSection() {
  return (
    <section className="border-y border-slate-100 bg-white px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
      <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-3 sm:gap-8">
        {BENEFITS.map(({ icon: Icon, title, description }) => (
          <div key={title} className="flex flex-col items-center text-center sm:items-start sm:text-left">
            <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
              <Icon className="h-5 w-5" strokeWidth={2} />
            </div>
            <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
            <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
