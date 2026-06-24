export const REGIONS = ["道央", "道南", "道北", "道東"] as const;

export type Region = (typeof REGIONS)[number];
export type RegionFilter = Region | "";

export interface Store {
  id: string;
  region: Region;
  municipality: string;
  category: string;
  name: string;
  streetAddress: string;
  address: string;
}

export interface StoreDataset {
  title: string;
  generatedAt: string;
  sourceDates: Record<Region, string>;
  count: number;
  stores: Store[];
}

export interface Coordinates {
  longitude: number;
  latitude: number;
}

export interface StoreFilters {
  query: string;
  region: RegionFilter;
  categories: readonly string[];
}

export interface RegionMarkerDefinition {
  label: Region;
  coordinates: readonly [number, number];
}

export interface GeocodingFeature {
  geometry: {
    coordinates: [number, number];
  };
}
