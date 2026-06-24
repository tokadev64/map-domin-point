import { GSI_ADDRESS_SEARCH_URL, STORE_DATA_URL } from "../constants";
import type {
  Coordinates,
  GeocodingFeature,
  Store,
  StoreDataset,
} from "../types";
import { REGIONS } from "../types";

interface GeocodingCandidate {
  geometry?: {
    coordinates?: unknown;
  };
}

function isStore(value: unknown): value is Store {
  if (!value || typeof value !== "object") return false;
  const store = value as Record<string, unknown>;
  return [
    "id",
    "region",
    "municipality",
    "category",
    "name",
    "streetAddress",
    "address",
  ].every((key) => typeof store[key] === "string");
}

function isStoreDataset(value: unknown): value is StoreDataset {
  if (!value || typeof value !== "object") return false;
  const dataset = value as Record<string, unknown>;
  return (
    typeof dataset.title === "string" &&
    typeof dataset.generatedAt === "string" &&
    typeof dataset.count === "number" &&
    dataset.sourceDates !== null &&
    typeof dataset.sourceDates === "object" &&
    REGIONS.every(
      (region) =>
        typeof (dataset.sourceDates as Record<string, unknown>)[region] ===
          "string",
    ) &&
    Array.isArray(dataset.stores) &&
    dataset.stores.every(isStore)
  );
}

function isGeocodingFeature(value: unknown): value is GeocodingFeature {
  if (!value || typeof value !== "object") return false;
  const feature = value as GeocodingCandidate;
  const coordinates = feature.geometry?.coordinates;
  return (
    Array.isArray(coordinates) &&
    coordinates.length === 2 &&
    coordinates.every((coordinate) => Number.isFinite(coordinate))
  );
}

export async function fetchStoreDataset(
  fetcher: typeof fetch = fetch,
): Promise<StoreDataset> {
  const response = await fetcher(STORE_DATA_URL);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const value: unknown = await response.json();
  if (!isStoreDataset(value)) throw new Error("店舗データの形式が不正です");
  return value;
}

export async function fetchCoordinates(
  address: string,
  fetcher: typeof fetch = fetch,
): Promise<Coordinates> {
  const params = new URLSearchParams({ q: address });
  const response = await fetcher(`${GSI_ADDRESS_SEARCH_URL}?${params}`);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const value: unknown = await response.json();
  if (!Array.isArray(value) || !isGeocodingFeature(value[0])) {
    throw new Error("該当する住所がありません");
  }
  const [longitude, latitude] = value[0].geometry.coordinates;
  return { longitude, latitude };
}
