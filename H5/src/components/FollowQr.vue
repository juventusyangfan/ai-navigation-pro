<template>
  <section class="card follow-card">
    <h3 class="card-title">{{ title }}</h3>
    <p class="muted small follow-lead">{{ lead }}</p>

    <div class="qr-row">
      <div class="qr-item">
        <img
          v-if="!mpBroken"
          class="qr-img"
          :src="mpSrc"
          alt="「树蕙伴学」服务号二维码"
          @error="mpBroken = true"
        />
        <div v-else class="qr-img qr-fallback">二维码暂缺</div>
        <span class="qr-label">关注「树蕙伴学」</span>
      </div>

      <div class="qr-item">
        <img
          v-if="!workBroken"
          class="qr-img"
          :src="workSrc"
          alt="树蕙老师企业微信二维码"
          @error="workBroken = true"
        />
        <div v-else class="qr-img qr-fallback">二维码暂缺</div>
        <span class="qr-label">加老师企业微信</span>
      </div>
    </div>

    <p class="qr-hint muted small">在微信里长按二维码即可识别；两个码分别用于收取每周练习和一对一咨询。</p>
  </section>
</template>

<script setup>
import { ref } from 'vue'
// 图片走 Vite 资源导入：base 是 './'，构建后仍能拿到正确的带哈希路径
import mpSrc from '../assets/qr/mp.png'
import workSrc from '../assets/qr/work.png'

defineProps({
  title: { type: String, default: '想让孩子练得更准？' },
  lead: {
    type: String,
    default: '「树蕙伴学」每周发一次英语听说的练习方法；孩子哪几个音不准，也可以加老师企业微信单独问。',
  },
})

const mpBroken = ref(false)
const workBroken = ref(false)
</script>
