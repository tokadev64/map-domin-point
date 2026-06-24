import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { type Region, REGIONS } from "../types";
import {
  createStorePointCollection,
  filterStorePointCollection,
} from "./store-points";
import type { GeocodedStore, GeocodeStatus } from "./types";

const regionArbitrary = fc.constantFrom<Region>(...REGIONS);
const statusArbitrary = fc.constantFrom<GeocodeStatus>(
  "matched",
  "not-found",
  "invalid-result",
  "request-error",
  "pending",
);
const geocodedStoreArbitrary: fc.Arbitrary<GeocodedStore> = fc
  .record({
    id: fc.string(),
    region: regionArbitrary,
    municipality: fc.string(),
    category: fc.string(),
    name: fc.string(),
    streetAddress: fc.string(),
    address: fc.string(),
    status: statusArbitrary,
    longitude: fc.double({
      min: 139.3,
      max: 146.2,
      noNaN: true,
      noDefaultInfinity: true,
    }),
    latitude: fc.double({
      min: 41.3,
      max: 45.7,
      noNaN: true,
      noDefaultInfinity: true,
    }),
  })
  .map((value) => ({
    id: value.id,
    region: value.region,
    municipality: value.municipality,
    category: value.category,
    name: value.name,
    streetAddress: value.streetAddress,
    address: value.address,
    geocode: {
      status: value.status,
      longitude: value.status === "matched" ? value.longitude : null,
      latitude: value.status === "matched" ? value.latitude : null,
      source: value.status === "matched" ? "gsi" : null,
      queryAddress: value.address,
      matchedAddress: null,
      geocodedAt: null,
      attempts: 1,
      error: null,
    },
  }));

describe("store point collection properties", () => {
  it("contains exactly matched stores and preserves their coordinates", () => {
    fc.assert(
      fc.property(fc.array(geocodedStoreArbitrary), (stores) => {
        const collection = createStorePointCollection(stores);
        const matched = stores.filter((store) =>
          store.geocode.status === "matched"
        );
        expect(collection.type).toBe("FeatureCollection");
        expect(collection.features).toHaveLength(matched.length);
        collection.features.forEach((feature, index) => {
          const store = matched[index];
          expect(feature.id).toBe(store.id);
          expect(feature.geometry.coordinates).toEqual([
            store.geocode.longitude,
            store.geocode.latitude,
          ]);
        });
      }),
    );
  });

  it("filters points by region without changing the source collection", () => {
    fc.assert(
      fc.property(
        fc.array(geocodedStoreArbitrary),
        regionArbitrary,
        (stores, region) => {
          const collection = createStorePointCollection(stores);
          const filtered = filterStorePointCollection(collection, region);
          expect(
            filtered.features.every((feature) =>
              feature.properties.region === region
            ),
          ).toBe(true);
          expect(filtered.features).toEqual(
            collection.features.filter((feature) =>
              feature.properties.region === region
            ),
          );
          expect(collection.features).toHaveLength(
            stores.filter((store) => store.geocode.status === "matched").length,
          );
        },
      ),
    );
  });

  it("uses OR semantics for selected categories", () => {
    fc.assert(
      fc.property(
        fc.array(geocodedStoreArbitrary),
        fc.array(fc.string()),
        (stores, categories) => {
          const collection = createStorePointCollection(stores);
          const filtered = filterStorePointCollection(
            collection,
            "",
            categories,
          );
          expect(filtered.features).toEqual(
            categories.length === 0
              ? collection.features
              : collection.features.filter((feature) =>
                categories.includes(feature.properties.category)
              ),
          );
        },
      ),
    );
  });

  it("combines the text query with selected categories using AND", () => {
    const stores: GeocodedStore[] = [
      {
        id: "target",
        region: "道央",
        municipality: "北海道札幌市",
        category: "コンビニ",
        name: "セイコーマート札幌店",
        streetAddress: "中央区",
        address: "北海道札幌市中央区",
        geocode: {
          status: "matched",
          longitude: 141.35,
          latitude: 43.06,
          source: "gsi",
          queryAddress: "北海道札幌市中央区",
          matchedAddress: null,
          geocodedAt: null,
          attempts: 1,
          error: null,
        },
      },
      {
        id: "other-name",
        region: "道央",
        municipality: "北海道札幌市",
        category: "コンビニ",
        name: "別のコンビニ",
        streetAddress: "北区",
        address: "北海道札幌市北区",
        geocode: {
          status: "matched",
          longitude: 141.34,
          latitude: 43.07,
          source: "gsi",
          queryAddress: "北海道札幌市北区",
          matchedAddress: null,
          geocodedAt: null,
          attempts: 1,
          error: null,
        },
      },
      {
        id: "other-category",
        region: "道央",
        municipality: "北海道札幌市",
        category: "スーパー",
        name: "セイコーマートではない店",
        streetAddress: "東区",
        address: "北海道札幌市東区",
        geocode: {
          status: "matched",
          longitude: 141.36,
          latitude: 43.08,
          source: "gsi",
          queryAddress: "北海道札幌市東区",
          matchedAddress: null,
          geocodedAt: null,
          attempts: 1,
          error: null,
        },
      },
    ];
    const collection = createStorePointCollection(stores);
    expect(
      filterStorePointCollection(
        collection,
        "",
        ["コンビニ"],
        "セイコーマート",
      ).features.map((feature) => feature.id),
    ).toEqual(["target"]);
  });

  it("returns the complete collection when no region is selected", () => {
    fc.assert(
      fc.property(fc.array(geocodedStoreArbitrary), (stores) => {
        const collection = createStorePointCollection(stores);
        expect(filterStorePointCollection(collection, "")).toBe(collection);
      }),
    );
  });
});
