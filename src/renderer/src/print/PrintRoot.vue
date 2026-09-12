<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue'
import type { ResumeDocument } from '@shared/schema'
import { createDefaultDocument } from '@shared/defaults'
import { getTemplate } from '../preview/templates'

const doc = ref<ResumeDocument>(createDefaultDocument())
/** 带兜底取模板，避免失效的模板 id 让打印窗口白屏（会导致导出卡到超时） */
const template = computed(() => getTemplate(doc.value.meta.template))

onMounted(() => {
  window.myresume.print.onDoc(async (payload) => {
    doc.value = payload.doc
    await nextTick()
    await waitForAssets()
    await window.myresume.print.ready()
  })
})

/** 等字体与图片就绪后再回执——避免 printToPDF 抓到未加载完成的状态 */
async function waitForAssets(): Promise<void> {
  try {
    await document.fonts.ready
  } catch {
    /* 忽略字体 API 异常 */
  }
  const images = Array.from(document.images)
  await Promise.all(
    images.map((img) =>
      img.complete
        ? Promise.resolve(null)
        : new Promise((resolve) => {
            img.onload = () => resolve(null)
            img.onerror = () => resolve(null)
          })
    )
  )
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
  await new Promise((resolve) => requestAnimationFrame(() => resolve(null)))
}
</script>

<template>
  <component :is="template.page" :doc="doc" />
</template>
