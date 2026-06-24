import { GEOCODING_DEFAULTS } from "../src/geocoding/constants.ts";
import {
  createCheckpoint,
  readCheckpoint,
  writeJsonAtomic,
} from "../src/geocoding/checkpoint.ts";
import { geocodeAddress } from "../src/geocoding/gsi-client.ts";
import { isWithinHokkaido } from "../src/geocoding/gsi-client.ts";
import { createStorePointCollection } from "../src/geocoding/store-points.ts";
import {
  addressCandidates,
  normalizeAddress,
} from "../src/geocoding/normalize-address.ts";
import type {
  GeocodedStoreDataset,
  GeocodingCheckpoint,
  StoreGeocode,
} from "../src/geocoding/types.ts";
import { GeocodeRequestError } from "../src/geocoding/types.ts";
import { validateResult } from "../src/geocoding/validate.ts";
import type { StoreDataset } from "../src/types.ts";

interface CliOptions {
  input: string;
  output: string;
  checkpoint: string;
  unresolved: string;
  rejected: string;
  manualOverrides: string;
  resume: boolean;
  retryFailed: boolean;
  storeIds: Set<string>;
  limit: number | null;
  minimumDelayMs: number;
  maximumDelayMs: number;
  maxAttempts: number;
  timeoutMs: number;
  maximumConsecutiveErrors: number;
  dryRun: boolean;
}

interface RunStats {
  apiRequests: number;
  cacheHits: number;
  startedAt: number;
}

interface ManualOverride {
  storeId: string;
  latitude: number;
  longitude: number;
}

const HELP = `店舗住所を国土地理院住所検索APIで逐次変換します。

Usage:
  deno task geocode [options]

Options:
  --input <path>                  入力JSON
  --output <path>                 完了時の座標付きJSON
  --checkpoint <path>             再開用チェックポイント
  --unresolved <path>             未解決店舗の出力先
  --rejected <path>               範囲外・不正結果の出力先
  --manual-overrides <path>       手動確認済み座標
  --resume                        チェックポイントから再開
  --retry-failed                  失敗済み店舗も再試行
  --store-id <id>                 指定店舗だけ処理（複数指定可）
  --limit <count>                 今回処理する店舗数
  --delay-ms <milliseconds>       固定リクエスト間隔
  --min-delay-ms <milliseconds>   最小リクエスト間隔
  --max-delay-ms <milliseconds>   最大リクエスト間隔
  --max-attempts <count>          各住所候補の一時障害リトライ回数
  --timeout-ms <milliseconds>     1リクエストのタイムアウト
  --max-consecutive-errors <n>    連続エラー停止閾値
  --dry-run                       APIを呼ばず入力と候補だけ検証
  --help                          このヘルプを表示
`;

function parsePositiveInteger(name: string, value: string | undefined): number {
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new Error(`${name}には正の整数が必要です`);
  }
  return parsed;
}

function nextValue(args: string[], index: number, name: string): string {
  const value = args[index + 1];
  if (!value || value.startsWith("--")) {
    throw new Error(`${name}の値がありません`);
  }
  return value;
}

