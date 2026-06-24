import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { APP_LOCALE, OTHER_CATEGORY_PREFIX } from "./constants";
import {
  selectCategories,
  selectFilteredStores,
  selectRegionCounts,
} from "./store-selectors";
import { matchesStore } from "./store-utils";
import { type Region, REGIONS, type Store, type StoreFilters } from "./types";

const regionArbitrary = fc.constantFrom<Region>(...REGIONS);
const storeArbitrary: fc.Arbitrary<Store> = fc.record({
  id: fc.string(),
  region: regionArbitrary,
  municipality: fc.string(),
  category: fc.string(),
  name: fc.string(),
  streetAddress: fc.string(),
  address: fc.string(),
});
const filtersArbitrary: fc.Arbitrary<StoreFilters> = fc.record({
  query: fc.string(),
  region: fc.oneof(fc.constant(""), regionArbitrary),
  categories: fc.array(fc.string()),
});

describe("store selector properties", () => {
  it("filtered stores are an ordered subset and all satisfy the filters", () => {
    fc.assert(
      fc.property(
        fc.array(storeArbitrary),
        filtersArbitrary,
        (stores, filters) => {
          const selected = selectFilteredStores(stores, filters);
          expect(selected.every((store) => matchesStore(store, filters))).toBe(
            true,
          );
          expect(selected).toEqual(
            stores.filter((store) => matchesStore(store, filters)),
          );
        },
      ),
    );
  });

  it("region counts partition every store exactly once", () => {
    fc.assert(
      fc.property(fc.array(storeArbitrary), (stores) => {
        const counts = selectRegionCounts(stores);
        expect(
          REGIONS.reduce((total, region) => total + counts[region], 0),
        ).toBe(stores.length);
        for (const region of REGIONS) {
          expect(counts[region]).toBe(
            stores.filter((store) => store.region === region).length,
          );
        }
      }),
    );
  });

  it("categories are unique, complete and place every その他の category last", () => {
    fc.assert(
      fc.property(fc.array(storeArbitrary), (stores) => {
        const categories = selectCategories(stores);
        expect(new Set(categories).size).toBe(categories.length);
        expect(new Set(categories)).toEqual(
          new Set(stores.map((store) => store.category)),
        );
        const firstOtherIndex = categories.findIndex((category) =>
          category.startsWith(OTHER_CATEGORY_PREFIX)
        );
        if (firstOtherIndex >= 0) {
          expect(
            categories.slice(firstOtherIndex).every((category) =>
              category.startsWith(OTHER_CATEGORY_PREFIX)
            ),
          ).toBe(true);
        }
        const regular = categories.filter((category) =>
          !category.startsWith(OTHER_CATEGORY_PREFIX)
        );
        const others = categories.filter((category) =>
          category.startsWith(OTHER_CATEGORY_PREFIX)
        );
        expect(regular).toEqual(
          [...regular].sort((left, right) =>
            left.localeCompare(right, APP_LOCALE)
          ),
        );
        expect(others).toEqual(
          [...others].sort((left, right) =>
            left.localeCompare(right, APP_LOCALE)
          ),
        );
      }),
    );
  });

  it("places arbitrary その他の categories after every regular category", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string(), { minLength: 1 }),
        fc.array(fc.string(), { minLength: 1 }),
        (regularValues, otherValues) => {
          const stores = [
            ...regularValues.map((value, index) => ({
              id: `regular-${index}`,
              region: "道央" as const,
              municipality: "",
              category: `通常${value}`,
              name: "",
              streetAddress: "",
              address: "",
            })),
            ...otherValues.map((value, index) => ({
              id: `other-${index}`,
              region: "道央" as const,
              municipality: "",
              category: `${OTHER_CATEGORY_PREFIX}${value}`,
              name: "",
              streetAddress: "",
              address: "",
            })),
          ];
          const categories = selectCategories(stores);
          const lastRegularIndex = categories.findLastIndex((category) =>
            !category.startsWith(OTHER_CATEGORY_PREFIX)
          );
          const firstOtherIndex = categories.findIndex((category) =>
            category.startsWith(OTHER_CATEGORY_PREFIX)
          );
          expect(lastRegularIndex).toBeLessThan(firstOtherIndex);
        },
      ),
    );
  });
});
