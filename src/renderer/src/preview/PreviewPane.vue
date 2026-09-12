<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useResumeStore } from '@renderer/stores/resume'
import { getTemplate } from './templates'
import EmptyPreview from './EmptyPreview.vue'

const { store, isDocumentEmpty } = useResumeStore()
// getTemplate 带兜底：文档里的模板 id 失效时退回法学正式风，而不是整页崩掉
const tpl = computed(() => getTemplate(store.doc.meta.template))

const wrapEl = ref<HTMLElement | null>(null)
const zoom = ref(0.7)
let ro: ResizeObserver | null = null

/** 210mm ≈ 793.7 CSS px */
const A4_WIDTH_PX = 793.7

function updateZoom(): void {
  const w = wrapEl.value?.clientWidth ?? 0
  const available = w - 56
  zoom.value = Math.min(1, Math.max(0.3, Number((available / A4_WIDTH_PX).toFixed(3))))
}

onMounted(() => {
  updateZoom()
  ro = new ResizeObserver(updateZoom)
  if (wrapEl.value) ro.observe(wrapEl.value)
})

onBeforeUnmount(() => ro?.disconnect())
</script>

<template>
  <div class="preview-pane">
    <div class="preview-toolbar">
      <span class="toolbar-label">实时预览</span>
      <span class="toolbar-meta">A4 · {{ tpl.name }} · {{ Math.round(zoom * 100) }}%</span>
    </div>
    <div ref="wrapEl" class="preview-scroll">
      <div v-if="!isDocumentEmpty" class="paper-wrap" :style="{ zoom: zoom }">
        <component :is="tpl.page" :doc="store.doc" />
      </div>
      <EmptyPreview v-else />
    </div>
  </div>
</template>

<style scoped>
.preview-pane {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #eef0f6;
}

.preview-toolbar {
  display: flex;
  justify-content: space-between;
  padding: 8px 16px;
  background: #fff;
  border-bottom: 1px solid #ececf3;
  font-size: 12px;
  color: #7c7c92;
}

.preview-scroll {
  flex: 1;
  overflow: auto;
  padding: 24px 0 32px;
}

.paper-wrap {
  width: fit-content;
  margin: 0 auto;
}

.paper-wrap :deep(.resume-page) {
  box-shadow: 0 2px 16px rgba(30, 34, 60, 0.16);
}
</style>
