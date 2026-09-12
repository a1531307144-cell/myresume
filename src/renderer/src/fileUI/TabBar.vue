<script setup lang="ts">
import { nextTick, ref, watch } from 'vue'
import { activeTab, activeTabId, activateTab, tabLabel, tabs } from '@renderer/stores/tabs'
import { closeTabAction, newDocAction } from './useFileActions'

/** 标签条：一个窗口内承载多份简历。首页标签常驻且不可关闭。 */

const listEl = ref<HTMLElement | null>(null)

// 切标签后把它滚进可视区（标签多到放不下时）
watch(activeTabId, async () => {
  await nextTick()
  const el = listEl.value?.querySelector<HTMLElement>('.tab.active')
  el?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
})

function onClose(id: string): void {
  void closeTabAction(id)
}
</script>

<template>
  <div class="tab-bar">
    <div ref="listEl" class="tab-list">
      <div
        v-for="t in tabs"
        :key="t.id"
        class="tab"
        :class="{ active: t.id === activeTabId, home: t.kind === 'home' }"
        :title="t.kind === 'home' ? '起始页' : (t.filePath ?? '尚未保存为文件（内容已自动暂存为草稿）')"
        @click="activateTab(t.id)"
      >
        <span v-if="t.dirty" class="tab-dot" title="有未保存的修改"></span>
        <span class="tab-name">{{ tabLabel(t) }}</span>
        <button
          v-if="t.kind === 'doc'"
          class="tab-close"
          title="关闭标签（Ctrl+W）"
          @click.stop="onClose(t.id)"
        >
          ✕
        </button>
      </div>
    </div>

    <button class="tab-add" title="新建简历（Ctrl+N）" @click="newDocAction()">＋</button>
    <span v-if="activeTab.kind === 'doc' && activeTab.filePath" class="tab-path">{{ activeTab.filePath }}</span>
  </div>
</template>

<style scoped>
.tab-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 0 10px;
  background: #f2f2f7;
  border-bottom: 1px solid #e4e4ee;
  flex-shrink: 0;
  height: 36px;
}

.tab-list {
  display: flex;
  align-items: center;
  gap: 4px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  min-width: 0;
}

.tab-list::-webkit-scrollbar {
  display: none;
}

.tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 5px 8px 5px 12px;
  border-radius: 8px 8px 0 0;
  font-size: 12.5px;
  color: #5a5a72;
  background: transparent;
  cursor: default;
  white-space: nowrap;
  max-width: 190px;
  flex-shrink: 0;
  user-select: none;
}

.tab:hover {
  background: #e9e9f2;
}

.tab.active {
  background: #fff;
  color: #24242e;
  font-weight: 600;
  box-shadow: inset 0 -2px 0 #667eea;
}

.tab-name {
  overflow: hidden;
  text-overflow: ellipsis;
}

.tab-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #9094d6;
  flex-shrink: 0;
}

.tab-close {
  border: none;
  background: transparent;
  color: #a8a8bd;
  font-size: 11px;
  line-height: 1;
  padding: 2px 3px;
  border-radius: 4px;
  flex-shrink: 0;
}

.tab-close:hover {
  background: #dcdcea;
  color: #4a4a60;
}

.tab-add {
  border: 1px solid #dcdce8;
  background: #fff;
  color: #5a5a72;
  border-radius: 7px;
  width: 24px;
  height: 24px;
  font-size: 13px;
  line-height: 1;
  flex-shrink: 0;
}

.tab-add:hover {
  border-color: #667eea;
  color: #667eea;
}

.tab-path {
  margin-left: auto;
  font-size: 11px;
  color: #b0b0c2;
  max-width: 40%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  direction: rtl;
}
</style>
