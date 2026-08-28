<script setup lang="ts">
import { nextTick, onMounted, ref } from 'vue'
import type { ResumeDocument } from '@shared/schema'
import { createDefaultDocument } from '@shared/defaults'
import { TEMPLATES } from '../preview/templates'

const doc = ref<ResumeDocument>(createDefaultDocument())

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
  <component :is="TEMPLATES[doc.meta.template].page" :doc="doc" />
</template>
