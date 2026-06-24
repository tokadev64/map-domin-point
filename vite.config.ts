import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite-plus";

export default defineConfig({
  base: Deno.env.get("GITHUB_PAGES") === "true" ? "/map-domin-point/" : "/",
  plugins: [vue()],
  server: {
    host: "0.0.0.0",
    port: 5273,
    strictPort: true,
    watch: {
      ignored: [
        "**/data/geocoding/**",
        "**/public/data/store-points.geojson",
        "**/*.tmp-*",
      ],
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
  lint: {
    ignorePatterns: ["dist/**", "public/data/**"],
  },
  fmt: {
    semi: true,
    singleQuote: false,
  },
});
