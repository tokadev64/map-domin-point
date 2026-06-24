import fc from "fast-check";
import { describe, expect, it, vi } from "vitest";
import { HOKKAIDO_BOUNDS } from "./constants";
import { geocodeAddress, isWithinHokkaido } from "./gsi-client";

describe("GSI client properties", () => {
  it("accepts finite coordinates inside the Hokkaido bounds", () => {
    fc.assert(
      fc.property(
        fc.double({
          min: HOKKAIDO_BOUNDS.minimumLongitude,
          max: HOKKAIDO_BOUNDS.maximumLongitude,
          noNaN: true,
          noDefaultInfinity: true,
        }),
        fc.double({
          min: HOKKAIDO_BOUNDS.minimumLatitude,
          max: HOKKAIDO_BOUNDS.maximumLatitude,
          noNaN: true,
          noDefaultInfinity: true,
        }),
        (longitude, latitude) => {
          expect(isWithinHokkaido(longitude, latitude)).toBe(true);
        },
      ),
    );
  });

  it("rejects non-finite and out-of-bounds coordinates", () => {
    expect(isWithinHokkaido(Number.NaN, 43)).toBe(false);
    expect(isWithinHokkaido(142, Number.POSITIVE_INFINITY)).toBe(false);
    expect(
      isWithinHokkaido(HOKKAIDO_BOUNDS.minimumLongitude - 1, 43),
    ).toBe(false);
    expect(
      isWithinHokkaido(142, HOKKAIDO_BOUNDS.maximumLatitude + 1),
    ).toBe(false);
  });

  it("parses a valid response without trusting untyped JSON", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([{
          geometry: { coordinates: [141.35, 43.06] },
          properties: { title: "北海道札幌市" },
        }]),
        { status: 200 },
      ),
    );
    await expect(
      geocodeAddress("北海道札幌市", { fetcher }),
    ).resolves.toEqual({
      kind: "matched",
      longitude: 141.35,
      latitude: 43.06,
      matchedAddress: "北海道札幌市",
    });
  });

  it("distinguishes no result from an invalid result", async () => {
    const emptyFetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response("[]", { status: 200 }),
    );
    const invalidFetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify([{ geometry: { coordinates: [0, 0] } }]),
        { status: 200 },
      ),
    );
    await expect(
      geocodeAddress("missing", { fetcher: emptyFetcher }),
    ).resolves.toEqual({ kind: "not-found" });
    await expect(
      geocodeAddress("invalid", { fetcher: invalidFetcher }),
    ).resolves.toMatchObject({ kind: "invalid-result" });
  });
});