function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    input: GEOCODING_DEFAULTS.input,
    output: GEOCODING_DEFAULTS.output,
    checkpoint: GEOCODING_DEFAULTS.checkpoint,
    unresolved: GEOCODING_DEFAULTS.unresolved,
    rejected: GEOCODING_DEFAULTS.rejected,
    manualOverrides: GEOCODING_DEFAULTS.manualOverrides,
    resume: false,
    retryFailed: false,
    storeIds: new Set(),
    limit: null,
    minimumDelayMs: GEOCODING_DEFAULTS.minimumDelayMs,
    maximumDelayMs: GEOCODING_DEFAULTS.maximumDelayMs,
    maxAttempts: GEOCODING_DEFAULTS.maxAttempts,
    timeoutMs: GEOCODING_DEFAULTS.requestTimeoutMs,
    maximumConsecutiveErrors: GEOCODING_DEFAULTS.maximumConsecutiveErrors,
    dryRun: false,
  };

  for (let index = 0; index < args.length; index++) {
    const argument = args[index];
    if (argument === "--") continue;
    if (argument === "--help") {
      console.log(HELP);
      Deno.exit(0);
    } else if (argument === "--resume") options.resume = true;
    else if (argument === "--retry-failed") options.retryFailed = true;
    else if (argument === "--dry-run") options.dryRun = true;
    else if (argument === "--store-id") {
      options.storeIds.add(nextValue(args, index, argument));
      index++;
    } else if (
      [
        "--input",
        "--output",
        "--checkpoint",
        "--unresolved",
        "--rejected",
        "--manual-overrides",
      ].includes(argument)
    ) {
      const value = nextValue(args, index, argument);
      const key = argument === "--manual-overrides"
        ? "manualOverrides"
        : argument.slice(2) as
          | "input"
          | "output"
          | "checkpoint"
          | "unresolved"
          | "rejected";
      options[key] = value;
      index++;
    } else if (argument === "--limit") {
      options.limit = parsePositiveInteger(
        argument,
        nextValue(args, index, argument),
      );
      index++;
    } else if (argument === "--delay-ms") {
      const value = parsePositiveInteger(
        argument,
        nextValue(args, index, argument),
      );
      options.minimumDelayMs = value;
      options.maximumDelayMs = value;
      index++;
    } else if (argument === "--min-delay-ms") {
      options.minimumDelayMs = parsePositiveInteger(
        argument,
        nextValue(args, index, argument),
      );
      index++;
    } else if (argument === "--max-delay-ms") {
      options.maximumDelayMs = parsePositiveInteger(
        argument,
        nextValue(args, index, argument),
      );
      index++;
    } else if (argument === "--max-attempts") {
      options.maxAttempts = parsePositiveInteger(
        argument,
        nextValue(args, index, argument),
      );
      index++;
    } else if (argument === "--timeout-ms") {
      options.timeoutMs = parsePositiveInteger(
        argument,
        nextValue(args, index, argument),
      );
      index++;
    } else if (argument === "--max-consecutive-errors") {
      options.maximumConsecutiveErrors = parsePositiveInteger(
        argument,
        nextValue(args, index, argument),
      );
      index++;
    } else {
      throw new Error(`不明な引数です: ${argument}`);
    }
  }
  if (options.minimumDelayMs > options.maximumDelayMs) {
    throw new Error("最小待機時間は最大待機時間以下にしてください");
  }
  if (options.retryFailed && !options.resume) {
    throw new Error("--retry-failedには--resumeが必要です");
  }
  return options;
}

function isStoreDataset(value: unknown): value is StoreDataset {
  if (!value || typeof value !== "object") return false;
  const dataset = value as Record<string, unknown>;
  return (
    typeof dataset.title === "string" &&
    typeof dataset.generatedAt === "string" &&
    typeof dataset.count === "number" &&
    Array.isArray(dataset.stores) &&
    dataset.count === dataset.stores.length &&
    dataset.stores.every((value) => {
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
    })
  );
}

async function loadDataset(path: string): Promise<StoreDataset> {
  const value: unknown = JSON.parse(await Deno.readTextFile(path));
  if (!isStoreDataset(value)) throw new Error("入力JSONの形式が不正です");
  const ids = new Set(value.stores.map((store) => store.id));
  if (ids.size !== value.stores.length) {
    throw new Error("入力JSONに重複する店舗IDがあります");
  }
  return value;
}

async function loadManualOverrides(
  path: string,
  dataset: StoreDataset,
): Promise<Map<string, ManualOverride>> {
  const value: unknown = JSON.parse(await Deno.readTextFile(path));
  if (!Array.isArray(value)) {
    throw new Error("手動補完ファイルの形式が不正です");
  }
  const knownIds = new Set(dataset.stores.map((store) => store.id));
  const overrides = new Map<string, ManualOverride>();
  for (const item of value) {
    if (!item || typeof item !== "object") {
      throw new Error("手動補完エントリの形式が不正です");
    }
    const entry = item as Record<string, unknown>;
    if (
      typeof entry.storeId !== "string" ||
      typeof entry.latitude !== "number" ||
      typeof entry.longitude !== "number" ||
      !knownIds.has(entry.storeId) ||
      !isWithinHokkaido(entry.longitude, entry.latitude) ||
      overrides.has(entry.storeId)
    ) {
      throw new Error(`手動補完エントリが不正です: ${String(entry.storeId)}`);
    }
    overrides.set(entry.storeId, {
      storeId: entry.storeId,
      latitude: entry.latitude,
      longitude: entry.longitude,
    });
  }
  return overrides;
}

