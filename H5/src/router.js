import { shallowRef, computed } from 'vue'
import Assessment from './pages/Assessment.vue'
import Result from './pages/Result.vue'
import { hasAutoEntered, loadResult, markAutoEntered } from './services/store.js'

// 极简 hash 路由：静态托管（COS / Nginx 目录）无需任何 rewrite 配置
const routes = {
  '/': Assessment,
  '/result': Result
}

function normalize(hash) {
  const path = String(hash || '').replace(/^#/, '') || '/'
  return routes[path] ? path : '/'
}

/**
 * 初始路由：本机有上次测评结果时，直接停在结果页。
 *
 * 老板要的是「测完一次，下次进来看到的就是上次的结果」，而不是又回到选年级的首页。
 * 三个约束：
 *   1) 只在默认路径（无 hash 或 #/）时跳，用户明确打开别的地址一律尊重；
 *   2) 每个会话只自动跳一次 —— 否则从结果页点「再测一次」回到首页后又被推回来，像卡死；
 *   3) 用 location.replace 而不是给 hash 赋值，地址栏与内容一致，返回键不会退回空首页。
 */
function initialPath() {
  const raw = String(window.location.hash || '').replace(/^#/, '')
  const path = raw || '/'
  if (path !== '/' || !routes[path]) return path
  if (hasAutoEntered() || !loadResult()) return '/'

  markAutoEntered(true)
  window.location.replace(`${window.location.pathname}${window.location.search}#/result`)
  return '/result'
}

const currentPath = shallowRef(initialPath())

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
