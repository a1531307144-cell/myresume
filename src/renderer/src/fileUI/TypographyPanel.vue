<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { FONT_OPTIONS, FONT_SIZE_RANGE, LINE_HEIGHT_OPTIONS } from '@shared/fonts'
import { store } from '@renderer/stores/resume'

const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)

function ensureTypography(): void {
  if (!store.doc.meta.typography) store.doc.meta.typography = {}
}

const fontFamily = computed({
  get: () => store.doc.meta.typography?.fontFamily ?? '',
  set: (v: string) => {
    ensureTypography()
    store.doc.meta.typography!.fontFamily = v === '' ? undefined : v
  }
})

const fontSize = computed({
  get: () => store.doc.meta.typography?.fontSize ?? 14,
  set: (v: number) => {
    ensureTypography()
    store.doc.meta.typography!.fontSize = v
  }
})

const lineHeight = computed({
  get: () => store.doc.meta.typography?.lineHeight ?? 1.75,
  set: (v: number) => {
    ensureTypography()
    store.doc.meta.typography!.lineHeight = v
  }
})

function adjustSize(delta: number): void {
  const next = fontSize.value + delta
  if (next >= FONT_SIZE_RANGE.min && next <= FONT_SIZE_RANGE.max) fontSize.value = next
}

function reset(): void {
  store.doc.meta.typography = undefined
}

function onDocClick(e: MouseEvent): void {
  if (open.value && rootEl.value && !rootEl.value.contains(e.target as Node)) {
    open.value = false
  }
}

onMounted(() => document.addEventListener('click', onDocClick))
onBeforeUnmount(() => document.removeEventListener('click', onDocClick))
</script>

<template>
  <div ref="rootEl" class="typo">
    <button class="typo-btn" :class="{ active: open }" @click="open = !open">排版 Aa</button>

    <transition name="drop">
      <div v-if="open" class="typo-panel">
        <div class="typo-row">
          <span class="typo-label">字体</span>
          <select v-model="fontFamily" class="typo-select">
            <option value="">跟随模板（宋体）</option>
            <option v-for="f in FONT_OPTIONS" :key="f.id" :value="f.id">{{ f.name }}</option>
          </select>
        </div>

        <div class="typo-row">
          <span class="typo-label">正文字号</span>
          <div class="size-ctrl">
            <button class="size-btn" :disabled="fontSize <= FONT_SIZE_RANGE.min" @click="adjustSize(-1)">−</button>
            <span class="size-value">{{ fontSize }}px</span>
            <button class="size-btn" :disabled="fontSize >= FONT_SIZE_RANGE.max" @click="adjustSize(1)">＋</button>
          </div>
        </div>

        <div class="typo-row">
          <span class="typo-label">行距</span>
          <div class="lh-ctrl">
            <button
              v-for="o in LINE_HEIGHT_OPTIONS"
              :key="o.value"
              class="lh-btn"
              :class="{ on: Math.abs(lineHeight - o.value) < 0.01 }"
              @click="lineHeight = o.value"
            >
              {{ o.label }}
            </button>
          </div>
        </div>

        <div class="typo-footer">
          <span class="typo-tip">设置保存在简历文件里，预览与导出 PDF 同步生效</span>
          <button class="reset-btn" @click="reset">恢复默认</button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.typo {
  position: relative;
}

.typo-btn {
  padding: 5px 10px;
  border: 1px solid #d9d9e6;
  border-radius: 6px;
  font-size: 13px;
  color: #24242e;
  background: #fff;
}

.typo-btn:hover,
.typo-btn.active {
  border-color: #667eea;
  color: #667eea;
}

.typo-panel {
  position: absolute;
  top: calc(100% + 8px);
  right: 0;
  width: 320px;
  background: #fff;
  border: 1px solid #e6e6ef;
  border-radius: 10px;
  box-shadow: 0 10px 32px rgba(30, 34, 60, 0.16);
  padding: 14px;
  z-index: 60;
}

.typo-row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.typo-row:last-of-type {
  margin-bottom: 0;
}

.typo-label {
  flex: 0 0 62px;
  font-size: 12px;
  color: #7c7c92;
}

.typo-select {
  flex: 1;
  padding: 6px 8px;
  border: 1px solid #d9d9e6;
  border-radius: 6px;
  font-size: 13px;
  background: #fff;
  outline: none;
}

.typo-select:focus {
  border-color: #667eea;
}

.size-ctrl {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
}

.size-btn {
  width: 26px;
  height: 26px;
  border: 1px solid #d9d9e6;
  border-radius: 6px;
  background: #fff;
  font-size: 15px;
  color: #5c5c74;
}

.size-btn:hover:not(:disabled) {
  border-color: #667eea;
  color: #667eea;
}

.size-btn:disabled {
  opacity: 0.4;
  cursor: default;
}

.size-value {
  font-size: 13px;
  color: #24242e;
  min-width: 44px;
  text-align: center;
}

.lh-ctrl {
  flex: 1;
  display: flex;
  gap: 6px;
}

.lh-btn {
  flex: 1;
  padding: 5px 0;
  border: 1px solid #d9d9e6;
  border-radius: 6px;
  background: #fff;
  font-size: 12px;
  color: #5c5c74;
}

.lh-btn.on {
  border-color: #667eea;
  color: #667eea;
  background: #f2f3fb;
}

.typo-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px solid #f0f0f6;
}

.typo-tip {
  font-size: 11px;
  color: #b3b3c4;
}

.reset-btn {
  border: none;
  background: transparent;
  font-size: 12px;
  color: #8b8ba3;
}

.reset-btn:hover {
  color: #d9534f;
}

.drop-enter-active,
.drop-leave-active {
  transition: all 0.12s ease;
}

.drop-enter-from,
.drop-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
