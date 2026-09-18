<template>
  <div class="app">
    <header class="app-header">
      <span class="app-title">英语听说测评</span>
      <span class="app-tag">体验版</span>
      <button class="app-nav" @click="go('#/readaloud')">智聆真评</button>
    </header>

    <div v-if="!isSecure" class="banner banner-warn">
      当前不是安全上下文（非 HTTPS / 非 localhost），浏览器会禁用麦克风。请用 https 域名访问。
    </div>

    <main class="app-main">
      <component :is="view" />
    </main>
  </div>
</template>

<script setup>
import { useRoute } from './router.js'

const { view } = useRoute()
const isSecure = window.isSecureContext === true

function go(hash) {
  window.location.hash = hash.replace(/^#/, '')
}
</script>
