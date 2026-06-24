import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  addressCandidates,
  expandSapporoGridAddress,
  normalizeAddress,
  townAreaAddress,
} from "./normalize-address";
import type { Store } from "../types";

describe("address normalization properties", () => {
  it("is idempotent, trims whitespace, and removes repeated whitespace", () => {
    fc.assert(
      fc.property(fc.string(), (value) => {
        const normalized = normalizeAddress(value);
        expect(normalizeAddress(normalized)).toBe(normalized);
        expect(normalizeAddress(` \t${value}\n `)).toBe(normalized);
        expect(normalized).not.toMatch(/\s{2,}/u);
      }),
    );
  });

  it("does not destroy a non-empty address into an empty string", () => {
    fc.assert(
      fc.property(
        fc.string().filter((value) => value.trim().length > 0),
        (value) => {
          expect(normalizeAddress(value).length).toBeGreaterThan(0);
        },
      ),
    );
  });

  it("returns unique, non-empty candidates with the original first", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1 }).filter((value) => value.trim().length > 0),
        fc.string({ minLength: 1 }),
        (address, municipality) => {
          const store: Store = {
            id: "id",
            region: "道央",
            municipality,
            category: "category",
            name: "name",
            streetAddress: address,
            address,
          };
          const candidates = addressCandidates(store);
          expect(candidates[0]).toBe(address.trim());
          expect(new Set(candidates).size).toBe(candidates.length);
          expect(candidates.every((value) => value.length > 0)).toBe(true);
        },
      ),
    );
  });

  it("keeps the town area while removing common lot-number suffixes", () => {
    const base: Store = {
      id: "id",
      region: "道東",
      municipality: "北海道阿寒郡鶴居村",
      category: "category",
      name: "name",
      streetAddress: "鶴居東１丁目１番１０",
      address: "北海道阿寒郡鶴居村鶴居東１丁目１番１０",
    };
    expect(townAreaAddress(base)).toBe("北海道阿寒郡鶴居村鶴居東1丁目");
    expect(
      townAreaAddress({
        ...base,
        streetAddress: "字幌呂原野南５線４１番地",
      }),
    ).toBe("北海道阿寒郡鶴居村字幌呂原野南5線");
    expect(
      townAreaAddress({ ...base, streetAddress: "鶴居西２丁目４−１" }),
    ).toBe("北海道阿寒郡鶴居村鶴居西2丁目");
  });

  it("expands abbreviated Sapporo grid addresses", () => {
    const base: Store = {
      id: "id",
      region: "道央",
      municipality: "北海道札幌市中央区",
      category: "category",
      name: "name",
      streetAddress: "北５西１１－１６－１",
      address: "北海道札幌市中央区北５西１１－１６－１",
    };
    expect(expandSapporoGridAddress(base)).toBe(
      "北海道札幌市中央区北5条西11丁目16-1",
    );
    expect(
      expandSapporoGridAddress({
        ...base,
        streetAddress: "南４西４ ココノススキノ２階",
      }),
    ).toBe("北海道札幌市中央区南4条西4丁目");
    expect(
      expandSapporoGridAddress({
        ...base,
        municipality: "北海道札幌市東区",
        streetAddress: "北２１東１６－２－１２",
      }),
    ).toBe("北海道札幌市東区北21条東16丁目2-12");
  });

  it("does not apply Sapporo grid expansion outside Sapporo", () => {
    const store: Store = {
      id: "id",
      region: "道東",
      municipality: "北海道釧路市",
      category: "category",
      name: "name",
      streetAddress: "北５西１１－１６－１",
      address: "北海道釧路市北５西１１－１６－１",
    };
    expect(expandSapporoGridAddress(store)).toBeNull();
  });
});
