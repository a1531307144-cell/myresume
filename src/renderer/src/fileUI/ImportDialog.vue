<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { AiProfileView } from '@shared/ipc'
import { buildDocument, parseResumeText } from '@shared/importer'
import { extractText } from '@renderer/importerClient/extract'
import { store } from '@renderer/stores/resume'
import { importUI, finishImport, modalApi, settingsUI } from './useFileActions'

type Step = 'choose' | 'extracting' | 'ready' | 'importing'

const step = ref<Step>('choose')
const fileName = ref('')
const charCount = ref(0)
const text = ref('')
const error = ref('')
const aiReady = ref<boolean | null>(null) // null=未检查
const profiles = ref<AiProfileView[]>([])
const selectedProfileId = ref('')
const parseMode = ref<'' | 'local' | 'ai'>('')
const elapsed = ref(0)
const aiChars = ref(0)
const aiText = ref('')
const extractPage = ref<{ current: number; total: number } | null>(null)
let elapsedTimer: ReturnType<typeof setInterval> | undefined

/** 实时识别清单：AI 生成的 JSON 里出现对应标记即点亮 */
const checkmarks = computed(() => [
  { label: '姓名', hit: /"name"\s*:\s*"[^"]{1,20}"/.test(aiText.value) },
  { label: '联系方式', hit: /"label"\s*:\s*"[^"]+"/.test(aiText.value) },
  { label: '教育背景', hit: /"type"\s*:\s*"education"/.test(aiText.value) },
  { label: '经历板块', hit: /"type"\s*:\s*"experience"/.test(aiText.value) },
  { label: '技能/荣誉', hit: /"type"\s*:\s*"listBlock"/.test(aiText.value) },
  { label: '自我评价', hit: /"type"\s*:\s*"textBlock"/.test(aiText.value) }
])

// 设置窗口关闭后刷新模型状态
watch(
  () => settingsUI.open,
  (open) => {
    if (!open && step.value === 'ready') void checkAi()
  }
)

onMounted(() => {
  window.myresume.ai.onProgress((p) => {
    aiChars.value = p.chars
    aiText.value = p.text
  })
})

// 拖放的文件（或重新拖入）直接进入处理流程
watch(
  () => importUI.pending,
  (pending) => {
    if (pending) {
      importUI.pending = null
      void processPicked(pending)
    }
  },
  { immediate: true }
)

function startTimer(): void {
  elapsed.value = 0
  stopTimer()
  elapsedTimer = setInterval(() => {
    elapsed.value += 1
  }, 1000)
}

function stopTimer(): void {
  if (elapsedTimer) {
    clearInterval(elapsedTimer)
    elapsedTimer = undefined
  }
}

onBeforeUnmount(stopTimer)

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
  await processPicked(picked)
}

