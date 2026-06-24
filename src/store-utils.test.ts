import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { GOOGLE_MAPS_SEARCH_URL } from "./constants";
import { CATEGORY_COLORS, DEFAULT_CATEGORY_COLOR } from "./constants";
import { categoryColor } from "./category-color";
import {
  matchesStore,
  normalizeSearchText,
  storeSearchUrl,
} from "./store-utils";
import { type Region, REGIONS, type Store } from "./types";

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

describe("store utility properties", () => {
  it("normalization is idempotent and ignores surrounding whitespace", () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const normalized = normalizeSearchText(value);
        expect(normalizeSearchText(normalized)).toBe(normalized);
        expect(normalizeSearchText(` \t${value}\n `)).toBe(normalized);
      }),
    );
  });

  it("an empty filter accepts every store", () => {
    fc.assert(
      fc.property(storeArbitrary, (store) => {
        expect(
          matchesStore(store, { query: "", region: "", categories: [] }),
        ).toBe(true);
      }),
    );
  });

  it("an exact region filter accepts its region and rejects every other region", () => {
    fc.assert(
      fc.property(
        storeArbitrary,
        regionArbitrary,
        (store, requestedRegion) => {
          expect(
            matchesStore(store, {
              query: "",
              region: requestedRegion,
              categories: [],
            }),
          ).toBe(store.region === requestedRegion);
        },
      ),
    );
  });

  it("a non-empty normalized store name remains searchable", () => {
    fc.assert(
      fc.property(
        storeArbitrary.filter((store) =>
          normalizeSearchText(store.name).length > 0
        ),
        (store) => {
          expect(
            matchesStore(store, {
              query: store.name,
              region: "",
              categories: [],
            }),
          ).toBe(true);
        },
      ),
    );
  });

  it("accepts a store when any selected category matches", () => {
    fc.assert(
      fc.property(
        storeArbitrary,
        fc.array(fc.string()),
        (store, otherCategories) => {
          const categories = [...otherCategories, store.category];
          expect(
            matchesStore(store, { query: "", region: "", categories }),
          ).toBe(true);
        },
      ),
    );
  });

  it("map URLs round-trip arbitrary names and addresses", () => {
    fc.assert(
      fc.property(storeArbitrary, (store) => {
        const url = storeSearchUrl(store);
        expect(url.startsWith(GOOGLE_MAPS_SEARCH_URL)).toBe(true);
        const query = new URL(url).searchParams.get("query");
        expect(query).toBe(`${store.name} ${store.address}`.toWellFormed());
      }),
    );
  });

  it("category colors use the exact category map or the default", () => {
    fc.assert(
      fc.property(fc.string(), (category) => {
        const expected = Object.hasOwn(CATEGORY_COLORS, category)
          ? CATEGORY_COLORS[category]
          : DEFAULT_CATEGORY_COLOR;
        expect(categoryColor(category)).toBe(expected);
        expect(categoryColor(category)).toMatch(/^#[\da-f]{6}$/i);
      }),
    );
  });
});
