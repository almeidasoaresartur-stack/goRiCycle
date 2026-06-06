"use client";

import { useState } from "react";
import { useForm, ValidationError } from "@formspree/react";
import { Bell } from "lucide-react";

const FORMSPREE_FORM_ID =
  process.env.NEXT_PUBLIC_FORMSPREE_PRICE_ALERT_ID ?? "meewjjrv";

/** Destino das submissões Formspree (configurado em formspree.io → alerta@goricycle.com). */
export const PRICE_ALERT_EMAIL = "alerta@goricycle.com";

type PriceAlertFormProps = {
  model: string;
  storage?: string | null;
  price: number;
  grade?: string | null;
  className?: string;
  compact?: boolean;
};

function formatPrice(value: number): string {
  return new Intl.NumberFormat("pt-PT", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export function PriceAlertForm({
  model,
  storage,
  price,
  grade,
  className = "",
  compact = false,
}: PriceAlertFormProps) {
  const [state, handleSubmit] = useForm(FORMSPREE_FORM_ID);
  const [mobileExpanded, setMobileExpanded] = useState(false);

  if (state.succeeded) {
    return (
      <div
        className={`rounded-xl border border-emerald-100 bg-emerald-50/80 px-3 py-3 text-sm text-emerald-900 ${className}`}
      >
        Obrigado! Ficaremos atentos às melhores ofertas para este modelo.
      </div>
    );
  }

  const subject = `Alerta de preço: ${model}${storage ? ` ${storage}` : ""}`;

  return (
    <div
      className={`rounded-xl border border-slate-100 bg-slate-50/60 ${compact ? "md:p-3" : "md:p-4"} ${
        mobileExpanded ? (compact ? "p-3" : "p-4") : "p-2"
      } ${className}`}
    >
      <p
        className={`hidden leading-snug text-slate-600 md:block ${compact ? "text-xs" : "text-sm"}`}
      >
        <Bell
          className={`mb-0.5 mr-1 inline-block align-text-bottom text-emerald-700 ${compact ? "h-3.5 w-3.5" : "h-4 w-4"}`}
          aria-hidden
        />
        Queres este modelo por menos? Deixa o teu e-mail e avisamos-te assim que o preço baixar!
      </p>

      {!mobileExpanded ? (
        <button
          type="button"
          onClick={() => setMobileExpanded(true)}
          aria-label="Avisar-me quando o preço baixar"
          aria-expanded={false}
          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-base shadow-sm transition hover:border-emerald-300 hover:bg-emerald-50 md:hidden"
        >
          🔔
        </button>
      ) : null}

      <div className={mobileExpanded ? "block" : "hidden md:block"}>
        <form
          className={`flex flex-col gap-2 ${mobileExpanded ? "mt-0" : "mt-3"} ${compact ? "" : "md:mt-3 md:flex-row md:items-start"}`}
          onSubmit={handleSubmit}
        >
          <input type="hidden" name="_subject" value={subject} />
          <input type="hidden" name="model" value={model} />
          <input type="hidden" name="storage" value={storage ?? ""} />
          <input type="hidden" name="grade" value={grade ?? ""} />
          <input type="hidden" name="price" value={formatPrice(price)} />

          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <input
              type="email"
              name="email"
              required
              autoComplete="email"
              placeholder="o.teu@email.com"
              disabled={state.submitting}
              className={`min-h-[40px] w-full rounded-lg border border-slate-200 bg-white px-3 text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100 disabled:opacity-60 ${compact ? "text-xs" : "text-sm"}`}
            />
            <ValidationError
              prefix="Email"
              field="email"
              errors={state.errors}
              className="text-xs text-red-600"
            />
          </div>

          <button
            type="submit"
            disabled={state.submitting}
            className={`inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-lg bg-emerald-900 px-4 font-semibold text-white transition hover:bg-emerald-950 disabled:cursor-not-allowed disabled:opacity-60 ${compact ? "text-xs" : "text-sm"}`}
          >
            {state.submitting ? "A enviar…" : "Avisar-me"}
          </button>
        </form>

        <ValidationError errors={state.errors} className="mt-2 text-xs text-red-600" />
      </div>
    </div>
  );
}
