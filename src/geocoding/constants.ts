export const GSI_ADDRESS_SEARCH_URL =
  "https://msearch.gsi.go.jp/address-search/AddressSearch";

export const HOKKAIDO_BOUNDS = {
  minimumLatitude: 41.3,
  maximumLatitude: 45.7,
  minimumLongitude: 139.3,
  maximumLongitude: 146.2,
} as const;

export const GEOCODING_DEFAULTS = {
  input: "public/data/stores.json",
  output: "public/data/stores-geocoded.json",
  points: "public/data/store-points.geojson",
  checkpoint: "data/geocoding/checkpoint.json",
  unresolved: "data/geocoding/unresolved.json",
  rejected: "data/geocoding/rejected.json",
  manualOverrides: "data/geocoding/manual-overrides.json",
  minimumDelayMs: 1_500,
  maximumDelayMs: 2_500,
  maxAttempts: 3,
  requestTimeoutMs: 15_000,
  maximumConsecutiveErrors: 10,
  backoffBaseMs: 5_000,
  backoffMaximumMs: 120_000,
} as const;
