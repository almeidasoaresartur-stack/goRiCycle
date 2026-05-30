import { getComparisonOffers, parseSearchQuery } from "./products";

export type PopularModel = {
  id: string;
  name: string;
  query: string;
  category: string;
  brand: string;
  imageUrl: string;
};

export const APPLE_POPULAR: PopularModel[] = [
  {
    id: "iphone-13-128",
    name: "iPhone 13 128GB",
    query: "iPhone 13 128GB",
    category: "iphones",
    brand: "Apple",
    imageUrl:
      "https://images.unsplash.com/photo-1632661671477-74c8b455f729?w=600&h=600&fit=crop&q=80",
  },
  {
    id: "iphone-14-pro-128",
    name: "iPhone 14 Pro 128GB",
    query: "iPhone 14 Pro 128GB",
    category: "iphones",
    brand: "Apple",
    imageUrl:
      "https://images.unsplash.com/photo-1663499482523-1c0c1bae4ce1?w=600&h=600&fit=crop&q=80",
  },
  {
    id: "iphone-15-128",
    name: "iPhone 15 128GB",
    query: "iPhone 15 128GB",
    category: "iphones",
    brand: "Apple",
    imageUrl:
      "https://images.unsplash.com/photo-1695048133142-9321e483c25?w=600&h=600&fit=crop&q=80",
  },
];

export const ANDROID_POPULAR: PopularModel[] = [
  {
    id: "galaxy-z-fold6",
    name: "Samsung Galaxy Z Fold6",
    query: "Samsung Galaxy Z Fold6",
    category: "samsung_phones",
    brand: "Samsung",
    imageUrl:
      "https://images.unsplash.com/photo-1610945415295-d9bbf067e59c?w=600&h=600&fit=crop&q=80",
  },
  {
    id: "pixel-6",
    name: "Google Pixel 6",
    query: "Google Pixel 6",
    category: "google_phones",
    brand: "Google",
    imageUrl:
      "https://images.unsplash.com/photo-1699008779433-2cae3596e9ef?w=600&h=600&fit=crop&q=80",
  },
  {
    id: "galaxy-s23-128",
    name: "Samsung Galaxy S23 128GB",
    query: "Samsung Galaxy S23 128GB",
    category: "samsung_phones",
    brand: "Samsung",
    imageUrl:
      "https://images.unsplash.com/photo-1598327667368-7021d086d6d0?w=600&h=600&fit=crop&q=80",
  },
  {
    id: "pixel-8-128",
    name: "Google Pixel 8 128GB",
    query: "Google Pixel 8 128GB",
    category: "google_phones",
    brand: "Google",
    imageUrl:
      "https://images.unsplash.com/photo-1511707171634-5f897ff02aa9?w=600&h=600&fit=crop&q=80",
  },
];

export type EnrichedPopularModel = PopularModel & {
  minPrice: number | null;
  storeCount: number;
};

function enrichModels(models: PopularModel[]): EnrichedPopularModel[] {
  return models.map((model) => {
    const { model: parsedModel, storage } = parseSearchQuery(model.query);
    const offers = getComparisonOffers(parsedModel, storage, model.category);
    const prices = offers.map((o) => o.price).filter((p) => Number.isFinite(p));
    const minPrice = prices.length ? Math.min(...prices) : null;

    return {
      ...model,
      minPrice,
      storeCount: offers.length,
    };
  });
}

export function getEnrichedPopularModels(): {
  apple: EnrichedPopularModel[];
  android: EnrichedPopularModel[];
} {
  return {
    apple: enrichModels(APPLE_POPULAR),
    android: enrichModels(ANDROID_POPULAR),
  };
}

export type QuickCategory = {
  id: string;
  label: string;
  query: string;
  icon: "smartphone" | "tablet" | "laptop" | "watch";
  brand?: string;
};

export const APPLE_CATEGORIES: QuickCategory[] = [
  { id: "iphones", label: "iPhones", query: "iPhone 13 128GB", icon: "smartphone" },
  { id: "ipads", label: "iPads", query: "iPad Air 128GB", icon: "tablet" },
];

export const ANDROID_CATEGORIES: QuickCategory[] = [
  {
    id: "samsung",
    label: "Samsung",
    query: "Samsung Galaxy Z Fold6",
    icon: "smartphone",
    brand: "Samsung",
  },
  {
    id: "google",
    label: "Google Pixel",
    query: "Google Pixel 6",
    icon: "smartphone",
    brand: "Google",
  },
];

export const BRAND_LABELS: Record<string, string> = {
  Apple: "Apple",
  Samsung: "Samsung",
  Google: "Google Pixel",
};
