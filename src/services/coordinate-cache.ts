import { COORDINATE_STORAGE_PREFIX } from "../constants";
import type { Coordinates } from "../types";

function storageKey(storeId: string): string {
  return `${COORDINATE_STORAGE_PREFIX}${storeId}`;
}

function isCoordinates(value: unknown): value is Coordinates {
  if (!value || typeof value !== "object") return false;
  const coordinates = value as Record<string, unknown>;
  return (
    typeof coordinates.longitude === "number" &&
    Number.isFinite(coordinates.longitude) &&
    typeof coordinates.latitude === "number" &&
    Number.isFinite(coordinates.latitude)
  );
}

export function readCoordinates(
  storeId: string,
  storage: Storage = localStorage,
): Coordinates | null {
  const cached = storage.getItem(storageKey(storeId));
  if (!cached) return null;
  try {
    const value: unknown = JSON.parse(cached);
    return isCoordinates(value) ? value : null;
  } catch {
    return null;
  }
}

export function writeCoordinates(
  storeId: string,
  coordinates: Coordinates,
  storage: Storage = localStorage,
): void {
  storage.setItem(storageKey(storeId), JSON.stringify(coordinates));
}
