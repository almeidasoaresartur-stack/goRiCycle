import {
  GRADE_TIER_OPTIONS,
  TECH_TYPES,
  type MarketplaceFilters,
} from "@/lib/marketplace";
import { getStoreInfo } from "@/lib/stores";

export type ActiveFilterChip = {
  key: string;
  label: string;
};

export function buildActiveFilterChips(filters: MarketplaceFilters): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];

  if (filters.q?.trim()) {
    chips.push({ key: "q", label: `"${filters.q.trim()}"` });
  }

  if (filters.tech) {
    const techLabel = TECH_TYPES.find((t) => t.id === filters.tech)?.label ?? filters.tech;
    chips.push({ key: "tech", label: techLabel });
  }

  for (const slug of filters.stores ?? []) {
    const label = getStoreInfo(slug)?.label ?? slug;
    chips.push({ key: `store:${slug}`, label });
  }

  if (filters.brand) {
    chips.push({ key: "brand", label: filters.brand });
  }

  if (filters.model) {
    chips.push({ key: "model", label: filters.model });
  }

  if (filters.storage) {
    chips.push({ key: "storage", label: filters.storage });
  }

  if (filters.grade) {
    const gradeLabel =
      GRADE_TIER_OPTIONS.find((g) => g.id === filters.grade)?.label ?? filters.grade;
    chips.push({ key: "grade", label: gradeLabel });
  }

  return chips;
}

export function countActiveFilters(filters: MarketplaceFilters): number {
  return buildActiveFilterChips(filters).length;
}
