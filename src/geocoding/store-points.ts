import type { RegionFilter } from "../types.ts";
import { categoryColor } from "../category-color.ts";
import { normalizeSearchText } from "../store-utils.ts";
import type { GeocodedStore, StorePointFeatureCollection } from "./types.ts";

export function createStorePointCollection(
  stores: readonly GeocodedStore[],
): StorePointFeatureCollection {
  return {
    type: "FeatureCollection",
    features: stores.flatMap((store) => {
      const { geocode } = store;
      if (
        geocode.status !== "matched" ||
        geocode.longitude === null ||
        geocode.latitude === null
      ) {
        return [];
      }
      return [{
        type: "Feature" as const,
        id: store.id,
        geometry: {
          type: "Point" as const,
          coordinates: [geocode.longitude, geocode.latitude] as [
            number,
            number,
          ],
        },
        properties: {
          id: store.id,
          name: store.name,
          region: store.region,
          category: store.category,
          color: categoryColor(store.category),
          address: store.address,
        },
      }];
    }),
  };
}

export function filterStorePointCollection(
  collection: StorePointFeatureCollection,
  region: RegionFilter,
  categories: readonly string[] = [],
  query = "",
): StorePointFeatureCollection {
  const normalizedQuery = normalizeSearchText(query);
  if (!region && categories.length === 0 && !normalizedQuery) {
    return collection;
  }
  return {
    type: "FeatureCollection",
    features: collection.features.filter((feature) => {
      if (region && feature.properties.region !== region) return false;
      if (
        categories.length > 0 &&
        !categories.includes(feature.properties.category)
      ) return false;
      if (!normalizedQuery) return true;
      return normalizeSearchText(
        `${feature.properties.name} ${feature.properties.address} ${feature.properties.category} ${feature.properties.region}`,
      ).includes(normalizedQuery);
    }),
  };
}
