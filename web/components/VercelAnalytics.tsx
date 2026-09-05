"use client";

import { Analytics } from "@vercel/analytics/next";
import { useEffect, useState } from "react";

import { hasAnalyticsConsent } from "@/lib/analytics";

/** Vercel Web Analytics — loads only after cookie consent (same gate as GA4). */
export function VercelAnalytics() {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    setEnabled(hasAnalyticsConsent());

    const onConsent = () => setEnabled(hasAnalyticsConsent());
    window.addEventListener("cookie_consent_accepted", onConsent);
    return () => window.removeEventListener("cookie_consent_accepted", onConsent);
  }, []);

  if (!enabled) return null;

  return <Analytics />;
}
