import { SITE_URL } from "@/lib/structured-data";

export { SITE_URL };

/**
 * Absolute self-referencing canonical on the apex host (never www).
 * Home resolves to the origin without a trailing slash.
 */
export function canonicalPath(path: string): string {
  if (!path || path === "/") return SITE_URL;

  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, "");
  return `${SITE_URL}${withoutTrailingSlash}`;
}
