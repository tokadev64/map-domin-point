import type { RegionMarkerDefinition } from "./types";

export const APP_LOCALE = "ja-JP";
export const SEARCH_LOCALE = "ja";
export const OTHER_CATEGORY_PREFIX = "その他の";
export const PAGE_SIZE = 80;
export const RESULT_ANNOUNCEMENT_DELAY_MS = 300;

export const STORE_DATA_URL = `${import.meta.env.BASE_URL}data/stores.json`;
export const STORE_POINTS_URL =
  `${import.meta.env.BASE_URL}data/store-points.geojson`;
export const STORE_POINTS_REFRESH_INTERVAL_MS = 30_000;
export const GSI_ADDRESS_SEARCH_URL =
  "https://msearch.gsi.go.jp/address-search/AddressSearch";
export const GOOGLE_MAPS_SEARCH_URL =
  "https://www.google.com/maps/search/?api=1&query=";
export const OFFICIAL_SITE_URL = "https://doumin-ouen.pref.hokkaido.lg.jp/";
export const GITHUB_REPOSITORY_URL =
  "https://github.com/tokadev64/map-domin-point";
export const COORDINATE_STORAGE_PREFIX = "domin-point:coordinates:";

export const FORM_IDS = {
  query: "store-query",
  category: "store-category",
  regionLegend: "store-region-legend",
} as const;

export const MAP_CONFIG = {
  center: [142.1, 43.55] as [number, number],
  initialZoom: 5.25,
  selectedStoreZoom: 15.5,
  selectedStoreAnimationDurationMs: 800,
  selectedStoreEdgePadding: 16,
  regionFitAnimationDurationMs: 800,
  regionFitPadding: 48,
  regionFitMaximumZoom: 10,
  minimumZoom: 4,
  maximumZoom: 18,
  tileSize: 256,
} as const;

export const MAP_CONTROL_POSITIONS = {
  navigation: "bottom-right",
  scale: "bottom-left",
} as const;

export const MAP_LAYER_IDS = {
  storeSource: "geocoded-stores",
  clusters: "store-clusters",
  clusterCount: "store-cluster-count",
  points: "store-points",
} as const;

export const OSM_TILE_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_ATTRIBUTION =
  '地図 &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a> ／ 住所検索：<a href="https://www.gsi.go.jp/">国土地理院</a>';

export const REGION_MARKERS: readonly RegionMarkerDefinition[] = [
  { label: "道北", coordinates: [142.45, 44.55] },
  { label: "道東", coordinates: [144.25, 43.35] },
  { label: "道央", coordinates: [141.25, 43.15] },
  { label: "道南", coordinates: [140.55, 42.05] },
];

export const CATEGORY_COLORS: Readonly<Record<string, string>> = {
  "ガソリンスタンド・燃料販売": "#92400e",
  "カフェ・レストラン": "#db2777",
  "コンビニ": "#2563eb",
  "スーパー": "#ea580c",
  "その他のサービス業": "#64748b",
  "その他の飲食店（テイクアウト含む）": "#e11d48",
  "その他の飲食料品小売店": "#ca8a04",
  "その他の小売店": "#475569",
  "ドラッグストア・薬局": "#059669",
  "ホームセンター・家具・家電": "#7c3aed",
  "ホテル・旅館": "#0891b2",
  "レジャー・スポーツ・フィットネス": "#0d9488",
  "レジャー・スポーツ用品": "#0284c7",
  "衣料・身の回り品": "#c026d3",
  "飲食料品商店": "#d97706",
  "運輸・交通": "#4f46e5",
  "居酒屋": "#be123c",
  "百貨店・ショッピングセンター": "#9333ea",
  "弁当・仕出し": "#f97316",
  "理美容": "#a21caf",
};

export const DEFAULT_CATEGORY_COLOR = "#55616f";
