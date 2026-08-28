<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { AiProfileView } from '@shared/ipc'
import { settingsUI } from './useFileActions'

/** 编辑界面顶栏的 AI 模型切换器：点开列出模型，点选即设为常用；含管理入口 */
const open = ref(false)
const rootEl = ref<HTMLElement | null>(null)
const profiles = ref<AiProfileView[]>([])
const activeId = ref('')

const activeName = ref('')

async function load(): Promise<void> {
  const c = await window.myresume.ai.getConfig()
  profiles.value = c.profiles
  activeId.value = c.activeId
  activeName.value = c.profiles.find((p) => p.id === c.activeId)?.name ?? ''
}

async function toggle(): Promise<void> {
  open.value = !open.value
  if (open.value) await load()
}

async function choose(p: AiProfileView): Promise<void> {
  await window.myresume.ai.setActive(p.id)
  await load()
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
  <div ref="rootEl" class="ai-model">
    <button class="ai-btn" :title="activeName ? `当前模型：${activeName}（点击切换）` : '选择 AI 解析用的模型'" @click="toggle">
      <span class="ai-dot"></span>
      {{ activeName || 'AI 模型' }}
      <span class="caret">▾</span>
    </button>

    <transition name="drop">
      <div v-if="open" class="ai-menu">
        <div v-if="profiles.length === 0" class="empty">还没有添加模型</div>
        <button v-for="p in profiles" :key="p.id" class="ai-item" @click="choose(p)">
          <span class="check">{{ p.id === activeId ? '✓' : '' }}</span>
          <span class="p-name">
            {{ p.name }}
            <span v-if="!p.hasKey" class="warn">未填 Key</span>
          </span>
        </button>
        <div class="divider"></div>
        <button class="ai-item manage" @click="((open = false), (settingsUI.open = true))">模型管理…</button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.ai-model {
  position: relative;
}

.ai-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 10px;
  border: 1px solid #d9d9e6;
  border-radius: 6px;
  font-size: 12px;
  color: #3c3c50;
  background: #fff;
  max-width: 180px;
}

.ai-btn:hover {
  border-color: #667eea;
  color: #667eea;
}

.ai-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: linear-gradient(135deg, #667eea, #764ba2);
  flex-shrink: 0;
}

.caret {
  font-size: 9px;
  color: #b3b3c4;
}

.ai-menu {
  position: absolute;
  top: calc(100% + 6px);
  right: 0;
  width: 230px;
  background: #fff;
  border: 1px solid #e6e6ef;
  border-radius: 10px;
  box-shadow: 0 10px 32px rgba(30, 34, 60, 0.16);
  padding: 6px;
  z-index: 70;
}

.empty {
  padding: 12px;
  text-align: center;
  font-size: 12px;
  color: #b3b3c4;
}

.ai-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  border: none;
  background: transparent;
  padding: 7px 10px;
  border-radius: 7px;
  font-size: 13px;
  color: #24242e;
  text-align: left;
}

.ai-item:hover {
  background: #f2f3fb;
}

.check {
  width: 14px;
  color: #667eea;
  flex-shrink: 0;
}

.p-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.warn {
  margin-left: 6px;
  font-size: 10px;
  color: #e6a23c;
}

.divider {
  height: 1px;
  background: #f0f0f6;
  margin: 4px 6px;
}

.manage {
  color: #667eea;
  font-size: 12px;
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
