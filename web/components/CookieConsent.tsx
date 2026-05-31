"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { acceptAnalyticsConsent, COOKIE_CONSENT_KEY } from "@/lib/analytics";

export function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setVisible(localStorage.getItem(COOKIE_CONSENT_KEY) !== "accepted");
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 z-50 flex w-full items-center justify-between bg-gray-900 p-3 text-sm text-white">
      <span>
        Usamos cookies para melhorar a experiência.{" "}
        <Link href="/termos" className="underline">
          Saber mais
        </Link>
      </span>
      <button
        type="button"
        onClick={() => {
          acceptAnalyticsConsent();
          setVisible(false);
        }}
        className="ml-4 rounded-lg bg-green-600 px-4 py-1.5 text-sm font-medium"
      >
        Aceitar
      </button>
    </div>
  );
}
