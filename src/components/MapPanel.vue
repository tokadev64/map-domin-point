<script setup lang="ts">
import maplibregl, {
  type GeoJSONSource,
  type Map as MapLibreMap,
  type MapMouseEvent,
  type Marker,
} from "maplibre-gl";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import {
  MAP_CONFIG,
  MAP_CONTROL_POSITIONS,
  MAP_LAYER_IDS,
  OSM_ATTRIBUTION,
  OSM_TILE_URL,
  STORE_POINTS_REFRESH_INTERVAL_MS,
  STORE_POINTS_URL,
} from "../constants";
import { categoryColor } from "../category-color";
import { useStoreMapContext } from "../composables/store-map-context";
import { filterStorePointCollection } from "../geocoding/store-points";
import type { StorePointFeatureCollection } from "../geocoding/types";
import { calculateMapPadding, type Rectangle } from "../map-occlusion";

const props = defineProps<{
  drawerOpen: boolean;
  sheetStage: "closed" | "half" | "full";
}>();

const {
  clearSelectedStore,
  dataset,
  query,
  region,
  selectStoreAtCoordinates,
  selectedCoordinates,
  selectedCategories,
  selectedStore,
  viewportStoreIds,
} = useStoreMapContext();

const mapElement = ref<HTMLElement | null>(null);
let map: MapLibreMap | null = null;
let storeMarker: Marker | null = null;
let refreshTimer: ReturnType<typeof setInterval> | undefined;
let preserveZoomOnNextSelection = false;
let storePointCollection: StorePointFeatureCollection = {
  type: "FeatureCollection",
  features: [],
};

function prefersReducedMotion(): boolean {
  return globalThis.matchMedia?.("(prefers-reduced-motion: reduce)").matches ??
    false;
}

function removeStoreMarker(): void {
  storeMarker?.remove();
  storeMarker = null;
}

function measureTargetDrawer(): Rectangle | undefined {
  const workspace = mapElement.value?.closest<HTMLElement>(".map-workspace");
  const drawer = workspace?.querySelector<HTMLElement>(".store-drawer");
  if (!workspace || !drawer) return undefined;

  const isBottomSheet = globalThis.matchMedia("(max-width: 640px)").matches;
  if (!isBottomSheet && !props.drawerOpen) return undefined;

  const measurement = drawer.cloneNode(false) as HTMLElement;
  measurement.removeAttribute("id");
  measurement.setAttribute("aria-hidden", "true");
  Object.assign(measurement.style, {
    pointerEvents: "none",
    transform: "none",
    transition: "none",
    visibility: "hidden",
  });
  workspace.append(measurement);
  const bounds = measurement.getBoundingClientRect();
  measurement.remove();
  return bounds;
}

function selectedStorePadding(): ReturnType<typeof calculateMapPadding> {
  const mapBounds = mapElement.value?.getBoundingClientRect();
  if (!mapBounds) {
    const padding = MAP_CONFIG.selectedStoreEdgePadding;
    return { top: padding, right: padding, bottom: padding, left: padding };
  }
  const drawerBounds = measureTargetDrawer();
  return calculateMapPadding(
    mapBounds,
    drawerBounds ? [drawerBounds] : [],
    MAP_CONFIG.selectedStoreEdgePadding,
  );
}

function updateViewportStoreIds(): void {
  const currentMap = map;
  if (!currentMap) return;
  const bounds = currentMap.getBounds();
  viewportStoreIds.value = new Set(
    storePointCollection.features
      .filter((feature) =>
        bounds.contains(feature.geometry.coordinates)
      )
      .map((feature) => feature.properties.id),
  );
}

function updateVisibleStorePoints(): void {
  const visibleCollection = filterStorePointCollection(
    storePointCollection,
    region.value,
    selectedCategories.value,
    query.value,
  );
  const source = map?.getSource(
    MAP_LAYER_IDS.storeSource,
  ) as GeoJSONSource | undefined;
  source?.setData(visibleCollection);
}

