<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { SECTION_PRESETS } from '@shared/sectionPresets'
import type { SectionPreset } from '@shared/sectionPresets'

const emit = defineEmits<{ select: [preset: SectionPreset] }>()
const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)

function toggle(): void {
  open.value = !open.value
}

function pick(preset: SectionPreset): void {
  emit('select', preset)
  open.value = false
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
  <div ref="rootEl" class="picker">
    <button class="picker-btn" @click="toggle">＋ 添加板块</button>
    <transition name="pop">
      <div v-if="open" class="picker-menu">
        <button v-for="p in SECTION_PRESETS" :key="p.defaultTitle" class="picker-item" @click="pick(p)">
          <span class="picker-name">{{ p.defaultTitle }}</span>
          <span class="picker-hint">{{ p.hint }}</span>
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.picker {
  position: relative;
}

.picker-btn {
  width: 100%;
  padding: 9px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
}

.picker-btn:hover {
  opacity: 0.92;
}

.picker-menu {
  position: absolute;
  bottom: calc(100% + 8px);
  left: 0;
  right: 0;
  background: #fff;
  border: 1px solid #e6e6ef;
  border-radius: 10px;
  box-shadow: 0 8px 28px rgba(30, 34, 60, 0.14);
  padding: 6px;
  z-index: 20;
  max-height: 320px;
  overflow-y: auto;
}

.picker-item {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  border: none;
  background: transparent;
  padding: 8px 10px;
  border-radius: 7px;
  text-align: left;
}

.picker-item:hover {
  background: #f2f3fb;
}

.picker-name {
  font-size: 13px;
  font-weight: 600;
  color: #24242e;
}

.picker-hint {
  font-size: 11px;
  color: #9a9aae;
}

.pop-enter-active,
.pop-leave-active {
  transition: all 0.12s ease;
}

.pop-enter-from,
.pop-leave-to {
  opacity: 0;
  transform: translateY(6px);
}
</style>
