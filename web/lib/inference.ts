export function inferBrand(model: string): string | null {
  const m = (model ?? "").toLowerCase();
  if (m.includes("iphone") || m.includes("ipad") || m.includes("macbook") || m.includes("apple watch")) {
    return "Apple";
  }
  if (m.includes("galaxy") || m.includes("samsung")) return "Samsung";
  if (m.includes("pixel") || m.includes("google")) return "Google";
  if (m.includes("huawei") || m.includes("honor")) return "Huawei";
  if (m.includes("xiaomi") || m.includes("redmi") || m.includes("poco")) return "Xiaomi";
  if (m.includes("oneplus") || m.includes("one plus")) return "OnePlus";
  if (m.includes("lenovo")) return "Lenovo";
  return null;
}

export function inferCategory(model: string): string {
  const m = (model ?? "").toLowerCase();
  if (m.includes("apple watch") || (m.includes("watch") && m.includes("series"))) return "apple_watch";
  if (m.includes("ipad")) return "ipads";
  if (m.includes("macbook") || m.includes("mac book")) return "macs";
  if (m.includes("iphone")) return "iphones";
  if (m.includes("pixel") || m.includes("google")) return "google_phones";
  if (m.includes("galaxy") || m.includes("samsung")) return "samsung_phones";
  if (m.includes("huawei") || m.includes("honor")) return "huawei_phones";
  if (m.includes("xiaomi") || m.includes("redmi") || m.includes("poco")) return "xiaomi_phones";
  if (m.includes("oneplus") || m.includes("one plus")) return "oneplus_phones";
  return "iphones";
}

export function parseSearchQuery(query: string): { model: string; storage: string | null } {
  const q = (query ?? "").trim();
  const storageMatch = q.match(/(\d+\s*GB)/i);
  const storage = storageMatch ? storageMatch[1].replace(/\s/g, "").toUpperCase() : null;
  const model = q.replace(/(\d+\s*GB)/i, "").trim() || "iPhone 13";
  return { model, storage };
}

export function inferTechFromQuery(q: string): "smartphones" | "laptops" | "wearables" | null {
  const cat = inferCategory(q);
  const map: Record<string, "smartphones" | "laptops" | "wearables"> = {
    iphones: "smartphones",
    samsung_phones: "smartphones",
    google_phones: "smartphones",
    huawei_phones: "smartphones",
    xiaomi_phones: "smartphones",
    oneplus_phones: "smartphones",
    macs: "laptops",
    laptops: "laptops",
    apple_watch: "wearables",
  };
  return map[cat] ?? null;
}