function fitVisibleStorePoints(): void {
  const currentMap = map;
  const visibleCollection = filterStorePointCollection(
    storePointCollection,
    region.value,
    selectedCategories.value,
    query.value,
  );
  const firstFeature = visibleCollection.features[0];
  if (!currentMap || !firstFeature) return;

  const bounds = new maplibregl.LngLatBounds(
    firstFeature.geometry.coordinates,
    firstFeature.geometry.coordinates,
  );
  for (const feature of visibleCollection.features.slice(1)) {
    bounds.extend(feature.geometry.coordinates);
  }
  currentMap.fitBounds(bounds, {
    padding: MAP_CONFIG.regionFitPadding,
    maxZoom: MAP_CONFIG.regionFitMaximumZoom,
    duration: prefersReducedMotion()
      ? 0
      : MAP_CONFIG.regionFitAnimationDurationMs,
  });
}

async function refreshStorePoints(): Promise<void> {
  const response = await fetch(
    `${STORE_POINTS_URL}?updated=${Date.now()}`,
    { cache: "no-store" },
  );
  if (!response.ok) return;
  const collection = await response.json();
  if (
    !collection ||
    collection.type !== "FeatureCollection" ||
    !Array.isArray(collection.features)
  ) {
    return;
  }
  storePointCollection = collection as StorePointFeatureCollection;
  updateVisibleStorePoints();
  updateViewportStoreIds();
}

function selectPointStore(event: MapMouseEvent): void {
  const feature = event.features?.[0];
  const storeId = feature?.properties?.id;
  if (
    typeof storeId !== "string" ||
    feature?.geometry.type !== "Point"
  ) {
    return;
  }
  const store = dataset.value?.stores.find((candidate) =>
    candidate.id === storeId
  );
  const [longitude, latitude] = feature.geometry.coordinates;
  if (
    store &&
    typeof longitude === "number" &&
    typeof latitude === "number"
  ) {
    preserveZoomOnNextSelection = true;
    selectStoreAtCoordinates(store, { longitude, latitude });
  }
}

async function expandCluster(event: MapMouseEvent): Promise<void> {
  const currentMap = map;
  const feature = event.features?.[0];
  const clusterId = feature?.properties?.cluster_id;
  if (!currentMap || typeof clusterId !== "number") return;
  const source = currentMap.getSource(
    MAP_LAYER_IDS.storeSource,
  ) as GeoJSONSource | undefined;
  if (!source || feature.geometry.type !== "Point") return;
  const zoom = await source.getClusterExpansionZoom(clusterId);
  currentMap.jumpTo({
    center: feature.geometry.coordinates as [number, number],
    zoom,
  });
}

onMounted(() => {
  if (!mapElement.value) return;

  map = new maplibregl.Map({
    container: mapElement.value,
    style: {
      version: 8,
      sources: {
        osm: {
          type: "raster",
          tiles: [OSM_TILE_URL],
          tileSize: MAP_CONFIG.tileSize,
          attribution: OSM_ATTRIBUTION,
        },
      },
      layers: [{ id: "osm", type: "raster", source: "osm" }],
    },
    center: MAP_CONFIG.center,
    zoom: MAP_CONFIG.initialZoom,
    minZoom: MAP_CONFIG.minimumZoom,
    maxZoom: MAP_CONFIG.maximumZoom,
  });

  map.addControl(
    new maplibregl.NavigationControl({ visualizePitch: true }),
    MAP_CONTROL_POSITIONS.navigation,
  );
  map.addControl(
    new maplibregl.ScaleControl({ unit: "metric" }),
    MAP_CONTROL_POSITIONS.scale,
  );

  map.on("load", () => {
    const currentMap = map;
    if (!currentMap) return;
    currentMap.addSource(MAP_LAYER_IDS.storeSource, {
      type: "geojson",
      data: storePointCollection,
      cluster: true,
      clusterMaxZoom: 12,
      clusterRadius: 42,
    });
    currentMap.addLayer({
      id: MAP_LAYER_IDS.clusters,
      type: "circle",
      source: MAP_LAYER_IDS.storeSource,
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "#113f3b",
        "circle-radius": [
          "step",
          ["get", "point_count"],
          16,
          50,
          21,
          200,
          27,
        ],
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 3,
      },
    });
    currentMap.addLayer({
      id: MAP_LAYER_IDS.clusterCount,
      type: "symbol",
      source: MAP_LAYER_IDS.storeSource,
      filter: ["has", "point_count"],
      layout: {
        "text-field": ["get", "point_count_abbreviated"],
        "text-size": 12,
      },
      paint: {
        "text-color": "#ffffff",
      },
    });
    currentMap.addLayer({
      id: MAP_LAYER_IDS.points,
      type: "circle",
      source: MAP_LAYER_IDS.storeSource,
      filter: ["!", ["has", "point_count"]],
      paint: {
        "circle-color": ["get", "color"],
        "circle-radius": 7,
        "circle-stroke-color": "#ffffff",
        "circle-stroke-width": 2,
      },
    });
    currentMap.on("click", MAP_LAYER_IDS.points, selectPointStore);
    currentMap.on("click", MAP_LAYER_IDS.clusters, expandCluster);
    currentMap.on("moveend", updateViewportStoreIds);
    for (
      const layerId of [MAP_LAYER_IDS.points, MAP_LAYER_IDS.clusters]
    ) {
      currentMap.on("mouseenter", layerId, () => {
        currentMap.getCanvas().style.cursor = "pointer";
      });
      currentMap.on("mouseleave", layerId, () => {
        currentMap.getCanvas().style.cursor = "";
      });
    }
    void refreshStorePoints();
    refreshTimer = setInterval(
      () => void refreshStorePoints(),
      STORE_POINTS_REFRESH_INTERVAL_MS,
    );
  });
});

