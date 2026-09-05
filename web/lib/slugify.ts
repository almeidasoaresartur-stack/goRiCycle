import { cleanBaseModel } from "./product-display";
import { normalizeStorageForSlug } from "./storage";

/**
 * Converte modelo + storage num slug URL-friendly.
 * Ex: "iPhone 13 Pro" + "128GB" → "iphone-13-pro-128gb-recondicionado"
 *
 * Storage outside 16–1024GB is omitted. 1000GB/1TB becomes 1024GB.
 */
export function slugify(model: string, storage?: string | null): string {
  const normalizedModel = cleanBaseModel(model);
  const slugStorage = normalizeStorageForSlug(storage);
  const base = [normalizedModel, slugStorage]
    .filter(Boolean)
    .join(" ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");

  return `${base}-recondicionado`;
}