function delayDuration(options: CliOptions): number {
  const range = options.maximumDelayMs - options.minimumDelayMs;
  return options.minimumDelayMs + Math.floor(Math.random() * (range + 1));
}

function sleep(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

function backoffDuration(attempt: number): number {
  const base = GEOCODING_DEFAULTS.backoffBaseMs * 2 ** (attempt - 1);
  const jitter = Math.floor(Math.random() * 1_000);
  return Math.min(base + jitter, GEOCODING_DEFAULTS.backoffMaximumMs);
}

function result(
  status: StoreGeocode["status"],
  queryAddress: string,
  attempts: number,
  details: Partial<StoreGeocode> = {},
): StoreGeocode {
  return {
    status,
    latitude: null,
    longitude: null,
    source: null,
    queryAddress,
    matchedAddress: null,
    geocodedAt: new Date().toISOString(),
    attempts,
    error: null,
    ...details,
  };
}

async function geocodeStore(
  store: StoreDataset["stores"][number],
  options: CliOptions,
  stats: RunStats,
  signal: AbortSignal,
): Promise<StoreGeocode> {
  let attempts = 0;
  let lastQuery = store.address;
  for (const queryAddress of addressCandidates(store)) {
    lastQuery = queryAddress;
    for (let retry = 1; retry <= options.maxAttempts; retry++) {
      if (signal.aborted) throw signal.reason;
      attempts++;
      stats.apiRequests++;
      try {
        const response = await geocodeAddress(queryAddress, {
          timeoutMs: options.timeoutMs,
          signal,
        });
        await sleep(delayDuration(options));
        if (response.kind === "not-found") break;
        if (response.kind === "invalid-result") {
          return result("invalid-result", queryAddress, attempts, {
            error: response.error,
          });
        }
        return result("matched", queryAddress, attempts, {
          latitude: response.latitude,
          longitude: response.longitude,
          source: "gsi",
          matchedAddress: response.matchedAddress,
        });
      } catch (cause) {
        if (signal.aborted) throw cause;
        const error = cause instanceof GeocodeRequestError
          ? cause
          : new GeocodeRequestError(String(cause), null, true);
        if (!error.retryable || retry === options.maxAttempts) {
          return result("request-error", queryAddress, attempts, {
            error: error.message,
          });
        }
        const wait = backoffDuration(retry);
        console.warn(
          `一時エラー: ${error.message}; ${wait}ms後に再試行します`,
        );
        await sleep(wait);
      }
    }
  }
  return result("not-found", lastQuery, attempts);
}

function shouldProcess(
  status: StoreGeocode["status"],
  retryFailed: boolean,
): boolean {
  if (status === "pending") return true;
  return retryFailed && status !== "matched";
}

function buildCache(
  checkpoint: GeocodingCheckpoint,
): Map<string, StoreGeocode> {
  const cache = new Map<string, StoreGeocode>();
  for (const store of checkpoint.stores) {
    if (store.geocode.status !== "pending") {
      cache.set(normalizeAddress(store.address), store.geocode);
    }
  }
  return cache;
}

async function saveCheckpoint(
  path: string,
  checkpoint: GeocodingCheckpoint,
): Promise<void> {
  checkpoint.updatedAt = new Date().toISOString();
  checkpoint.processed =
    checkpoint.stores.filter((store) => store.geocode.status !== "pending")
      .length;
  await writeJsonAtomic(path, checkpoint);
  await writeJsonAtomic(
    GEOCODING_DEFAULTS.points,
    createStorePointCollection(checkpoint.stores),
  );
}

function summarize(checkpoint: GeocodingCheckpoint, stats: RunStats): void {
  const counts = new Map<string, number>();
  for (const store of checkpoint.stores) {
    counts.set(
      store.geocode.status,
      (counts.get(store.geocode.status) ?? 0) + 1,
    );
  }
  console.log(`total: ${checkpoint.total}`);
  for (
    const status of [
      "matched",
      "not-found",
      "invalid-result",
      "request-error",
      "pending",
    ]
  ) {
    console.log(`${status}: ${counts.get(status) ?? 0}`);
  }
  console.log(`API requests: ${stats.apiRequests}`);
  console.log(`cache hits: ${stats.cacheHits}`);
  console.log(`elapsed: ${Math.round((Date.now() - stats.startedAt) / 1000)}s`);
}

async function writeFinalOutputs(
  dataset: StoreDataset,
  checkpoint: GeocodingCheckpoint,
  options: CliOptions,
): Promise<void> {
  checkpoint.completedAt = new Date().toISOString();
  await saveCheckpoint(options.checkpoint, checkpoint);
  const output: GeocodedStoreDataset = {
    ...dataset,
    stores: checkpoint.stores,
  };
  validateResult(dataset, output, checkpoint);
  await writeJsonAtomic(options.output, output);
  await writeJsonAtomic(
    options.unresolved,
    checkpoint.stores.filter((store) =>
      store.geocode.status === "not-found" ||
      store.geocode.status === "request-error"
    ),
  );
  await writeJsonAtomic(
    options.rejected,
    checkpoint.stores.filter((store) =>
      store.geocode.status === "invalid-result"
    ),
  );
}

async function main(): Promise<void> {
  const options = parseArgs(Deno.args);
  const dataset = await loadDataset(options.input);
  const uniqueAddresses = new Set(
    dataset.stores.map((store) => normalizeAddress(store.address)),
  );
  if (options.dryRun) {
    const candidateCounts = dataset.stores.map((store) =>
      addressCandidates(store).length
    );
    console.log(`stores: ${dataset.stores.length}`);
    console.log(`unique normalized addresses: ${uniqueAddresses.size}`);
    console.log(
      `maximum address candidates: ${Math.max(...candidateCounts)}`,
    );
    console.log("dry-run: API requests: 0");
    return;
  }

  const checkpoint = options.resume
    ? await readCheckpoint(options.checkpoint, dataset.stores)
    : createCheckpoint(dataset.stores);
  const manualOverrides = await loadManualOverrides(
    options.manualOverrides,
    dataset,
  );
  const cache = buildCache(checkpoint);
  const stats: RunStats = {
    apiRequests: 0,
    cacheHits: 0,
    startedAt: Date.now(),
  };
  const abortController = new AbortController();
  let stopping = false;
  const stop = () => {
    stopping = true;
    abortController.abort(new Error("SIGINTを受信しました"));
  };
  Deno.addSignalListener("SIGINT", stop);
  let handled = 0;
  let consecutiveErrors = 0;

  try {
    for (let index = 0; index < checkpoint.stores.length; index++) {
      if (stopping || (options.limit !== null && handled >= options.limit)) {
        break;
      }
      const store = checkpoint.stores[index];
      if (options.storeIds.size > 0 && !options.storeIds.has(store.id)) {
        continue;
      }
      if (!shouldProcess(store.geocode.status, options.retryFailed)) continue;

      const cacheKey = normalizeAddress(store.address);
      const manualOverride = manualOverrides.get(store.id);
      const cached = cache.get(cacheKey);
      if (manualOverride) {
        store.geocode = result("matched", store.address, 0, {
          latitude: manualOverride.latitude,
          longitude: manualOverride.longitude,
          source: "manual",
        });
        cache.set(cacheKey, store.geocode);
      } else if (
        cached && !(options.retryFailed && cached.status !== "matched")
      ) {
        store.geocode = structuredClone(cached);
        stats.cacheHits++;
      } else {
        store.geocode = await geocodeStore(
          store,
          options,
          stats,
          abortController.signal,
        );
        cache.set(cacheKey, store.geocode);
      }
      handled++;
      consecutiveErrors = store.geocode.status === "request-error"
        ? consecutiveErrors + 1
        : 0;
      await saveCheckpoint(options.checkpoint, checkpoint);
      console.log(
        `[${checkpoint.processed}/${checkpoint.total}] ${store.geocode.status} ${store.name}`,
      );
      if (consecutiveErrors >= options.maximumConsecutiveErrors) {
        throw new Error(
          `request-errorが${consecutiveErrors}件連続したため停止しました`,
        );
      }
    }
  } finally {
    Deno.removeSignalListener("SIGINT", stop);
    await saveCheckpoint(options.checkpoint, checkpoint);
  }

  const pending = checkpoint.stores.some((store) =>
    store.geocode.status === "pending"
  );
  if (!pending) await writeFinalOutputs(dataset, checkpoint, options);
  else {
    console.log(
      `未処理が残っています。--resumeで再開してください: ${options.checkpoint}`,
    );
  }
  summarize(checkpoint, stats);
}

if (import.meta.main) {
  try {
    await main();
  } catch (cause) {
    console.error(`geocoding failed: ${String(cause)}`);
    Deno.exit(1);
  }
}
