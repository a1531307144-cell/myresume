<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import type { TemplateId } from '@shared/schema'
import { store } from './stores/resume'
import { isHomeTab } from './stores/tabs'
import { TEMPLATES } from './preview/templates'
import EditorPanel from './editor/EditorPanel.vue'
import PreviewPane from './preview/PreviewPane.vue'
import ConfirmModal from './fileUI/ConfirmModal.vue'
import DraftNotice from './fileUI/DraftNotice.vue'
import SaveStatus from './fileUI/SaveStatus.vue'
import StartPage from './fileUI/StartPage.vue'
import TabBar from './fileUI/TabBar.vue'
import TypographyPanel from './fileUI/TypographyPanel.vue'
import AiModelButton from './fileUI/AiModelButton.vue'
import ImportDialog from './fileUI/ImportDialog.vue'
import SettingsDialog from './fileUI/SettingsDialog.vue'
import UpdateToast from './updaterUI/UpdateToast.vue'
import AiAssistantDialog from './ai/AiAssistantDialog.vue'
import AiDiagnoseDialog from './ai/AiDiagnoseDialog.vue'
import { openDiagnose } from './ai/useAiAssistant'
import {
  exportPdfAction,
  exporting,
  handleMenuAction,
  importDocAction,
  importUI,
  initFileUI,
  modalApi,
  newDocAction,
  openDocAction,
  saveDoc,
  settingsUI,
  toast
} from './fileUI/useFileActions'

const version = ref('…')

// ———— 全窗口拖放导入 ————
const dragDepth = ref(0)

function onDragOver(e: DragEvent): void {
  e.preventDefault()
  if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy'
}

function onDragEnter(): void {
  dragDepth.value += 1
}

function onDragLeave(): void {
  dragDepth.value = Math.max(0, dragDepth.value - 1)
}

function onDrop(e: DragEvent): void {
  e.preventDefault()
  dragDepth.value = 0
  const file = e.dataTransfer?.files?.[0]
  if (!file) return
  void (async () => {
    try {
      const path = window.myresume.file.getPathForFile(file)
      const picked = await window.myresume.dialog.readDropped(path)
      await importDocAction(picked)
    } catch (err) {
      modalApi.showToast(err instanceof Error ? err.message : '无法导入该文件')
    }
  })()
}

onMounted(() => {
  window.addEventListener('dragover', onDragOver)
  window.addEventListener('dragenter', onDragEnter)
  window.addEventListener('dragleave', onDragLeave)
  window.addEventListener('drop', onDrop)
})

onBeforeUnmount(() => {
  window.removeEventListener('dragover', onDragOver)
  window.removeEventListener('dragenter', onDragEnter)
  window.removeEventListener('dragleave', onDragLeave)
  window.removeEventListener('drop', onDrop)
})

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
  <div class="app-shell">
    <header class="app-topbar">
      <div class="brand">
        <span class="brand-mark">简</span>
        <span class="brand-name">我的简历</span>
      </div>

      <div class="file-btns">
        <button class="tb-btn" @click="newDocAction()">新建</button>
        <button class="tb-btn" @click="openDocAction()">打开</button>
        <button class="tb-btn" @click="importDocAction()">导入</button>
        <template v-if="!isHomeTab">
          <button class="tb-btn" :class="{ disabled: !store.dirty }" @click="saveDoc()">保存</button>
          <button class="tb-btn" @click="saveDoc(true)">另存为</button>
        </template>
      </div>

      <div class="topbar-right">
        <AiModelButton />

        <template v-if="!isHomeTab">
          <label class="tpl-label">模板</label>
          <select class="tpl-select" :value="store.doc.meta.template" @change="onTemplateChange">
            <option v-for="t in templateOptions" :key="t.id" :value="t.id" :disabled="!t.available">
              {{ t.name }}{{ t.available ? '' : '（即将上线）' }}
            </option>
          </select>

          <TypographyPanel />

          <button class="tb-btn ai" title="让 AI 通读整份简历、列出具体问题" @click="openDiagnose()">
            AI 诊断
          </button>

          <button class="tb-btn export" :disabled="exporting.busy" @click="exportPdfAction()">
            {{ exporting.busy ? '导出中…' : '导出 PDF' }}
          </button>

          <SaveStatus />
        </template>
      </div>
    </header>

    <TabBar />

    <div class="app-main">
      <StartPage v-if="isHomeTab" />
      <template v-else>
        <aside class="app-editor">
          <EditorPanel />
        </aside>
        <main class="app-preview">
          <PreviewPane />
        </main>
      </template>
    </div>
  </div>

  <!-- 弹窗与提示条全局可用 -->
  <ConfirmModal />
  <DraftNotice />
  <ImportDialog v-if="importUI.open" />
  <SettingsDialog v-if="settingsUI.open" @close="settingsUI.open = false" />
  <AiAssistantDialog />
  <AiDiagnoseDialog />
  <UpdateToast />

  <!-- 全窗口拖放导入提示 -->
  <div v-if="dragDepth > 0" class="drop-overlay">
    <div class="drop-box">松开鼠标，导入简历文件（Word / PDF / TXT）</div>
  </div>

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

.tb-btn.ai {
  border-color: #c9cdf5;
  background: #f4f5ff;
  color: #5a63d8;
}

.tb-btn.ai:hover {
  border-color: #667eea;
  background: #667eea;
  color: #fff;
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

.drop-overlay {
  position: fixed;
  inset: 0;
  background: rgba(102, 126, 234, 0.14);
  backdrop-filter: blur(1px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 130;
  pointer-events: none;
}

.drop-box {
  padding: 26px 44px;
  border: 2.5px dashed #667eea;
  border-radius: 16px;
  background: rgba(255, 255, 255, 0.94);
  font-size: 16px;
  font-weight: 600;
  color: #5a63d8;
  box-shadow: 0 18px 50px rgba(60, 70, 140, 0.24);
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
