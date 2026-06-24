<script setup lang="ts">
import { ref } from "vue";
import { APP_LOCALE } from "../constants";
import { useStoreMapContext } from "../composables/store-map-context";
import MapPanel from "./MapPanel.vue";
import StoreList from "./StoreList.vue";
import StoreSearchForm from "./StoreSearchForm.vue";

const { drawerFilteredStores } = useStoreMapContext();
const storeDrawerOpen = ref(false);
</script>

<template>
  <section class="finder" aria-labelledby="finder-heading">
    <h2 id="finder-heading" class="visually-hidden">店舗を検索</h2>
    <StoreSearchForm />
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
        店舗一覧
        <strong>
          {{ drawerFilteredStores.length.toLocaleString(APP_LOCALE) }}
        </strong>
      </button>
      <aside
        id="store-drawer"
        class="store-drawer"
        :class="{ open: storeDrawerOpen }"
        :aria-hidden="!storeDrawerOpen"
        :inert="!storeDrawerOpen"
      >
        <StoreList />
      </aside>
    </div>
  </section>
</template>
