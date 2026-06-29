<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { categoryColor } from "../category-color";
import { APP_LOCALE } from "../constants";
import { useStoreMapContext } from "../composables/store-map-context";
import StoreCard from "./StoreCard.vue";

const emit = defineEmits<{
  storeSelected: [];
}>();

const {
  clearSelectedStore,
  drawerFilteredStores,
  loadMore,
  loading,
  query,
  region,
  resetPagination,
  selectStore,
  selectedCategories,
  selectedStore,
  viewportOnly,
  visibleCount,
  visibleStores,
} = useStoreMapContext();

const hasActiveFilters = computed(() =>
  query.value.trim().length > 0 ||
  region.value !== "" ||
  selectedCategories.value.length > 0
);
const storeGrid = ref<HTMLUListElement | null>(null);

function showStoreOnMap(store: Parameters<typeof selectStore>[0]): void {
  selectStore(store);
  emit("storeSelected");
}

function preloadMore(event: Event): void {
  const grid = event.currentTarget as HTMLUListElement;
  const remainingScroll =
    grid.scrollHeight - grid.scrollTop - grid.clientHeight;
  if (
    remainingScroll <= 600 &&
    visibleCount.value < drawerFilteredStores.value.length
  ) {
    loadMore();
  }
}

watch(selectedStore, async (store) => {
  if (!store) return;
  const selectedIndex = drawerFilteredStores.value.findIndex((candidate) =>
    candidate.id === store.id
  );
  if (selectedIndex < 0) return;
  visibleCount.value = Math.max(visibleCount.value, selectedIndex + 1);
  await nextTick();
  if (storeGrid.value) storeGrid.value.scrollTop = 0;
});
</script>

<template>
  <section id="store-list" class="store-section" tabindex="-1">
    <div class="section-heading">
      <h2>店舗一覧</h2>
      <p>{{ drawerFilteredStores.length.toLocaleString(APP_LOCALE) }}件</p>
    </div>
    <label class="viewport-filter-toggle">
      <input
        v-model="viewportOnly"
        type="checkbox"
        @change="resetPagination"
      />
      <span>地図の表示範囲内のみ</span>
    </label>
    <div
      v-if="hasActiveFilters"
      class="store-list-filters"
      aria-label="選択中のフィルタ条件"
    >
      <span v-if="query.trim()" class="store-list-filter">
        検索: {{ query }}
      </span>
      <span v-if="region" class="store-list-filter">
        地域: {{ region }}
      </span>
      <span
        v-for="value in selectedCategories"
        :key="value"
        class="store-list-filter store-list-filter--category"
        :style="{ '--category-color': categoryColor(value) }"
      >
        {{ value }}
      </span>
    </div>

    <ul
      ref="storeGrid"
      class="store-grid"
      role="list"
      @scroll.passive="preloadMore"
    >
      <li
        v-for="store in visibleStores"
        :key="store.id"
        :data-store-id="store.id"
      >
        <StoreCard
          :store="store"
          :selected="selectedStore?.id === store.id"
          @clear="clearSelectedStore"
          @select="showStoreOnMap"
        />
      </li>
    </ul>

    <p v-if="!loading && drawerFilteredStores.length === 0" class="empty-state">
      条件に一致する店舗がありません。検索条件を変更してください。
    </p>
  </section>
</template>
