import { inject, type InjectionKey, provide } from "vue";
import { createStoreMapState, type StoreMapState } from "./store-map-state";

const STORE_MAP_CONTEXT_KEY: InjectionKey<StoreMapState> = Symbol(
  "store-map-context",
);

export function provideStoreMapContext(): StoreMapState {
  const state = createStoreMapState();
  provide(STORE_MAP_CONTEXT_KEY, state);
  return state;
}

export function useStoreMapContext(): StoreMapState {
  const state = inject(STORE_MAP_CONTEXT_KEY);
  if (!state) {
    throw new Error("StoreMapContext provider is missing");
  }
  return state;
}
