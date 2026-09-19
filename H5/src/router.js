import { shallowRef, computed } from 'vue'
import Assessment from './pages/Assessment.vue'
import Result from './pages/Result.vue'

// 极简 hash 路由：静态托管（COS / Nginx 目录）无需任何 rewrite 配置
const routes = {
  '/': Assessment,
  '/result': Result
}

function normalize(hash) {
  const path = String(hash || '').replace(/^#/, '') || '/'
  return routes[path] ? path : '/'
}

const currentPath = shallowRef(normalize(window.location.hash))

window.addEventListener('hashchange', () => {
  currentPath.value = normalize(window.location.hash)
})

export function navigate(path) {
  window.location.hash = path
}

export function useRoute() {
  return {
    path: computed(() => currentPath.value),
    view: computed(() => routes[currentPath.value])
  }
}
