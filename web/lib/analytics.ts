/** Tracking de eventos para goRiCycle (GA4). */

export const trackEvent = (eventName: string, params?: Record<string, unknown>) => {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", eventName, params);
};

export const trackStoreClick = (product: {
  model: string;
  store: string;
  price: number;
  category: string;
  grade?: string;
  storage?: string;
}) =>
  trackEvent("store_click", {
    store_name: product.store,
    product_model: product.model,
    product_price: product.price,
    product_category: product.category,
    product_grade: product.grade,
    product_storage: product.storage,
    currency: "EUR",
  });

export const trackSearch = (query: string, resultsCount: number) =>
  trackEvent("search", {
    search_term: query,
    results_count: resultsCount,
    has_results: resultsCount > 0,
  });

export const trackSearchNoResults = (query: string) =>
  trackEvent("search_no_results", { search_term: query });

export const trackFilterApplied = (filterType: string, filterValue: string) =>
  trackEvent("filter_applied", {
    filter_type: filterType,
    filter_value: filterValue,
  });

export const trackHighlightClick = (model: string, position: number) =>
  trackEvent("highlight_click", { product_model: model, position });

export const trackPartnerLogoClick = (storeName: string) =>
  trackEvent("partner_logo_click", { store_name: storeName });

export const COOKIE_CONSENT_KEY = "cookie_consent";

export function hasAnalyticsConsent(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem(COOKIE_CONSENT_KEY) === "accepted";
}

export function acceptAnalyticsConsent(): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(COOKIE_CONSENT_KEY, "accepted");
  window.dispatchEvent(new Event("cookie_consent_accepted"));
}
