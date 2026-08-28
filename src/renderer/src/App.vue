<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { TemplateId } from '@shared/schema'
import { store } from './stores/resume'
import { TEMPLATES } from './preview/templates'
import EditorPanel from './editor/EditorPanel.vue'
import PreviewPane from './preview/PreviewPane.vue'
import ConfirmModal from './fileUI/ConfirmModal.vue'
import SaveStatus from './fileUI/SaveStatus.vue'
import StartPage from './fileUI/StartPage.vue'
import TypographyPanel from './fileUI/TypographyPanel.vue'
import UpdateToast from './updaterUI/UpdateToast.vue'
import {
  exportPdfAction,
  exporting,
  handleMenuAction,
  initFileUI,
  newDocAction,
  openDocAction,
  saveDoc,
  startView,
  toast
} from './fileUI/useFileActions'

const version = ref('…')

onMounted(async () => {
  version.value = await window.myresume.app.getVersion()
  window.myresume.menu.onAction(handleMenuAction)
  void initFileUI()
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
  <StartPage v-if="startView.visible" />

  <div v-else class="app-shell">
    <header class="app-topbar">
      <div class="brand">
        <span class="brand-mark">简</span>
        <span class="brand-name">我的简历</span>
      </div>

      <div class="file-btns">
        <button class="tb-btn" @click="newDocAction()">新建</button>
        <button class="tb-btn" @click="openDocAction()">打开</button>
        <button class="tb-btn" :class="{ disabled: !store.dirty }" @click="saveDoc()">保存</button>
        <button class="tb-btn" @click="saveDoc(true)">另存为</button>
      </div>

      <div class="topbar-right">
        <label class="tpl-label">模板</label>
        <select class="tpl-select" :value="store.doc.meta.template" @change="onTemplateChange">
          <option v-for="t in templateOptions" :key="t.id" :value="t.id" :disabled="!t.available">
            {{ t.name }}{{ t.available ? '' : '（即将上线）' }}
          </option>
        </select>

        <TypographyPanel />

        <button class="tb-btn export" :disabled="exporting.busy" @click="exportPdfAction()">
          {{ exporting.busy ? '导出中…' : '导出 PDF' }}
        </button>

        <SaveStatus />
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

  <!-- 弹窗与提示条全局可用（含起始页） -->
  <ConfirmModal />
  <UpdateToast />

  <transition name="toast">
    <div v-if="toast.visible" class="toast">{{ toast.text }}</div>
  </transition>
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
  gap: 18px;
  padding: 9px 16px;
  background: #fff;
  border-bottom: 1px solid #ececf3;
  flex-shrink: 0;
}

.brand {
  display: flex;
  align-items: center;
  gap: 9px;
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

.file-btns {
  display: flex;
  gap: 6px;
}

.tb-btn {
  padding: 6px 13px;
  border: 1px solid #dcdce8;
  background: #fff;
  border-radius: 7px;
  font-size: 13px;
  color: #3c3c50;
}

.tb-btn:hover {
  border-color: #667eea;
  color: #667eea;
}

.tb-btn.disabled {
  opacity: 0.55;
}

.tb-btn.export {
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
  color: #fff;
  font-weight: 500;
  padding: 6px 16px;
}

.tb-btn.export:hover {
  opacity: 0.92;
  color: #fff;
}

.tb-btn.export:disabled {
  opacity: 0.6;
  cursor: default;
}

.topbar-right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 9px;
}

.tpl-label {
  font-size: 12px;
  color: #8b8ba3;
}

.tpl-select {
  padding: 5px 9px;
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

.toast {
  position: fixed;
  bottom: 26px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(30, 32, 48, 0.88);
  color: #fff;
  font-size: 13px;
  padding: 9px 18px;
  border-radius: 8px;
  z-index: 120;
  max-width: calc(100vw - 60px);
  word-break: break-all;
}

.toast-enter-active,
.toast-leave-active {
  transition: all 0.2s ease;
}

.toast-enter-from,
.toast-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(8px);
}
</style>
