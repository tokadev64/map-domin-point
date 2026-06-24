import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { createCheckpoint, parseCheckpoint } from "./checkpoint";
import type { Region, Store } from "../types";

const regionArbitrary = fc.constantFrom<Region>(
  "道北",
  "道南",
  "道央",
  "道東",
);
const storeArbitrary: fc.Arbitrary<Store> = fc.record({
  id: fc.uuid(),
  region: regionArbitrary,
  municipality: fc.string(),
  category: fc.string(),
  name: fc.string(),
  streetAddress: fc.string(),
  address: fc.string(),
});

describe("checkpoint properties", () => {
  it("round-trips generated pending checkpoints and preserves order", () => {
    fc.assert(
      fc.property(
        fc.uniqueArray(storeArbitrary, {
          selector: (store) => store.id,
          maxLength: 50,
        }),
        (stores) => {
          const checkpoint = createCheckpoint(stores);
          const restored = parseCheckpoint(
            JSON.parse(JSON.stringify(checkpoint)),
            stores,
          );
          expect(restored.stores.map((store) => store.id)).toEqual(
            stores.map((store) => store.id),
          );
          expect(restored.processed).toBe(0);
        },
      ),
    );
  });

  it("rejects corrupted matched coordinates", () => {
    const stores: Store[] = [{
      id: "store-1",
      region: "道央",
      municipality: "北海道札幌市",
      category: "category",
      name: "name",
      streetAddress: "中央区",
      address: "北海道札幌市中央区",
    }];
    const checkpoint = createCheckpoint(stores);
    checkpoint.stores[0].geocode = {
      status: "matched",
      latitude: Number.NaN,
      longitude: 141.35,
      source: "gsi",
      queryAddress: stores[0].address,
      matchedAddress: null,
      geocodedAt: new Date().toISOString(),
      attempts: 1,
      error: null,
    };
    expect(() => parseCheckpoint(checkpoint, stores)).toThrow();
  });
});
