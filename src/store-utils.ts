import { GOOGLE_MAPS_SEARCH_URL, SEARCH_LOCALE } from "./constants";
import type { Store, StoreFilters } from "./types";

export function normalizeSearchText(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase(SEARCH_LOCALE)
    .replace(/\s+/g, "");
}

export function matchesStore(store: Store, filters: StoreFilters): boolean {
  if (filters.region && store.region !== filters.region) return false;
  if (
    filters.categories.length > 0 &&
    !filters.categories.includes(store.category)
  ) return false;

  const query = normalizeSearchText(filters.query);
  if (!query) return true;

  return normalizeSearchText(
    `${store.name} ${store.address} ${store.category} ${store.region}`,
  ).includes(query);
}

export function storeSearchUrl(store: Store): string {
  const query = encodeURIComponent(
    `${store.name} ${store.address}`.toWellFormed(),
  );
  return `${GOOGLE_MAPS_SEARCH_URL}${query}`;
}