watch(selectedCoordinates, (coordinates) => {
  removeStoreMarker();
  const currentMap = map;
  if (!currentMap || !coordinates) {
    preserveZoomOnNextSelection = false;
    return;
  }

  const element = document.createElement("div");
  element.className = "store-marker";
  element.style.setProperty(
    "--marker-color",
    categoryColor(selectedStore.value?.category ?? ""),
  );
  storeMarker = new maplibregl.Marker({ element })
    .setLngLat([coordinates.longitude, coordinates.latitude])
    .addTo(currentMap);
});

watch(
  [
    selectedCoordinates,
    () => props.drawerOpen,
    () => props.sheetStage,
  ],
  ([coordinates], [previousCoordinates]) => {
    const currentMap = map;
    if (!currentMap || !coordinates) {
      preserveZoomOnNextSelection = false;
      return;
    }

    const coordinatesChanged = coordinates !== previousCoordinates;
    const cameraOptions: maplibregl.EaseToOptions = {
      center: [coordinates.longitude, coordinates.latitude],
      duration: prefersReducedMotion()
        ? 0
        : MAP_CONFIG.selectedStoreAnimationDurationMs,
      padding: selectedStorePadding(),
      retainPadding: false,
    };
    if (coordinatesChanged && !preserveZoomOnNextSelection) {
      cameraOptions.zoom = MAP_CONFIG.selectedStoreZoom;
    }
    if (coordinatesChanged) preserveZoomOnNextSelection = false;
    currentMap.easeTo(cameraOptions);
  },
  { flush: "post" },
);

watch(selectedStore, (store) => {
  if (!store || selectedCoordinates.value) return;
  const feature = storePointCollection.features.find((candidate) =>
    candidate.properties.id === store.id
  );
  if (!feature) return;
  const [longitude, latitude] = feature.geometry.coordinates;
  selectStoreAtCoordinates(store, { longitude, latitude });
});

watch(region, (selectedRegion) => {
  updateVisibleStorePoints();
  if (
    selectedRegion &&
    selectedStore.value &&
    selectedStore.value.region !== selectedRegion
  ) {
    clearSelectedStore();
  }
  fitVisibleStorePoints();
});

watch(
  selectedCategories,
  () => updateVisibleStorePoints(),
  { deep: true },
);

watch(query, () => updateVisibleStorePoints());

onBeforeUnmount(() => {
  removeStoreMarker();
  clearInterval(refreshTimer);
  map?.remove();
});
</script>

<template>
  <section class="map-shell" aria-labelledby="map-heading">
    <h2 id="map-heading" class="visually-hidden">店舗地図</h2>
    <div ref="mapElement" class="map"></div>
  </section>
</template>
