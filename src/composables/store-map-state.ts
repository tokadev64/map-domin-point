import {
  computed,
  type ComputedRef,
  onBeforeUnmount,
  onMounted,
  type Ref,
  ref,
  watch,
} from "vue";
import {
  APP_LOCALE,
  PAGE_SIZE,
  RESULT_ANNOUNCEMENT_DELAY_MS,
} from "../constants";
import {
  readCoordinates,
  writeCoordinates,
} from "../services/coordinate-cache";
import { fetchCoordinates, fetchStoreDataset } from "../services/store-api";
import {
  selectCategories,
  selectFilteredStores,
  selectRegionCounts,
} from "../store-selectors";
import {
  type Coordinates,
  type Region,
  type RegionFilter,
  type Store,
  type StoreDataset,
} from "../types";

export interface StoreMapState {
  dataset: Ref<StoreDataset | null>;
  loading: Ref<boolean>;
  error: Ref<string>;
  query: Ref<string>;
  region: Ref<RegionFilter>;
  selectedCategories: Ref<string[]>;
  categoryMenuOpen: Ref<boolean>;
  viewportOnly: Ref<boolean>;
  viewportStoreIds: Ref<Set<string>>;
  visibleCount: Ref<number>;
  selectedStore: Ref<Store | null>;
  selectedCoordinates: Ref<Coordinates | null>;
  locating: Ref<boolean>;
  locateError: Ref<string>;
  categories: ComputedRef<string[]>;
  filteredStores: ComputedRef<Store[]>;
  drawerFilteredStores: ComputedRef<Store[]>;
  visibleStores: ComputedRef<Store[]>;
  regionCounts: ComputedRef<Record<Region, number>>;
  resultAnnouncement: Ref<string>;
  resetPagination: () => void;
  toggleRegion: (value: Region) => void;
  selectStore: (store: Store) => void;
  selectStoreAtCoordinates: (store: Store, coordinates: Coordinates) => void;
  clearSelectedStore: () => void;
  locateSelectedStore: () => Promise<void>;
  loadMore: () => void;
}

export function createStoreMapState(): StoreMapState {
  const dataset = ref<StoreDataset | null>(null);
  const loading = ref(true);
  const error = ref("");
  const query = ref("");
  const region = ref<RegionFilter>("");
  const selectedCategories = ref<string[]>([]);
  const categoryMenuOpen = ref(false);
  const viewportOnly = ref(false);
  const viewportStoreIds = ref(new Set<string>());
  const visibleCount = ref(PAGE_SIZE);
  const selectedStore = ref<Store | null>(null);
  const selectedCoordinates = ref<Coordinates | null>(null);
  const locating = ref(false);
  const locateError = ref("");
  const resultAnnouncement = ref("");
  let announcementTimer: ReturnType<typeof setTimeout> | undefined;

  const categories = computed(() =>
    selectCategories(dataset.value?.stores ?? [])
  );

  const filteredStores = computed(() =>
    selectFilteredStores(dataset.value?.stores ?? [], {
      query: query.value,
      region: region.value,
      categories: selectedCategories.value,
    })
  );

  const drawerFilteredStores = computed(() => {
    if (!viewportOnly.value) return filteredStores.value;
    return filteredStores.value.filter((store) =>
      viewportStoreIds.value.has(store.id)
    );
  });

  const visibleStores = computed(() =>
    drawerFilteredStores.value.slice(0, visibleCount.value)
  );
  const regionCounts = computed(() =>
    selectRegionCounts(dataset.value?.stores ?? [])
  );

  watch(
    () => filteredStores.value.length,
    (count) => {
      clearTimeout(announcementTimer);
      announcementTimer = setTimeout(() => {
        resultAnnouncement.value = `${
          count.toLocaleString(APP_LOCALE)
        }店舗が見つかりました`;
      }, RESULT_ANNOUNCEMENT_DELAY_MS);
    },
  );

  watch(viewportStoreIds, () => {
    if (viewportOnly.value) resetPagination();
  });

  onMounted(async () => {
    try {
      dataset.value = await fetchStoreDataset();
    } catch (cause) {
      error.value = `店舗データを読み込めませんでした（${String(cause)}）`;
    } finally {
      loading.value = false;
    }
  });

  onBeforeUnmount(() => clearTimeout(announcementTimer));

  function resetPagination(): void {
    visibleCount.value = PAGE_SIZE;
  }

  function toggleRegion(value: Region): void {
    region.value = region.value === value ? "" : value;
    resetPagination();
  }

  function selectStore(store: Store): void {
    selectedStore.value = store;
    locateError.value = "";
    selectedCoordinates.value = readCoordinates(store.id);
  }

  function selectStoreAtCoordinates(
    store: Store,
    coordinates: Coordinates,
  ): void {
    selectedStore.value = store;
    selectedCoordinates.value = coordinates;
    locateError.value = "";
  }

  function clearSelectedStore(): void {
    selectedStore.value = null;
    selectedCoordinates.value = null;
    locateError.value = "";
  }

  async function locateSelectedStore(): Promise<void> {
    const store = selectedStore.value;
    if (!store || locating.value) return;
    locating.value = true;
    locateError.value = "";
    try {
      const coordinates = await fetchCoordinates(store.address);
      selectedCoordinates.value = coordinates;
      writeCoordinates(store.id, coordinates);
    } catch (cause) {
      locateError.value =
        `位置を取得できませんでした。外部地図で確認してください。（${
          String(cause)
        }）`;
    } finally {
      locating.value = false;
    }
  }

  function loadMore(): void {
    visibleCount.value += PAGE_SIZE;
  }

  return {
    dataset,
    loading,
    error,
    query,
    region,
    selectedCategories,
    categoryMenuOpen,
    viewportOnly,
    viewportStoreIds,
    visibleCount,
    selectedStore,
    selectedCoordinates,
    locating,
    locateError,
    categories,
    filteredStores,
    drawerFilteredStores,
    visibleStores,
    regionCounts,
    resultAnnouncement,
    resetPagination,
    toggleRegion,
    selectStore,
    selectStoreAtCoordinates,
    clearSelectedStore,
    locateSelectedStore,
    loadMore,
  };
}
