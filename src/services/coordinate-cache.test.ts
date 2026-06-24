import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { readCoordinates, writeCoordinates } from "./coordinate-cache";
import type { Coordinates } from "../types";

class MemoryStorage implements Storage {
  readonly #values = new Map<string, string>();

  get length(): number {
    return this.#values.size;
  }

  clear(): void {
    this.#values.clear();
  }

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }

  key(index: number): string | null {
    return [...this.#values.keys()][index] ?? null;
  }

  removeItem(key: string): void {
    this.#values.delete(key);
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, value);
  }
}

const coordinatesArbitrary: fc.Arbitrary<Coordinates> = fc.record({
  longitude: fc.double({
    min: -180,
    max: 180,
    noNaN: true,
    noDefaultInfinity: true,
  }),
  latitude: fc.double({
    min: -90,
    max: 90,
    noNaN: true,
    noDefaultInfinity: true,
  }),
});

describe("coordinate cache properties", () => {
  it("round-trips every finite coordinate pair", () => {
    fc.assert(
      fc.property(
        fc.string(),
        coordinatesArbitrary,
        (storeId, coordinates) => {
          const storage = new MemoryStorage();
          writeCoordinates(storeId, coordinates, storage);
          const restored = readCoordinates(storeId, storage);
          expect(restored).not.toBeNull();
          expect(restored?.longitude === coordinates.longitude).toBe(true);
          expect(restored?.latitude === coordinates.latitude).toBe(true);
        },
      ),
    );
  });

  it("never returns malformed or non-finite cached values", () => {
    fc.assert(
      fc.property(fc.string(), fc.string(), (storeId, value) => {
        const storage = new MemoryStorage();
        storage.setItem(`domin-point:coordinates:${storeId}`, value);
        const coordinates = readCoordinates(storeId, storage);
        expect(
          coordinates === null ||
            (Number.isFinite(coordinates.longitude) &&
              Number.isFinite(coordinates.latitude)),
        ).toBe(true);
      }),
    );
  });
});
