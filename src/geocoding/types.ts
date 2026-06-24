import type { Store, StoreDataset } from "../types.ts";

export type GeocodeStatus =
  | "matched"
  | "not-found"
  | "invalid-result"
  | "request-error"
  | "pending";

export interface StoreGeocode {
  status: GeocodeStatus;
  latitude: number | null;
  longitude: number | null;
  source: "gsi" | "manual" | null;
  queryAddress: string;
  matchedAddress: string | null;
  geocodedAt: string | null;
  attempts: number;
  error: string | null;
}

export interface GeocodedStore extends Store {
  geocode: StoreGeocode;
}

export interface GeocodedStoreDataset extends Omit<StoreDataset, "stores"> {
  stores: GeocodedStore[];
}

export interface StorePointProperties {
  id: string;
  name: string;
  region: Store["region"];
  category: string;
  color: string;
  address: string;
}

export interface StorePointFeature {
  type: "Feature";
  id: string;
  geometry: {
    type: "Point";
    coordinates: [number, number];
  };
  properties: StorePointProperties;
}

export interface StorePointFeatureCollection {
  type: "FeatureCollection";
  features: StorePointFeature[];
}

export interface GeocodingCheckpoint {
  version: 1;
  startedAt: string;
  updatedAt: string;
  completedAt: string | null;
  total: number;
  processed: number;
  stores: GeocodedStore[];
}

export interface AddressCacheEntry {
  normalizedAddress: string;
  geocode: StoreGeocode;
}

export interface GeocodeMatch {
  kind: "matched";
  latitude: number;
  longitude: number;
  matchedAddress: string | null;
}

export interface GeocodeNotFound {
  kind: "not-found";
}

export interface GeocodeInvalidResult {
  kind: "invalid-result";
  error: string;
}

export type GeocodeResponse =
  | GeocodeMatch
  | GeocodeNotFound
  | GeocodeInvalidResult;

export class GeocodeRequestError extends Error {
  constructor(
    message: string,
    readonly status: number | null,
    readonly retryable: boolean,
  ) {
    super(message);
    this.name = "GeocodeRequestError";
  }
}
