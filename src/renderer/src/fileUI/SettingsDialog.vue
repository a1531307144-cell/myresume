<script setup lang="ts">
import { onMounted, ref } from 'vue'
import type { AiProfileView } from '@shared/ipc'

/**
 * AI 模型管理：多档案增删改、设常用、测试连接。
 * 安全：Key 掩码显示、留空=保留、可清除；完整 Key 只存在主进程。
 */
const emit = defineEmits<{ close: [] }>()

const profiles = ref<AiProfileView[]>([])
const activeId = ref('')
const mode = ref<'list' | 'edit'>('list')
const loading = ref(true)

const editing = ref({ id: '', name: '', baseUrl: '', model: '', apiKey: '', hasKey: false, keyMasked: '' })
const clearKey = ref(false)
const saving = ref(false)
const testing = ref(false)
const testResult = ref<{ ok: boolean; text: string } | null>(null)
const confirmDeleteId = ref('')

async function load(): Promise<void> {
  const c = await window.myresume.ai.getConfig()
  profiles.value = c.profiles
  activeId.value = c.activeId
  loading.value = false
}

onMounted(load)

function openNew(): void {
  editing.value = { id: '', name: '', baseUrl: '', model: '', apiKey: '', hasKey: false, keyMasked: '' }
  clearKey.value = false
  testResult.value = null
  mode.value = 'edit'
}

function openEdit(p: AiProfileView): void {
  editing.value = { id: p.id, name: p.name, baseUrl: p.baseUrl, model: p.model, apiKey: '', hasKey: p.hasKey, keyMasked: p.keyMasked }
  clearKey.value = false
  testResult.value = null
  mode.value = 'edit'
}

async function save(): Promise<boolean> {
  saving.value = true
  testResult.value = null
  try {
    const r = await window.myresume.ai.saveProfile({
      id: editing.value.id || undefined,
      name: editing.value.name,
      baseUrl: editing.value.baseUrl,
      model: editing.value.model,
      apiKey: clearKey.value ? null : editing.value.apiKey || undefined
    })
    if (!r.ok) {
      testResult.value = { ok: false, text: r.error ?? '保存失败' }
      return false
    }
    await load()
    return true
  } finally {
    saving.value = false
  }
}

async function saveAndBack(): Promise<void> {
  if (await save()) mode.value = 'list'
}

async function saveAndTest(): Promise<void> {
  testing.value = true
  try {
    const saved = await save()
    if (!saved) return
    await load()
    const r = await window.myresume.ai.test({
      id: editing.value.id || undefined,
      baseUrl: editing.value.baseUrl,
      model: editing.value.model,
      apiKey: editing.value.apiKey || undefined
    })
    testResult.value = r.ok ? { ok: true, text: '连接成功 ✓ 配置已保存' } : { ok: false, text: r.error ?? '连接失败' }
  } finally {
    testing.value = false
  }
}

async function setActive(p: AiProfileView): Promise<void> {
  await window.myresume.ai.setActive(p.id)
  await load()
}

async function remove(p: AiProfileView): Promise<void> {
  if (confirmDeleteId.value !== p.id) {
    confirmDeleteId.value = p.id
    return
  }
  await window.myresume.ai.deleteProfile(p.id)
  confirmDeleteId.value = ''
  await load()
}
</script>

