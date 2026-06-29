import { describe, expect, it } from "vitest";
import { calculateMapPadding } from "./map-occlusion";

const map = { top: 0, right: 1000, bottom: 800, left: 0 };

describe("calculateMapPadding", () => {
  it("adds a left drawer to the map padding", () => {
    expect(
      calculateMapPadding(
        map,
        [{ top: 0, right: 400, bottom: 800, left: 0 }],
        16,
      ),
    ).toEqual({ top: 16, right: 16, bottom: 16, left: 416 });
  });

  it("adds a bottom sheet to the map padding", () => {
    expect(
      calculateMapPadding(
        map,
        [{ top: 500, right: 1000, bottom: 800, left: 0 }],
        16,
      ),
    ).toEqual({ top: 16, right: 16, bottom: 316, left: 16 });
  });

  it("ignores floating overlays that do not cover a map edge", () => {
    expect(
      calculateMapPadding(
        map,
        [{ top: 100, right: 600, bottom: 300, left: 400 }],
        16,
      ),
    ).toEqual({ top: 16, right: 16, bottom: 16, left: 16 });
  });

  it("reduces edge margins when an overlay covers nearly all of the map", () => {
    expect(
      calculateMapPadding(
        map,
        [{ top: 8, right: 1000, bottom: 800, left: 0 }],
        16,
      ),
    ).toEqual({ top: 3.5, right: 16, bottom: 795.5, left: 16 });
  });
});
