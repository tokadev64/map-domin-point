<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { APP_LOCALE } from "../constants";
import { useStoreMapContext } from "../composables/store-map-context";
import MapPanel from "./MapPanel.vue";
import StoreCard from "./StoreCard.vue";
import StoreList from "./StoreList.vue";
import StoreSearchForm from "./StoreSearchForm.vue";

const {
  clearSelectedStore,
  drawerFilteredStores,
  selectStore,
  selectedStore,
} = useStoreMapContext();
type SheetStage = "closed" | "half" | "full";

const storeDrawerOpen = ref(false);
const sheetStage = ref<SheetStage>("closed");
const isMobile = ref(false);
let mobileMediaQuery: MediaQueryList | undefined;

const drawerContentInactive = computed(() =>
  isMobile.value
    ? sheetStage.value === "closed"
    : !storeDrawerOpen.value
);

const sheetActionLabel = computed(() => {
  if (sheetStage.value === "closed") return "検索条件を開く";
  if (sheetStage.value === "half") return "店舗一覧まで開く";
  return "検索条件だけ表示";
});

function syncMobileViewport(event?: MediaQueryListEvent): void {
  isMobile.value = event?.matches ?? mobileMediaQuery?.matches ?? false;
}

function advanceSheet(): void {
  sheetStage.value = sheetStage.value === "closed"
    ? "half"
    : sheetStage.value === "half"
    ? "full"
    : "half";
}

function showSelectedStore(): void {
  if (isMobile.value) sheetStage.value = "half";
}

watch(selectedStore, (store) => {
  if (!store) return;
  if (isMobile.value) {
    sheetStage.value = "half";
    return;
  }
  storeDrawerOpen.value = true;
});

onMounted(() => {
  mobileMediaQuery = globalThis.matchMedia("(max-width: 640px)");
  syncMobileViewport();
  mobileMediaQuery.addEventListener("change", syncMobileViewport);
});

onBeforeUnmount(() => {
  mobileMediaQuery?.removeEventListener("change", syncMobileViewport);
});
</script>

<template>
  <section class="finder" aria-labelledby="finder-heading">
    <h2 id="finder-heading" class="visually-hidden">店舗を検索</h2>
    <div
      class="map-workspace"
      :class="{ 'store-drawer-open': storeDrawerOpen }"
    >
      <MapPanel />
      <button
        type="button"
        class="store-drawer-toggle"
        :aria-expanded="storeDrawerOpen"
        aria-controls="store-drawer"
        @click="storeDrawerOpen = !storeDrawerOpen"
      >
        <span aria-hidden="true">{{ storeDrawerOpen ? "‹" : "›" }}</span>
        検索・店舗一覧
        <strong>
          {{ drawerFilteredStores.length.toLocaleString(APP_LOCALE) }}
        </strong>
      </button>
      <aside
        id="store-drawer"
        class="store-drawer"
        :class="[
          { open: storeDrawerOpen },
          { 'has-selected-store': selectedStore },
          `store-drawer--${sheetStage}`,
        ]"
        :aria-hidden="!isMobile && !storeDrawerOpen"
        @keydown.esc="sheetStage = 'closed'"
      >
        <div class="bottom-sheet-header">
          <button
            type="button"
            class="bottom-sheet-stage-button"
            :aria-expanded="sheetStage !== 'closed'"
            :aria-label="sheetActionLabel"
            @click="advanceSheet"
          >
            <span class="bottom-sheet-handle" aria-hidden="true"></span>
            <span>検索・店舗一覧</span>
            <strong>
              {{ drawerFilteredStores.length.toLocaleString(APP_LOCALE) }}件
            </strong>
          </button>
          <button
            v-if="sheetStage !== 'closed'"
            type="button"
            class="bottom-sheet-close"
            aria-label="検索・店舗一覧を閉じる"
            @click="sheetStage = 'closed'"
          >
            ×
          </button>
        </div>
        <div
          class="store-drawer__content"
          :inert="drawerContentInactive"
          :aria-hidden="drawerContentInactive"
        >
          <StoreSearchForm />
          <div
            v-if="selectedStore"
            class="bottom-sheet-selected-store"
            aria-label="選択中の店舗"
          >
            <span class="bottom-sheet-selected-store__label">選択中</span>
            <StoreCard
              :store="selectedStore"
              selected
              @clear="clearSelectedStore"
              @select="selectStore"
            />
          </div>
          <StoreList @store-selected="showSelectedStore" />
        </div>
      </aside>
    </div>
  </section>
</template>