async function processPicked(picked: { name: string; ext: string; dataBase64: string }): Promise<void> {
  error.value = ''
  fileName.value = picked.name
  step.value = 'extracting'
  extractPage.value = null
  try {
    text.value = await extractText(picked.ext, picked.dataBase64, (current, total) => {
      extractPage.value = { current, total }
    })
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

function selectedProfileName(): string {
  return profiles.value.find((p) => p.id === selectedProfileId.value)?.name ?? 'AI 模型'
}

async function checkAi(): Promise<void> {
  try {
    const c = await window.myresume.ai.getConfig()
    profiles.value = c.profiles
    const withKey = c.profiles.filter((p) => p.hasKey)
    aiReady.value = withKey.length > 0
    // 默认选「常用」，无 Key 则选第一个有 Key 的
    const active = c.profiles.find((p) => p.id === c.activeId)
    selectedProfileId.value =
      active && active.hasKey ? active.id : (withKey[0]?.id ?? c.activeId ?? c.profiles[0]?.id ?? '')
  } catch {
    aiReady.value = false
  }
}

/** 本地启发式解析（离线） */
function parseLocal(): void {
  step.value = 'importing'
  parseMode.value = 'local'
  startTimer()
  try {
    const parsed = parseResumeText(text.value, fileName.value)
    void finishImport(buildDocument(parsed, store.doc.meta.template))
  } catch (e) {
    error.value = e instanceof Error ? e.message : '解析失败'
    step.value = 'ready'
  } finally {
    stopTimer()
    parseMode.value = ''
  }
}

/** AI 解析（可选，更准；主进程代理流式请求，实时进度可取消） */
async function parseAi(): Promise<void> {
  step.value = 'importing'
  parseMode.value = 'ai'
  aiChars.value = 0
  aiText.value = ''
  startTimer()
  try {
    const r = await window.myresume.ai.parse(text.value, selectedProfileId.value || undefined)
    if (r.ok && r.parsed) {
      void finishImport(buildDocument(r.parsed, store.doc.meta.template))
      return
    }
    if (r.error === '__CANCELLED__') {
      error.value = ''
    } else {
      error.value = r.error ?? 'AI 解析失败'
    }
    step.value = 'ready'
  } catch {
    error.value = 'AI 解析失败，请稍后重试'
    step.value = 'ready'
  } finally {
    stopTimer()
    parseMode.value = ''
  }
}

function cancelParse(): void {
  if (parseMode.value === 'ai') {
    void window.myresume.ai.cancel()
  }
}

function close(): void {
  if (step.value === 'extracting' || step.value === 'importing') return // 进行中不允许关
  importUI.open = false
}

function toast(msg: string): void {
  modalApi.showToast(msg)
}

// 开发环境自测钩子：直接注入文件走完整流程（打包版不存在）
if (import.meta.env.DEV) {
  ;(window as unknown as Record<string, unknown>)['__mrTestImport'] = processPicked
  ;(window as unknown as Record<string, unknown>)['__mrTestState'] = () => ({
    step: step.value,
    parseMode: parseMode.value,
    aiReady: aiReady.value,
    profileCount: profiles.value.length,
    selected: selectedProfileId.value,
    error: error.value
  })
}
</script>

<template>
  <div class="modal-mask">
    <div class="import-card">
      <h3 class="title">导入已有简历</h3>

      <template v-if="step === 'choose'">
        <p class="desc">支持 <b>Word（.docx）</b>、<b>文字版 PDF</b>、<b>TXT</b>，文件不超过 20MB。<br />
        <span class="hint">图片/扫描版 PDF 暂不支持；解析结果请务必检查修正。<br />也可以直接把文件<b>拖进本窗口</b>任意位置。</span></p>
        <button class="big-btn" @click="pick">选择文件…</button>
      </template>

      <template v-else-if="step === 'extracting'">
        <p class="desc">
          正在提取「{{ fileName }}」的文字…<template v-if="extractPage">
            第 {{ extractPage.current }} / {{ extractPage.total }} 页</template>
        </p>
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
          <div class="opt ai-opt" :class="{ disabled: aiReady !== true }">
            <button
              class="ai-run"
              @click="aiReady === true ? parseAi() : aiReady === false ? ((settingsUI.open = true), toast('先添加模型并填写 Key 再使用')) : undefined"
            >
              <span class="opt-title">AI 智能解析<span class="badge">推荐</span></span>
              <span class="opt-sub">{{
                aiReady === null
                  ? '正在检查模型配置…'
                  : aiReady === false
                    ? '未配置——点击添加模型（需自备 API Key）'
                    : '更准确 · 需联网 · 内容仅发送到你选择的接口'
              }}</span>
            </button>
            <div v-if="profiles.length > 0" class="ai-model-row">
              <span class="ai-model-label">模型</span>
              <select v-model="selectedProfileId" class="ai-model-select" @click.stop>
                <option v-for="p in profiles" :key="p.id" :value="p.id">
                  {{ p.name }}{{ p.hasKey ? '' : '（未填 Key）' }}
                </option>
              </select>
            </div>
          </div>
        </div>
        <button class="link-btn" @click="settingsUI.open = true">AI 模型管理…</button>
      </template>

      <template v-else-if="step === 'importing'">
        <p class="desc">
          <template v-if="parseMode === 'ai'">
            <template v-if="aiChars > 0">
              {{ selectedProfileName() }} 正在解析… 已生成 <b>{{ aiChars }}</b> 字 · {{ elapsed }} 秒
            </template>
            <template v-else>
              正在连接 {{ selectedProfileName() }} 并等待模型响应<span class="dots"><i>·</i><i>·</i><i>·</i></span> {{ elapsed }} 秒
            </template>
          </template>
          <template v-else>正在解析… {{ elapsed }} 秒</template>
        </p>

        <div v-if="parseMode === 'ai'" class="check-list">
          <span v-for="c in checkmarks" :key="c.label" class="check-chip" :class="{ on: c.hit }">
            <span class="chip-mark">{{ c.hit ? '✓' : '···' }}</span>{{ c.label }}
          </span>
        </div>

        <div v-if="parseMode === 'ai'" class="stream-bar"><div class="stream-fill"></div></div>
        <div v-else class="spinner"></div>
        <button v-if="parseMode === 'ai'" class="cancel-parse" @click="cancelParse">取消解析</button>
      </template>

      <p v-if="error" class="error">{{ error }}</p>

      <div class="footer">
        <button class="cancel" :disabled="step === 'extracting' || step === 'importing'" @click="close">
          {{ step === 'ready' ? '取消' : '关闭' }}
        </button>
      </div>
    </div>
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

.ai-opt {
  display: flex;
  flex-direction: column;
  gap: 8px;
  cursor: default;
}

.ai-run {
  text-align: left;
  border: none;
  background: transparent;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.ai-model-row {
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid #f0f0f6;
  padding-top: 8px;
}

.ai-model-label {
  font-size: 12px;
  color: #8b8ba3;
  flex-shrink: 0;
}

.ai-model-select {
  flex: 1;
  padding: 4px 8px;
  border: 1px solid #d9d9e6;
  border-radius: 6px;
  font-size: 12px;
  background: #fff;
  outline: none;
}

.cancel-parse {
  display: block;
  margin: 14px auto 0;
  padding: 6px 16px;
  border: 1px solid #dcdce8;
  border-radius: 7px;
  background: #fff;
  font-size: 12px;
  color: #5c5c74;
}

.cancel-parse:hover {
  border-color: #d9534f;
  color: #d9534f;
}

/* 流式生成中的动态进度条（长度未知，用流动光带表达"进行中"） */
.stream-bar {
  position: relative;
  height: 6px;
  border-radius: 3px;
  background: #ececf3;
  overflow: hidden;
  margin: 16px 0 4px;
}

.stream-fill {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 40%;
  border-radius: 3px;
  background: linear-gradient(90deg, #667eea, #9b8ae0, #667eea);
  animation: stream-slide 1.2s ease-in-out infinite;
}

@keyframes stream-slide {
  0% {
    left: -40%;
  }
  100% {
    left: 100%;
  }
}

/* 实时识别清单：AI 识别到对应板块时逐个点亮 */
.check-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 4px 0 14px;
}

.check-chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: #b3b3c4;
  border: 1px solid #ececf3;
  border-radius: 20px;
  padding: 3px 11px;
  transition: all 0.25s ease;
}

.check-chip.on {
  color: #2f9e6e;
  border-color: #bfe6d4;
  background: #f0faf5;
}

.chip-mark {
  font-size: 11px;
}

/* 等待模型首字时的呼吸点 */
.dots {
  display: inline-block;
  margin-left: 2px;
}

.dots i {
  font-style: normal;
  animation: dot-blink 1.2s infinite;
}

.dots i:nth-child(2) {
  animation-delay: 0.2s;
}

.dots i:nth-child(3) {
  animation-delay: 0.4s;
}

@keyframes dot-blink {
  0%,
  60%,
  100% {
    opacity: 0.2;
  }
  30% {
    opacity: 1;
  }
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
