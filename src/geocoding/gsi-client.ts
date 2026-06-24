import { GSI_ADDRESS_SEARCH_URL, HOKKAIDO_BOUNDS } from "./constants.ts";
import { GeocodeRequestError, type GeocodeResponse } from "./types.ts";

interface GsiFeature {
  geometry?: {
    coordinates?: unknown;
  };
  properties?: {
    title?: unknown;
  };
}

export function isWithinHokkaido(
  longitude: number,
  latitude: number,
): boolean {
  return (
    Number.isFinite(longitude) &&
    Number.isFinite(latitude) &&
    latitude >= HOKKAIDO_BOUNDS.minimumLatitude &&
    latitude <= HOKKAIDO_BOUNDS.maximumLatitude &&
    longitude >= HOKKAIDO_BOUNDS.minimumLongitude &&
    longitude <= HOKKAIDO_BOUNDS.maximumLongitude
  );
}

function parseFeature(value: unknown): GeocodeResponse {
  if (!value || typeof value !== "object") {
    return { kind: "invalid-result", error: "候補の形式が不正です" };
  }
  const feature = value as GsiFeature;
  const coordinates = feature.geometry?.coordinates;
  if (
    !Array.isArray(coordinates) ||
    coordinates.length < 2 ||
    typeof coordinates[0] !== "number" ||
    typeof coordinates[1] !== "number"
  ) {
    return { kind: "invalid-result", error: "座標の形式が不正です" };
  }
  const [longitude, latitude] = coordinates;
  if (!isWithinHokkaido(longitude, latitude)) {
    return {
      kind: "invalid-result",
      error: `北海道の範囲外です (${longitude}, ${latitude})`,
    };
  }
  return {
    kind: "matched",
    longitude,
    latitude,
    matchedAddress: typeof feature.properties?.title === "string"
      ? feature.properties.title
      : null,
  };
}

export async function geocodeAddress(
  address: string,
  options: {
    fetcher?: typeof fetch;
    timeoutMs?: number;
    signal?: AbortSignal;
  } = {},
): Promise<GeocodeResponse> {
  const fetcher = options.fetcher ?? fetch;
  const timeoutMs = options.timeoutMs ?? 15_000;
  const timeoutController = new AbortController();
  const timeout = setTimeout(() => timeoutController.abort(), timeoutMs);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeoutController.signal])
    : timeoutController.signal;
  const url = new URL(GSI_ADDRESS_SEARCH_URL);
  url.searchParams.set("q", address);

  try {
    const response = await fetcher(url, {
      headers: { Accept: "application/json" },
      signal,
    });
    if (!response.ok) {
      throw new GeocodeRequestError(
        `HTTP ${response.status}`,
        response.status,
        response.status === 408 ||
          response.status === 429 ||
          response.status >= 500,
      );
    }
    let value: unknown;
    try {
      value = await response.json();
    } catch {
      throw new GeocodeRequestError("JSON応答が不正です", null, true);
    }
    if (!Array.isArray(value)) {
      return { kind: "invalid-result", error: "API応答の形式が不正です" };
    }
    if (value.length === 0) return { kind: "not-found" };
    return parseFeature(value[0]);
  } catch (cause) {
    if (cause instanceof GeocodeRequestError) throw cause;
    if (options.signal?.aborted) throw cause;
    const timedOut = timeoutController.signal.aborted;
    throw new GeocodeRequestError(
      timedOut ? `タイムアウト (${timeoutMs}ms)` : String(cause),
      null,
      true,
    );
  } finally {
    clearTimeout(timeout);
  }
}
