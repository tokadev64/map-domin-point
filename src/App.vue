<script setup lang="ts">
import AppHeader from "./components/AppHeader.vue";
import StoreFinder from "./components/StoreFinder.vue";
import { provideStoreMapContext } from "./composables/store-map-context";

const { error, locateError, resultAnnouncement } = provideStoreMapContext();
</script>

<template>
  <AppHeader />
  <main id="main-content">
    <StoreFinder />
    <p
      v-if="error || locateError"
      class="notice notice--error"
      role="alert"
    >
      {{ error || locateError }}
    </p>
    <p class="visually-hidden" aria-live="polite" aria-atomic="true">
      {{ resultAnnouncement }}
    </p>
  </main>
</template>
