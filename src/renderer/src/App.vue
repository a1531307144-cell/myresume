<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { TemplateId } from '@shared/schema'
import { useResumeStore } from './stores/resume'
import { TEMPLATES } from './preview/templates'
import EditorPanel from './editor/EditorPanel.vue'
import PreviewPane from './preview/PreviewPane.vue'

const { store } = useResumeStore()
const version = ref('…')

onMounted(async () => {
  version.value = await window.myresume.app.getVersion()
})

const templateOptions = Object.values(TEMPLATES)

function onTemplateChange(e: Event): void {
  const id = (e.target as HTMLSelectElement).value as TemplateId
  if (TEMPLATES[id].available) {
    store.doc.meta.template = id
  }
}
</script>

<template>
  <div class="app-shell">
    <header class="app-topbar">
      <div class="brand">
        <span class="brand-mark">简</span>
        <span class="brand-name">我的简历</span>
        <span class="brand-version">v{{ version }}</span>
      </div>

      <div class="topbar-actions">
        <label class="tpl-label">模板</label>
        <select class="tpl-select" :value="store.doc.meta.template" @change="onTemplateChange">
          <option v-for="t in templateOptions" :key="t.id" :value="t.id" :disabled="!t.available">
            {{ t.name }}{{ t.available ? '' : '（即将上线）' }}
          </option>
        </select>
      </div>
    </header>

    <div class="app-main">
      <aside class="app-editor">
        <EditorPanel />
      </aside>
      <main class="app-preview">
        <PreviewPane />
      </main>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  height: 100vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.app-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  background: #fff;
  border-bottom: 1px solid #ececf3;
  flex-shrink: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-mark {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-size: 15px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-name {
  font-size: 15px;
  font-weight: 600;
  color: #24242e;
}

.brand-version {
  font-size: 11px;
  color: #b3b3c4;
}

.topbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.tpl-label {
  font-size: 12px;
  color: #8b8ba3;
}

.tpl-select {
  padding: 5px 10px;
  border: 1px solid #d9d9e6;
  border-radius: 6px;
  font-size: 13px;
  color: #24242e;
  background: #fff;
  outline: none;
}

.tpl-select:focus {
  border-color: #667eea;
}

.app-main {
  flex: 1;
  display: flex;
  min-height: 0;
}

.app-editor {
  width: 440px;
  flex-shrink: 0;
  border-right: 1px solid #ececf3;
  min-height: 0;
}

.app-preview {
  flex: 1;
  min-width: 0;
  min-height: 0;
}
</style>
