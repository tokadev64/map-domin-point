import type { Store } from "../types.ts";

const HYPHENS = /[‐‑‒–—―ー−ｰ]/g;
const BUILDING_SUFFIX =
  /(?:[\s　,、]*(?:[^\d\s]{1,20}(?:ビル|マンション|ハイツ|コーポ|アパート|館|タワー|プラザ|モール|センター|ホテル|店))?[\s　]*(?:地下?\s*)?[BＢ]?\d{1,3}(?:階|[FＦ])(?:[\s　]*[\dA-Za-zＡ-Ｚａ-ｚ号室-]*)?)$/u;
const SAPPORO_GRID_ADDRESS = /^([北南])(\d+)([東西])(\d+)(?:-(\d+(?:-\d+)*))?/u;

export function normalizeAddress(value: string): string {
  return value
    .normalize("NFKC")
    .replace(HYPHENS, "-")
    .replace(/\s+/gu, " ")
    .trim();
}

export function stripLikelyBuildingSuffix(value: string): string {
  return normalizeAddress(value).replace(BUILDING_SUFFIX, "").trim();
}

export function townAreaAddress(store: Store): string | null {
  const streetAddress = normalizeAddress(store.streetAddress);
  const townArea = streetAddress
    .replace(/\d+番(?:地)?\d*(?:号)?$/u, "")
    .replace(/\d+(?:-\d+)+(?:番地?|号)?$/u, "")
    .replace(/\d+番地?$/u, "")
    .trim();
  if (!townArea || townArea === streetAddress) return null;
  return `${normalizeAddress(store.municipality)}${townArea}`;
}

export function expandSapporoGridAddress(store: Store): string | null {
  if (!normalizeAddress(store.municipality).startsWith("北海道札幌市")) {
    return null;
  }
  const streetAddress = normalizeAddress(store.streetAddress);
  const match = streetAddress.match(SAPPORO_GRID_ADDRESS);
  if (!match) return null;

  const [, northSouth, row, eastWest, column, lotNumber] = match;
  const municipality = normalizeAddress(store.municipality);
  const grid = `${northSouth}${row}条${eastWest}${column}丁目`;
  return lotNumber
    ? `${municipality}${grid}${lotNumber}`
    : `${municipality}${grid}`;
}

export function addressCandidates(store: Store): string[] {
  const original = store.address.trim();
  const normalized = normalizeAddress(store.address);
  const withoutBuilding = stripLikelyBuildingSuffix(normalized);
  const sapporoGrid = expandSapporoGridAddress(store);
  const townArea = townAreaAddress(store);

  return [
    ...new Set(
      [original, normalized, withoutBuilding, sapporoGrid, townArea]
        .filter((value): value is string => value !== null),
    ),
  ]
    .filter((value) => value.length > 0);
}
