<template>
  <div v-if="code" class="devcode">
    <span class="devcode-label">本机识别码</span>
    <span class="devcode-code">{{ code }}</span>
    <button class="devcode-copy" type="button" @click="copy">
      {{ state === 'ok' ? '已复制' : state === 'fail' ? '请长按识别码复制' : '复制' }}
    </button>
  </div>
</template>

<script setup>
import { onUnmounted, ref } from 'vue'

// 家长机识别码：家长念给老师，老师在后台按码调额度。
//
// 码本身不是凭据——别人知道某个码也拿不到任何东西（服务端不暴露 code→设备 的映射，
// 且所有操作都在内网接口上）。它只是「给人看、给人念」的标签。
const props = defineProps({
  code: { type: String, default: '' }
})

const state = ref('idle') // idle | ok | fail
let timer = null

/**
 * 老办法：隐藏 textarea + execCommand。
 *
 * 必须在**用户手势的同步栈内**执行 —— iOS Safari 与微信 X5 里，
 * 一旦先 await 过别的异步操作（哪怕只是访问一下 clipboard），手势上下文就丢了，
 * execCommand 必然返回 false。这正是「点了显示已复制、粘贴却是空的」的根因：
 * 旧代码先 await navigator.clipboard.writeText，失败后才在微任务里调 execCommand，
 * 而且没检查返回值，把失败当成功了。
 */
function legacyCopy(text) {
  const el = document.createElement('textarea')
  el.value = text
  // readonly 防止 iOS 弹起键盘把页面顶飞
  el.setAttribute('readonly', '')
  // 不用 display:none（无法 select）也不用 opacity:0（部分 X5 内核不复制透明元素），
  // 压到 1px 放到视口左上角，兼容性最好且不引起滚动
  el.style.cssText =
    'position:fixed;left:0;top:0;width:1px;height:1px;padding:0;border:0;outline:0;' +
    'box-shadow:none;background:transparent;z-index:-1;'
  document.body.appendChild(el)

  const sel = document.getSelection()
  const saved = sel && sel.rangeCount > 0 ? sel.getRangeAt(0) : null

  let ok = false
  try {
    el.focus() // iOS 上不 focus 则 select 无效
    el.select()
    el.setSelectionRange(0, text.length) // iOS 上 select() 偶发不生效，补一刀
    ok = document.execCommand('copy') === true
  } catch (e) {
    ok = false
  }

  document.body.removeChild(el)
  // 还原用户原有的选区，别把人家正在看的位置搞乱
  if (saved && sel) {
    sel.removeAllRanges()
    sel.addRange(saved)
  }
  return ok
}

function selectCodeNode() {
  // 复制彻底失败时的出路：把码本身选中，让家长长按 → 系统菜单「复制」
  try {
    const node = document.querySelector('.devcode-code')
    if (!node) return
    const range = document.createRange()
    range.selectNodeContents(node)
    const sel = document.getSelection()
    sel.removeAllRanges()
    sel.addRange(range)
  } catch (e) {
    /* 选中失败也无所谓，码本身就在屏幕上能看 */
  }
}

async function copy() {
  const text = props.code
  if (!text) return

  // 顺序很关键：先同步 execCommand（手势还在），再退回 Clipboard API。
  // 反过来做就会掉进上面说的手势丢失陷阱。
  let ok = legacyCopy(text)

  if (!ok && navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      ok = true
    } catch (e) {
      ok = false
    }
  }

  state.value = ok ? 'ok' : 'fail'
  if (!ok) selectCodeNode()

  clearTimeout(timer)
  timer = setTimeout(() => (state.value = 'idle'), ok ? 2000 : 4000)
}

onUnmounted(() => clearTimeout(timer))
</script>

<style scoped>
.devcode {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
  font-size: 12px;
  color: var(--muted);
}
.devcode-label {
  opacity: 0.9;
}
.devcode-code {
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 0.5px;
  color: var(--text);
  /* 一键选中整串，长按复制也行（微信里最稳的路径） */
  user-select: all;
  -webkit-user-select: all;
}
.devcode-copy {
  border: none;
  background: none;
  padding: 0 2px;
  color: var(--primary);
  font-size: 12px;
  cursor: pointer;
  text-decoration: underline;
}
</style>
