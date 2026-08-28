<script setup lang="ts">
import { ref } from 'vue'
import { buildDocument, parseResumeText } from '@shared/importer'
import { extractText } from '@renderer/importerClient/extract'
import { store } from '@renderer/stores/resume'
import { importUI, finishImport, modalApi } from './useFileActions'
import SettingsDialog from './SettingsDialog.vue'

type Step = 'choose' | 'extracting' | 'ready' | 'importing'

const step = ref<Step>('choose')
const fileName = ref('')
const charCount = ref(0)
const text = ref('')
const error = ref('')
const showSettings = ref(false)
const aiReady = ref<boolean | null>(null) // null=未检查

async function pick(): Promise<void> {
  error.value = ''
  let picked: { name: string; ext: string; dataBase64: string } | null = null
  try {
    picked = await window.myresume.dialog.pickImportFile()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '读取文件失败'
    return
  }
  if (!picked) return

  fileName.value = picked.name
  step.value = 'extracting'
  try {
    text.value = await extractText(picked.ext, picked.dataBase64)
    charCount.value = text.value.length
    if (!text.value) {
      error.value = '没有提取到文字内容'
      step.value = 'choose'
      return
    }
    step.value = 'ready'
    void checkAi()
  } catch (e) {
    error.value = e instanceof Error ? e.message : '提取文字失败'
    step.value = 'choose'
  }
}

async function checkAi(): Promise<void> {
  try {
    const c = await window.myresume.ai.getConfig()
    aiReady.value = Boolean(c.baseUrl && c.model && c.hasKey)
  } catch {
    aiReady.value = false
  }
}

/** 本地启发式解析（离线） */
function parseLocal(): void {
  step.value = 'importing'
  try {
    const parsed = parseResumeText(text.value, fileName.value)
    void finishImport(buildDocument(parsed, storeTemplate()))
  } catch (e) {
    error.value = e instanceof Error ? e.message : '解析失败'
    step.value = 'ready'
  }
}

/** AI 解析（可选，更准；主进程代理请求） */
async function parseAi(): Promise<void> {
  step.value = 'importing'
  try {
    const r = await window.myresume.ai.parse(text.value)
    if (r.ok && r.parsed) {
      void finishImport(buildDocument(r.parsed, store.doc.meta.template))
    } else {
      error.value = r.error ?? 'AI 解析失败'
      step.value = 'ready'
    }
  } catch {
    error.value = 'AI 解析失败，请稍后重试'
    step.value = 'ready'
  }
}

function close(): void {
  if (step.value === 'extracting' || step.value === 'importing') return // 进行中不允许关
  importUI.open = false
}

function toast(msg: string): void {
  modalApi.showToast(msg)
}
</script>

<template>
  <div class="modal-mask">
    <div class="import-card">
      <h3 class="title">导入已有简历</h3>

      <template v-if="step === 'choose'">
        <p class="desc">支持 <b>Word（.docx）</b>、<b>文字版 PDF</b>、<b>TXT</b>，文件不超过 20MB。<br />
        <span class="hint">图片/扫描版 PDF 暂不支持；解析结果请务必检查修正。</span></p>
        <button class="big-btn" @click="pick">选择文件…</button>
      </template>

      <template v-else-if="step === 'extracting'">
        <p class="desc">正在提取「{{ fileName }}」的文字…</p>
        <div class="spinner"></div>
      </template>

      <template v-else-if="step === 'ready'">
        <p class="desc">
          已从「{{ fileName }}」提取 <b>{{ charCount }}</b> 字。<br />
          <span class="hint">选择解析方式（结果都会进入编辑器，可逐项检查修正）：</span>
        </p>
        <div class="parse-opts">
          <button class="opt" @click="parseLocal">
            <span class="opt-title">本地智能解析</span>
            <span class="opt-sub">离线 · 快速 · 适合格式规整的简历</span>
          </button>
          <button class="opt" :class="{ disabled: aiReady === false }" @click="aiReady ? parseAi() : ((showSettings = true), toast('先完成 AI 配置再使用'))">
            <span class="opt-title">AI 智能解析<span class="badge">推荐</span></span>
            <span class="opt-sub">{{ aiReady === false ? '未配置——点击进行设置（需自备 API Key）' : '更准确 · 需联网 · 内容仅发送到你配置的接口' }}</span>
          </button>
        </div>
        <button class="link-btn" @click="showSettings = true">AI 服务设置…</button>
      </template>

      <template v-else-if="step === 'importing'">
        <p class="desc">正在解析…</p>
        <div class="spinner"></div>
      </template>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="footer">
        <button class="cancel" :disabled="step === 'extracting' || step === 'importing'" @click="close">
          {{ step === 'ready' ? '取消' : '关闭' }}
        </button>
      </div>
    </div>

    <SettingsDialog v-if="showSettings" @close="((showSettings = false), void checkAi())" />
  </div>
</template>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(24, 26, 40, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 110;
}

.import-card {
  width: 460px;
  max-width: calc(100vw - 48px);
  background: #fff;
  border-radius: 14px;
  padding: 22px 24px 18px;
  box-shadow: 0 16px 48px rgba(20, 24, 50, 0.24);
}

.title {
  margin: 0 0 10px;
  font-size: 17px;
  color: #24242e;
}

.desc {
  margin: 0 0 14px;
  font-size: 13px;
  line-height: 1.8;
  color: #3c3c50;
}

.hint {
  font-size: 12px;
  color: #9a9aae;
}

.big-btn {
  width: 100%;
  padding: 12px;
  border: 1.5px dashed #a8aee8;
  border-radius: 10px;
  background: #f6f7fe;
  color: #5a63d8;
  font-size: 14px;
  font-weight: 500;
}

.big-btn:hover {
  background: #eef0fd;
}

.parse-opts {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.opt {
  text-align: left;
  border: 1px solid #e0e0ec;
  border-radius: 10px;
  background: #fff;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.opt:hover {
  border-color: #667eea;
}

.opt.disabled {
  opacity: 0.75;
}

.opt-title {
  font-size: 14px;
  font-weight: 600;
  color: #24242e;
}

.badge {
  margin-left: 8px;
  font-size: 10px;
  font-weight: 500;
  color: #fff;
  background: linear-gradient(135deg, #667eea, #764ba2);
  border-radius: 4px;
  padding: 1px 6px;
  vertical-align: 2px;
}

.opt-sub {
  font-size: 12px;
  color: #9a9aae;
}

.link-btn {
  margin-top: 10px;
  border: none;
  background: transparent;
  font-size: 12px;
  color: #667eea;
}

.error {
  margin: 12px 0 0;
  font-size: 12px;
  color: #d9534f;
  line-height: 1.6;
}

.footer {
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
}

.cancel {
  padding: 6px 14px;
  border: 1px solid #dcdce8;
  border-radius: 7px;
  background: #fff;
  font-size: 13px;
  color: #5c5c74;
}

.cancel:disabled {
  opacity: 0.5;
}

.spinner {
  width: 28px;
  height: 28px;
  margin: 18px auto 6px;
  border: 3px solid #e6e8f5;
  border-top-color: #667eea;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
</style>
