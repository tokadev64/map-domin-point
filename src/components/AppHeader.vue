<script setup lang="ts">
import { GITHUB_REPOSITORY_URL, OFFICIAL_SITE_URL } from "../constants";
</script>

<template>
  <header class="app-header">
    <div class="app-header__brand">
      <div class="brand-mark" aria-hidden="true">ど</div>
      <h1>どうみんポイント取扱店舗 <em>非公式マップ</em></h1>
    </div>
    <div class="app-header__notice">
      <a
        :href="OFFICIAL_SITE_URL"
        class="official-site-link"
        target="_blank"
        rel="noopener noreferrer"
        aria-describedby="official-site-description"
      >
        公式サイト
        <span aria-hidden="true">↗</span>
      </a>
      <span
        id="official-site-description"
        class="official-site-tooltip"
        role="tooltip"
      >
        道民（どうみん）生活応援ポイント給付 ページを開きます。
      </span>
      <a
        :href="GITHUB_REPOSITORY_URL"
        class="github-repository-link"
        target="_blank"
        rel="noopener noreferrer"
        aria-label="GitHubリポジトリを開く"
        title="GitHubリポジトリを開く"
      >
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 2C6.48 2 2 6.58 2 12.23c0 4.52 2.87 8.35 6.84 9.71.5.1.68-.22.68-.49v-1.91c-2.78.62-3.37-1.2-3.37-1.2-.45-1.19-1.11-1.5-1.11-1.5-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.86.09-.66.35-1.12.64-1.37-2.22-.26-4.56-1.14-4.56-5.06 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.34 9.34 0 0 1 12 6.96a9.3 9.3 0 0 1 2.5.34c1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.93-2.34 4.8-4.57 5.05.36.32.68.94.68 1.9v2.79c0 .27.18.59.69.49A10.23 10.23 0 0 0 22 12.23C22 6.58 17.52 2 12 2Z"
          />
        </svg>
      </a>
    </div>
  </header>
</template>
