<script setup lang="ts">
import { categoryColor } from "../category-color";
import type { Store } from "../types";

defineProps<{
  selected: boolean;
  store: Store;
}>();

const emit = defineEmits<{
  clear: [];
  select: [store: Store];
}>();
</script>

<template>
  <article
    class="store-card"
    :class="{ selected }"
    :aria-current="selected ? 'true' : undefined"
  >
    <div class="store-card__primary">
      <span class="region-tag">
        {{ store.region }}
      </span>
      <span
        class="store-card__category"
        :style="{ '--category-color': categoryColor(store.category) }"
        :title="store.category"
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
        :aria-pressed="selected"
        @click="selected ? emit('clear') : emit('select', store)"
      >
        <span v-if="!selected" aria-hidden="true">●</span>
        {{ selected ? "選択解除" : "地図" }}
        <span class="visually-hidden">：{{ store.name }}</span>
      </button>
    </div>
  </article>
</template>
