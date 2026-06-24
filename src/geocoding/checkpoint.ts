import type { Store } from "../types.ts";
import type {
  GeocodedStore,
  GeocodingCheckpoint,
  StoreGeocode,
} from "./types.ts";
import { isWithinHokkaido } from "./gsi-client.ts";

export function pendingGeocode(queryAddress = ""): StoreGeocode {
  return {
    status: "pending",
    latitude: null,
    longitude: null,
    source: null,
    queryAddress,
    matchedAddress: null,
    geocodedAt: null,
    attempts: 0,
    error: null,
  };
}

function isValidGeocode(value: unknown): value is StoreGeocode {
  if (!value || typeof value !== "object") return false;
  const geocode = value as Record<string, unknown>;
  const status = geocode.status;
  const validStatus = [
    "matched",
    "not-found",
    "invalid-result",
    "request-error",
    "pending",
  ].includes(String(status));
  if (
    !validStatus ||
    typeof geocode.queryAddress !== "string" ||
    typeof geocode.attempts !== "number" ||
    !Number.isInteger(geocode.attempts) ||
    geocode.attempts < 0
  ) return false;

  if (status === "matched") {
    return (
      geocode.source === "gsi" || geocode.source === "manual"
    ) &&
      typeof geocode.longitude === "number" &&
      typeof geocode.latitude === "number" &&
      isWithinHokkaido(geocode.longitude, geocode.latitude);
  }
  return geocode.latitude === null && geocode.longitude === null;
}

export function createCheckpoint(stores: Store[]): GeocodingCheckpoint {
  const now = new Date().toISOString();
  return {
    version: 1,
    startedAt: now,
    updatedAt: now,
    completedAt: null,
    total: stores.length,
    processed: 0,
    stores: stores.map((store) => ({
      ...store,
      geocode: pendingGeocode(store.address),
    })),
  };
}

export function parseCheckpoint(
  value: unknown,
  inputStores: Store[],
): GeocodingCheckpoint {
  if (!value || typeof value !== "object") {
    throw new Error("チェックポイントの形式が不正です");
  }
  const checkpoint = value as Partial<GeocodingCheckpoint>;
  if (
    checkpoint.version !== 1 ||
    !Array.isArray(checkpoint.stores) ||
    checkpoint.stores.length !== inputStores.length
  ) {
    throw new Error("チェックポイントが入力データと一致しません");
  }
  const stores = checkpoint.stores as GeocodedStore[];
  for (let index = 0; index < inputStores.length; index++) {
    if (
      stores[index]?.id !== inputStores[index].id ||
      !isValidGeocode(stores[index]?.geocode)
    ) {
      throw new Error(
        `チェックポイントの店舗または座標が不正です (index: ${index})`,
      );
    }
  }
  const processed =
    stores.filter((store) => store.geocode.status !== "pending").length;
  return {
    version: 1,
    startedAt: String(checkpoint.startedAt),
    updatedAt: String(checkpoint.updatedAt),
    completedAt: typeof checkpoint.completedAt === "string"
      ? checkpoint.completedAt
      : null,
    total: stores.length,
    processed,
    stores,
  };
}

export async function readCheckpoint(
  path: string,
  inputStores: Store[],
): Promise<GeocodingCheckpoint> {
  const value: unknown = JSON.parse(await Deno.readTextFile(path));
  return parseCheckpoint(value, inputStores);
}

export async function writeJsonAtomic(
  path: string,
  value: unknown,
): Promise<void> {
  const separator = path.lastIndexOf("/");
  const directory = separator >= 0 ? path.slice(0, separator) : ".";
  await Deno.mkdir(directory, { recursive: true });
  const temporaryPath = `${path}.tmp-${Deno.pid}`;
  await Deno.writeTextFile(
    temporaryPath,
    `${JSON.stringify(value, null, 2)}\n`,
  );
  await Deno.rename(temporaryPath, path);
}
