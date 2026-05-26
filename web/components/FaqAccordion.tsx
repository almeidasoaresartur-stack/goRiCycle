"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";

import type { FaqItem } from "@/lib/faq";

type FaqAccordionProps = {
  items: FaqItem[];
  defaultOpenId?: string;
};

export function FaqAccordion({ items, defaultOpenId }: FaqAccordionProps) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId ?? items[0]?.id ?? null);

  const toggle = (id: string) => {
    setOpenId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="divide-y divide-slate-200/80 rounded-2xl border border-slate-200/80 bg-white shadow-sm">
      {items.map((item) => {
        const isOpen = openId === item.id;

        return (
          <div key={item.id} className="group">
            <button
              type="button"
              id={`faq-trigger-${item.id}`}
              aria-expanded={isOpen}
              aria-controls={`faq-panel-${item.id}`}
              onClick={() => toggle(item.id)}
              className="flex w-full items-start justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-slate-50/80 sm:px-7 sm:py-6"
            >
              <span className="text-base font-semibold leading-snug text-slate-900 sm:text-[1.05rem]">
                {item.question}
              </span>
              <span
                className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-500 transition-all duration-300 ${
                  isOpen ? "rotate-180 border-emerald-200 bg-emerald-50 text-emerald-700" : ""
                }`}
              >
                <ChevronDown className="h-4 w-4" strokeWidth={2.25} />
              </span>
            </button>

            <div
              id={`faq-panel-${item.id}`}
              role="region"
              aria-labelledby={`faq-trigger-${item.id}`}
              className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <p className="px-6 pb-5 text-[0.95rem] leading-relaxed text-slate-600 sm:px-7 sm:pb-6 sm:text-base">
                  {item.answer}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