<template>
  <div class="modal-mask" @click.self="emit('close')">
    <div class="set-card">
      <!-- ———— 列表模式 ———— -->
      <template v-if="mode === 'list'">
        <h3 class="title">AI 模型管理</h3>
        <p class="hint">
          可保存多个模型（DeepSeek、智谱、通义、Kimi 等 OpenAI 兼容接口），解析时选用。<br />
          API Key 只保存在你电脑本机，仅用于调用你自己填写的接口。
        </p>

        <div v-if="loading" class="empty">加载中…</div>
        <div v-else-if="profiles.length === 0" class="empty">还没有添加模型</div>

        <div v-for="p in profiles" :key="p.id" class="profile" :class="{ active: p.id === activeId }">
          <div class="p-main">
            <div class="p-name">
              {{ p.name }}
              <span v-if="p.id === activeId" class="tag-active">常用</span>
              <span v-if="!p.hasKey" class="tag-nokey">未填 Key</span>
            </div>
            <div class="p-meta">{{ p.model }} · {{ p.hasKey ? p.keyMasked : '无 Key' }}</div>
          </div>
          <div class="p-ops">
            <button v-if="p.id !== activeId" class="mini" @click="setActive(p)">设为常用</button>
            <button class="mini" @click="openEdit(p)">编辑</button>
            <button class="mini danger" @click="remove(p)">{{ confirmDeleteId === p.id ? '确认删除？' : '删除' }}</button>
          </div>
        </div>

        <button class="add" @click="openNew">＋ 添加模型</button>

        <div class="btns">
          <button class="b plain" @click="emit('close')">完成</button>
        </div>
      </template>

      <!-- ———— 编辑模式 ———— -->
      <template v-else>
        <h3 class="title">{{ editing.id ? '编辑模型' : '添加模型' }}</h3>

        <label class="fld">
          <span class="lbl">名称（便于区分）</span>
          <input v-model="editing.name" class="in" placeholder="如 DeepSeek 官方" spellcheck="false" />
        </label>

        <label class="fld">
          <span class="lbl">接口地址（完整，以 /chat/completions 结尾）</span>
          <input v-model="editing.baseUrl" class="in" placeholder="如 https://api.deepseek.com/v1/chat/completions" spellcheck="false" />
        </label>

        <label class="fld">
          <span class="lbl">模型名称</span>
          <input v-model="editing.model" class="in" placeholder="如 deepseek-chat" spellcheck="false" />
        </label>

        <label class="fld">
          <span class="lbl">
            API Key
            <span v-if="editing.hasKey" class="masked">已存：{{ editing.keyMasked }}（留空=保留）</span>
          </span>
          <input v-model="editing.apiKey" class="in" type="password" placeholder="sk-…" spellcheck="false" autocomplete="off" />
        </label>

        <label v-if="editing.hasKey" class="clear-row">
          <input v-model="clearKey" type="checkbox" />
          <span>清除已保存的 API Key</span>
        </label>

        <p v-if="testResult" class="result" :class="{ bad: !testResult.ok }">{{ testResult.text }}</p>

        <div class="btns">
          <button class="b plain" @click="mode = 'list'">返回</button>
          <button class="b plain" :disabled="saving || testing" @click="saveAndTest">{{ testing ? '测试中…' : '保存并测试' }}</button>
          <button class="b primary" :disabled="saving" @click="saveAndBack">{{ saving ? '保存中…' : '保存' }}</button>
        </div>
      </template>
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
  width: 500px;
  max-width: calc(100vw - 48px);
  max-height: calc(100vh - 80px);
  overflow-y: auto;
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

.empty {
  padding: 18px 0;
  text-align: center;
  font-size: 13px;
  color: #b3b3c4;
}

.profile {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid #e6e6ef;
  border-radius: 10px;
  padding: 10px 14px;
  margin-bottom: 8px;
}

.profile.active {
  border-color: #667eea;
  background: #f7f8fe;
}

.p-name {
  font-size: 13px;
  font-weight: 600;
  color: #24242e;
}

.tag-active {
  margin-left: 6px;
  font-size: 10px;
  font-weight: 500;
  color: #667eea;
  border: 1px solid #c9cdf5;
  border-radius: 4px;
  padding: 0 5px;
}

.tag-nokey {
  margin-left: 6px;
  font-size: 10px;
  color: #e6a23c;
  border: 1px solid #f0d8b0;
  border-radius: 4px;
  padding: 0 5px;
}

.p-meta {
  font-size: 11px;
  color: #9a9aae;
  margin-top: 3px;
  word-break: break-all;
}

.p-ops {
  display: flex;
  gap: 6px;
  flex-shrink: 0;
}

.mini {
  padding: 4px 9px;
  border: 1px solid #e0e0ec;
  border-radius: 6px;
  background: #fff;
  font-size: 11px;
  color: #5c5c74;
}

.mini:hover {
  border-color: #667eea;
  color: #667eea;
}

.mini.danger:hover {
  border-color: #d9534f;
  color: #d9534f;
}

.add {
  width: 100%;
  margin-top: 4px;
  padding: 9px;
  border: 1.5px dashed #a8aee8;
  border-radius: 10px;
  background: #fafbff;
  color: #5a63d8;
  font-size: 13px;
}

.add:hover {
  background: #f2f4fe;
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
