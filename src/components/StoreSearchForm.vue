<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { FORM_IDS } from "../constants";
import { categoryColor } from "../category-color";
import { useStoreMapContext } from "../composables/store-map-context";
import { REGIONS } from "../types";

const {
  categoryMenuOpen,
  categories,
  query,
  region,
  resetPagination,
  selectedCategories,
} = useStoreMapContext();

const categoryControl = ref<HTMLDetailsElement | null>(null);

const selectedCategorySummary = computed(() => {
  if (selectedCategories.value.length === 0) return "すべての業種";
  if (selectedCategories.value.length <= 2) {
    return selectedCategories.value.join("・");
  }
  return `業種 ${selectedCategories.value.length}件選択`;
});

function clearCategories(): void {
  selectedCategories.value = [];
  resetPagination();
}

function syncCategoryMenu(event: Event): void {
  categoryMenuOpen.value = (event.currentTarget as HTMLDetailsElement).open;
}

function closeCategoryMenuOnOutsideClick(event: PointerEvent): void {
  const target = event.target;
  if (
    categoryMenuOpen.value &&
    target instanceof Node &&
    !categoryControl.value?.contains(target)
  ) {
    categoryMenuOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener("pointerdown", closeCategoryMenuOnOutsideClick);
});

onBeforeUnmount(() => {
  document.removeEventListener("pointerdown", closeCategoryMenuOnOutsideClick);
});
</script>

<template>
  <form
    class="search-panel"
    role="search"
    action="."
    method="get"
    @submit.prevent
  >
    <div class="search-control">
      <label class="visually-hidden" :for="FORM_IDS.query">
        店名・住所・業種
      </label>
      <div class="search-box">
        <span aria-hidden="true">⌕</span>
        <input
          :id="FORM_IDS.query"
          v-model="query"
          name="q"
          type="search"
          placeholder="店名・住所・業種で検索"
          autocomplete="off"
          enterkeyhint="search"
          @input="resetPagination"
        />
      </div>
    </div>

    <fieldset class="region-fieldset">
      <legend :id="FORM_IDS.regionLegend" class="visually-hidden">地域</legend>
      <div class="region-options">
        <label>
          <input
            v-model="region"
            type="radio"
            name="region"
            value=""
            @change="resetPagination"
          />
          <span>全道</span>
        </label>
        <label v-for="value in REGIONS" :key="value">
          <input
            v-model="region"
            type="radio"
            name="region"
            :value="value"
            @change="resetPagination"
          />
          <span>{{ value }}</span>
        </label>
      </div>
    </fieldset>

    <details
      ref="categoryControl"
      class="category-control"
      :open="categoryMenuOpen"
      @toggle="syncCategoryMenu"
    >
      <summary :id="FORM_IDS.category">
        <span class="category-control__summary">
          {{ selectedCategorySummary }}
        </span>
      </summary>
      <fieldset class="category-menu" :aria-labelledby="FORM_IDS.category">
        <legend class="visually-hidden">業種を選択</legend>
        <div class="category-menu__header">
          <strong>業種を選択</strong>
          <button
            type="button"
            :disabled="selectedCategories.length === 0"
            @click="clearCategories"
          >
            すべて解除
          </button>
        </div>
        <div
          v-if="selectedCategories.length > 0"
          class="category-menu__selected"
          aria-label="選択中の業種"
        >
          <span
            v-for="value in selectedCategories"
            :key="value"
            :style="{ '--category-color': categoryColor(value) }"
          >
            {{ value }}
          </span>
        </div>
        <div class="category-menu__options">
          <label
            v-for="value in categories"
            :key="value"
            :style="{ '--category-color': categoryColor(value) }"
          >
            <input
              v-model="selectedCategories"
              type="checkbox"
              name="category"
              :value="value"
              @change="resetPagination"
            />
            <span class="category-menu__label">{{ value }}</span>
          </label>
        </div>
      </fieldset>
    </details>

  </form>
</template>
