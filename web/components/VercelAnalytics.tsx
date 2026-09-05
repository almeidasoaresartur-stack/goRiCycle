"use client";

import { Analytics } from "@vercel/analytics/next";
import { useSyncExternalStore } from "react";

import { hasAnalyticsConsent } from "@/lib/analytics";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("cookie_consent_accepted", onStoreChange);
  return () => window.removeEventListener("cookie_consent_accepted", onStoreChange);
}

function getSnapshot() {
  return hasAnalyticsConsent();
}

function getServerSnapshot() {
  return false;
}

/** Vercel Web Analytics — loads only after cookie consent (same gate as GA4). */
export function VercelAnalytics() {
  const enabled = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (!enabled) return null;
  return <Analytics />;
}
