import { APP_LOCALE, OTHER_CATEGORY_PREFIX } from "./constants";
import { matchesStore } from "./store-utils";
import { type Region, REGIONS, type Store, type StoreFilters } from "./types";

export function selectCategories(stores: readonly Store[]): string[] {
  return [...new Set(stores.map((store) => store.category))].sort(
    (left, right) => {
      const leftIsOther = left.startsWith(OTHER_CATEGORY_PREFIX);
      const rightIsOther = right.startsWith(OTHER_CATEGORY_PREFIX);
      if (leftIsOther !== rightIsOther) return leftIsOther ? 1 : -1;
      return left.localeCompare(right, APP_LOCALE);
    },
  );
}

export function selectFilteredStores(
  stores: readonly Store[],
  filters: StoreFilters,
): Store[] {
  return stores.filter((store) => matchesStore(store, filters));
}

export function selectRegionCounts(
  stores: readonly Store[],
): Record<Region, number> {
  return REGIONS.reduce<Record<Region, number>>(
    (counts, region) => {
      counts[region] = stores.filter((store) => store.region === region).length;
      return counts;
    },
    { "道北": 0, "道南": 0, "道央": 0, "道東": 0 },
  );
}
