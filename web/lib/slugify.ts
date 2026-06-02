import { cleanBaseModel } from "./product-display";

/**
 * Converte modelo + storage num slug URL-friendly.
 * Ex: "iPhone 13 Pro" + "128GB" → "iphone-13-pro-128gb-recondicionado"
 */
export function slugify(model: string, storage?: string | null): string {
  const normalizedModel = cleanBaseModel(model);
  const base = [normalizedModel, storage?.trim()]
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
