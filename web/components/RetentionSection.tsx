"use client";

import { Bell, TrendingDown } from "lucide-react";
import { useState } from "react";

const PRICE_HISTORY = [
  { label: "Jan", value: 319 },
  { label: "Fev", value: 305 },
  { label: "Mar", value: 298 },
  { label: "Abr", value: 289 },
  { label: "Mai", value: 284 },
  { label: "Hoje", value: 256 },
];

function PriceSparkline() {
  const values = PRICE_HISTORY.map((p) => p.value);
  const min = Math.min(...values) - 10;
  const max = Math.max(...values) + 10;
  const w = 320;
  const h = 80;
  const points = values
    .map((v, i) => {
      const x = (i / (values.length - 1)) * w;
      const y = h - ((v - min) / (max - min)) * h;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="rounded-xl bg-slate-50 p-4 ring-1 ring-slate-100">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Histórico de preços (simulado)
        </p>
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
          <TrendingDown className="h-3.5 w-3.5" />
          −19,7% em 6 meses
        </span>
      </div>
      <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full" preserveAspectRatio="none">
        <defs>
          <linearGradient id="sparkFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#059669" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#059669" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon fill="url(#sparkFill)" points={`0,${h} ${points} ${w},${h}`} />
        <polyline
          fill="none"
          stroke="#059669"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points}
        />
      </svg>
      <div className="mt-2 flex justify-between text-[10px] font-medium text-slate-400">
        {PRICE_HISTORY.map((p) => (
          <span key={p.label}>{p.label}</span>
        ))}
      </div>
    </div>
  );
}

type RetentionSectionProps = {
  productLabel: string;
  targetPrice: number;
};

export function RetentionSection({ productLabel, targetPrice }: RetentionSectionProps) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  return (
    <section className="border-t border-slate-100 bg-white px-4 py-16 sm:px-6 lg:px-8">
      <div className="mx-auto grid max-w-5xl gap-10 lg:grid-cols-2">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-emerald-600">
            Fase 2 · Retenção
          </p>
          <h3 className="mt-2 text-xl font-semibold text-slate-900 sm:text-2xl">
            Acompanha a evolução do preço
          </h3>
          <p className="mt-3 text-sm leading-relaxed text-slate-600">
            Em breve, o goRiCycle guardará o histórico real de cada modelo. Por agora, vês uma
            simulação da tendência de queda para {productLabel}.
          </p>
          <div className="mt-6">
            <PriceSparkline />
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-emerald-50/50 p-6 shadow-sm sm:p-8">
          <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-slate-900 text-white">
            <Bell className="h-5 w-5" />
          </div>
          <h3 className="text-xl font-semibold text-slate-900">Criar alerta de preço</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-600">
            Avisem-me quando <strong>{productLabel}</strong> baixar de{" "}
            <strong>
              {new Intl.NumberFormat("pt-PT", { style: "currency", currency: "EUR" }).format(
                targetPrice,
              )}
            </strong>
            .
          </p>

          {submitted ? (
            <p className="mt-6 rounded-xl bg-emerald-100 px-4 py-3 text-sm font-medium text-emerald-900">
              Alerta registado (demo). Na Fase 2, enviaremos email quando o preço descer.
            </p>
          ) : (
            <form
              className="mt-6 flex flex-col gap-3 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                setSubmitted(true);
              }}
            >
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="o.teu@email.com"
                className="h-12 flex-1 rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
              />
              <button
                type="submit"
                className="h-12 shrink-0 rounded-xl bg-emerald-600 px-6 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                Criar alerta
              </button>
            </form>
          )}
          <p className="mt-3 text-xs text-slate-400">Sem spam. Cancela quando quiseres.</p>
        </div>
      </div>
    </section>
  );
}
