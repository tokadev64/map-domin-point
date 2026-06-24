<script setup lang="ts">
import { computed } from "vue";
import { categoryColor } from "../category-color";
import { APP_LOCALE, PAGE_SIZE } from "../constants";
import { useStoreMapContext } from "../composables/store-map-context";

const {
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

function showStoreOnMap(store: Parameters<typeof selectStore>[0]): void {
  selectStore(store);
}
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

    <ul class="store-grid" role="list">
      <li v-for="store in visibleStores" :key="store.id">
        <article
          class="store-card"
          :class="{ selected: selectedStore?.id === store.id }"
        >
          <div class="store-card__primary">
            <span class="region-tag">
              {{ store.region }}
            </span>
            <span
              class="store-card__category"
              :style="{ '--category-color': categoryColor(store.category) }"
            >
              {{ store.category }}
            </span>
            <h3>{{ store.name }}</h3>
          </div>
          <div class="store-card__secondary">
            <address>{{ store.address }}</address>
            <button
              type="button"
              class="store-card__map-button"
              :aria-pressed="selectedStore?.id === store.id"
              @click="showStoreOnMap(store)"
            >
              <span aria-hidden="true">●</span>
              地図
              <span class="visually-hidden">：{{ store.name }}</span>
            </button>
          </div>
        </article>
      </li>
    </ul>

    <p v-if="!loading && drawerFilteredStores.length === 0" class="empty-state">
      条件に一致する店舗がありません。検索条件を変更してください。
    </p>
    <button
      v-if="visibleCount < drawerFilteredStores.length"
      type="button"
      class="load-more"
      @click="loadMore"
    >
      さらに{{
        Math.min(PAGE_SIZE, drawerFilteredStores.length - visibleCount)
      }}件を表示
    </button>
  </section>
</template>
