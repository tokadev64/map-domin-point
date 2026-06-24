import {
  readCheckpoint,
  writeJsonAtomic,
} from "../src/geocoding/checkpoint.ts";
import { GEOCODING_DEFAULTS } from "../src/geocoding/constants.ts";
import { createStorePointCollection } from "../src/geocoding/store-points.ts";
import type { StoreDataset } from "../src/types.ts";

const dataset = JSON.parse(
  await Deno.readTextFile(GEOCODING_DEFAULTS.input),
) as StoreDataset;
const checkpoint = await readCheckpoint(
  GEOCODING_DEFAULTS.checkpoint,
  dataset.stores,
);
const points = createStorePointCollection(checkpoint.stores);

await writeJsonAtomic(GEOCODING_DEFAULTS.points, points);
console.log(
  `Exported ${points.features.length} points to ${GEOCODING_DEFAULTS.points}`,
);
