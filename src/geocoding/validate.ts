import type { Store, StoreDataset } from "../types.ts";
import { normalizeAddress } from "./normalize-address.ts";
import { isWithinHokkaido } from "./gsi-client.ts";
import type {
  GeocodedStore,
  GeocodedStoreDataset,
  GeocodingCheckpoint,
} from "./types.ts";

export function validateResult(
  input: StoreDataset,
  output: GeocodedStoreDataset,
  checkpoint: GeocodingCheckpoint,
): void {
  if (
    output.count !== input.count ||
    output.stores.length !== input.stores.length ||
    checkpoint.total !== input.stores.length
  ) throw new Error("出力店舗数が入力と一致しません");

  const ids = new Set<string>();
  const byAddress = new Map<string, string>();
  output.stores.forEach((store, index) => {
    const original = input.stores[index];
    if (store.id !== original.id || ids.has(store.id)) {
      throw new Error(`店舗IDまたは順序が不正です (index: ${index})`);
    }
    ids.add(store.id);
    assertOriginalFields(original, store);
    const geocode = store.geocode;
    if (geocode.status === "matched") {
      if (
        geocode.longitude === null ||
        geocode.latitude === null ||
        !isWithinHokkaido(geocode.longitude, geocode.latitude)
      ) throw new Error(`取得座標が不正です (${store.id})`);
    } else if (geocode.longitude !== null || geocode.latitude !== null) {
      throw new Error(`未取得店舗に座標があります (${store.id})`);
    }
    const key = normalizeAddress(store.address);
    const serialized = JSON.stringify(geocode);
    const previous = byAddress.get(key);
    if (previous && previous !== serialized) {
      throw new Error(`同一住所の結果が一致しません (${store.address})`);
    }
    byAddress.set(key, serialized);
  });

  const processed =
    output.stores.filter((store) => store.geocode.status !== "pending").length;
  if (processed !== checkpoint.processed) {
    throw new Error("processedと状態別件数が一致しません");
  }
}

function assertOriginalFields(
  original: Store,
  geocoded: GeocodedStore,
): void {
  for (
    const key of [
      "id",
      "region",
      "municipality",
      "category",
      "name",
      "streetAddress",
      "address",
    ] as const
  ) {
    if (original[key] !== geocoded[key]) {
      throw new Error(`既存フィールドが変更されています (${original.id})`);
    }
  }
}
