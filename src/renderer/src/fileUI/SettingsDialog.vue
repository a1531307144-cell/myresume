<script setup lang="ts">
import { onMounted, ref } from 'vue'

/**
 * AI 服务设置（用户自备 OpenAI 兼容接口）。
 * 安全：Key 输入框掩码显示；保存后渲染层拿不到完整 Key（主进程只回掩码）。
 */
const emit = defineEmits<{ close: [] }>()

const baseUrl = ref('')
const model = ref('')
const apiKey = ref('')
const keyMasked = ref('')
const hasKey = ref(false)
const saving = ref(false)
const testing = ref(false)
const testResult = ref<{ ok: boolean; text: string } | null>(null)
const clearKey = ref(false)

onMounted(async () => {
  const c = await window.myresume.ai.getConfig()
  baseUrl.value = c.baseUrl
  model.value = c.model
  hasKey.value = c.hasKey
  keyMasked.value = c.keyMasked
})

async function save(): Promise<void> {
  saving.value = true
  testResult.value = null
  try {
    // Key 输入框留空 = 保留已存 Key；勾选清除 = 清除
    await window.myresume.ai.setConfig({
      baseUrl: baseUrl.value,
      model: model.value,
      apiKey: clearKey.value ? null : apiKey.value || undefined
    })
    const c = await window.myresume.ai.getConfig()
    hasKey.value = c.hasKey
    keyMasked.value = c.keyMasked
    apiKey.value = ''
    testResult.value = { ok: true, text: '已保存' }
  } finally {
    saving.value = false
  }
}

async function test(): Promise<void> {
  await save()
  testing.value = true
  try {
    const r = await window.myresume.ai.test()
    testResult.value = r.ok ? { ok: true, text: '连接成功 ✓' } : { ok: false, text: r.error ?? '连接失败' }
  } finally {
    testing.value = false
  }
}
</script>

<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="set-card">
      <h3 class="title">AI 服务设置</h3>
      <p class="hint">
        填写任意<b> OpenAI 兼容</b>接口（DeepSeek、智谱、通义、Kimi 等均支持）。<br />
        API Key 只保存在你电脑本机，仅用于调用你自己填写的接口；软件不含任何官方服务端。
      </p>

      <label class="fld">
        <span class="lbl">接口地址（完整，以 /chat/completions 结尾）</span>
        <input v-model="baseUrl" class="in" placeholder="如 https://api.deepseek.com/v1/chat/completions" spellcheck="false" />
      </label>

      <label class="fld">
        <span class="lbl">模型名称</span>
        <input v-model="model" class="in" placeholder="如 deepseek-chat" spellcheck="false" />
      </label>

      <label class="fld">
        <span class="lbl">
          API Key
          <span v-if="hasKey" class="masked">已保存：{{ keyMasked }}（留空则保留）</span>
        </span>
        <input v-model="apiKey" class="in" type="password" placeholder="sk-…" spellcheck="false" autocomplete="off" />
      </label>

      <label v-if="hasKey" class="clear-row">
        <input v-model="clearKey" type="checkbox" />
        <span>清除已保存的 API Key</span>
      </label>

      <p v-if="testResult" class="result" :class="{ bad: !testResult.ok }">{{ testResult.text }}</p>

      <div class="btns">
        <button class="b plain" @click="emit('close')">关闭</button>
        <button class="b plain" :disabled="saving || testing" @click="test">{{ testing ? '测试中…' : '保存并测试' }}</button>
        <button class="b primary" :disabled="saving" @click="save">{{ saving ? '保存中…' : '保存' }}</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(24, 26, 40, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 120;
}

.set-card {
  width: 480px;
  max-width: calc(100vw - 48px);
  background: #fff;
  border-radius: 14px;
  padding: 22px 24px 18px;
  box-shadow: 0 16px 48px rgba(20, 24, 50, 0.26);
}

.title {
  margin: 0 0 8px;
  font-size: 16px;
  color: #24242e;
}

.hint {
  margin: 0 0 16px;
  font-size: 12px;
  line-height: 1.7;
  color: #8b8ba3;
}

.fld {
  display: block;
  margin-bottom: 12px;
}

.lbl {
  display: block;
  font-size: 12px;
  color: #5c5c74;
  margin-bottom: 5px;
}

.masked {
  margin-left: 6px;
  color: #3fbf7f;
}

.in {
  width: 100%;
  padding: 8px 10px;
  border: 1px solid #d9d9e6;
  border-radius: 7px;
  font-size: 13px;
  outline: none;
}

.in:focus {
  border-color: #667eea;
}

.clear-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #5c5c74;
  margin-bottom: 6px;
}

.result {
  font-size: 12px;
  color: #3fbf7f;
  margin: 8px 0 0;
}

.result.bad {
  color: #d9534f;
}

.btns {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 16px;
}

.b {
  padding: 7px 16px;
  border-radius: 7px;
  font-size: 13px;
  border: 1px solid transparent;
}

.b.plain {
  background: #f2f3f8;
  color: #5c5c74;
}

.b.plain:hover {
  background: #e8e9f2;
}

.b.primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
}

.b:disabled {
  opacity: 0.6;
}
</style>
