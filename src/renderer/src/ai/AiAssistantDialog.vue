<script setup lang="ts">
import { computed, onBeforeUnmount } from 'vue'
import type { SectionType } from '@shared/schema'
import { activeTab } from '@renderer/stores/tabs'
import { acceptAi, aiUI, cancelAi, closeAi, runAiTask } from './useAiAssistant'

/** 板块级 AI 助手：左原文、右 AI 新版，采纳前不动文档。 */

const QUICK = [
  { label: '更简洁', text: '在事实完全不变的前提下，把表达改得更简洁，去掉冗余修饰。' },
  { label: '突出成果', text: '在事实完全不变的前提下，突出动作与结果，把能体现成效的信息前置。' },
  { label: '更专业', text: '在事实完全不变的前提下，换用法律行业更规范、更书面的表述。' },
  { label: '贴求职意向', text: '在事实完全不变的前提下，让措辞更贴合我的求职意向。' }
]

/** 空板块时，AI 需要先问清楚才能写 */
const GUIDE: Record<string, string[]> = {
  experience: ['哪家单位、什么岗位、什么时间？', '你具体做了什么？（越具体越好）', '有没有能写出来的数字？比如整理了多少份卷宗、参与了几次庭审、写了几份检索报告。'],
  education: ['哪所学校、什么专业、什么学位？', '起止时间？', 'GPA、排名、核心课程有没有想写的？'],
  listBlock: ['这一项是什么？比如某种证书、某项技能、某个奖项。', '具体内容是什么？（证书写年份，技能写掌握程度）'],
  textBlock: ['你觉得自己最大的优势是什么？', '和法学求职最相关的一段经历是什么？', '你希望 HR 记住你哪一点？']
}

const sectionType = computed<SectionType>(() => {
  const tab = activeTab.value
  if (tab.kind !== 'doc') return 'textBlock'
  return tab.doc.sections.find((s) => s.id === aiUI.sectionId)?.type ?? 'textBlock'
})

const guides = computed(() => GUIDE[sectionType.value] ?? GUIDE['textBlock']!)

/** 流式过程中把 @@序号 标记行藏起来，只显示正文 */
const displayStream = computed(() =>
  aiUI.streamText
    .split(/\r?\n/)
    .filter((l) => !/^\s*@{1,3}\s*\d+\s*$/.test(l))
    .join('\n')
)

const streaming = computed(() => aiUI.status === 'streaming')
const canAccept = computed(() => aiUI.status === 'done' && aiUI.groups !== null)

function useQuick(text: string): void {
  aiUI.instruction = text
  void runAiTask()
}

onBeforeUnmount(() => {
  if (streaming.value) cancelAi()
})
</script>

<template>
  <div v-if="aiUI.open" class="modal-mask">
    <div class="ai-card">
      <header class="ai-head">
        <span class="ai-title">{{ aiUI.sectionTitle }} · AI 助手</span>
        <span class="ai-mode">{{ aiUI.mode === 'generate' ? '从零写' : '润色改写' }}</span>
        <button class="ai-x" title="关闭" @click="closeAi()">✕</button>
      </header>

      <!-- 输入区 -->
      <div class="ai-input">
        <template v-if="aiUI.mode === 'rewrite'">
          <div class="ai-label">你想怎么改？<span class="ai-hint">留空 = 通顺润色</span></div>
          <input
            v-model="aiUI.instruction"
            class="ai-inp"
            placeholder="例如：更简洁一点 / 突出我在实习里独立完成的部分"
            :disabled="streaming"
            @keyup.enter="runAiTask()"
          />
          <div class="ai-chips">
            <button v-for="q in QUICK" :key="q.label" class="ai-chip" :disabled="streaming" @click="useQuick(q.text)">
              {{ q.label }}
            </button>
          </div>
        </template>

        <template v-else>
          <div class="ai-label">
            先告诉我这几件事，写多少算多少<span class="ai-hint">留空也能写，但会比较笼统</span>
          </div>
          <ul class="ai-guide">
            <li v-for="(g, i) in guides" :key="i">{{ g }}</li>
          </ul>
          <textarea
            v-model="aiUI.answers"
            class="ai-textarea"
            rows="4"
            placeholder="在这里一起写下来，例如：2024 年暑假在某律所实习，主要帮带教律师整理民事案件卷宗、做类案检索…"
            :disabled="streaming"
          ></textarea>
        </template>

        <button v-if="aiUI.mode === 'rewrite'" class="ai-run" :disabled="streaming" @click="runAiTask()">
          {{ streaming ? '生成中…' : aiUI.status === 'done' ? '重新生成' : '开始润色' }}
        </button>
        <button v-else class="ai-run" :disabled="streaming" @click="runAiTask()">
          {{ streaming ? '生成中…' : aiUI.status === 'done' ? '重新生成' : '开始生成' }}
        </button>
      </div>

      <!-- 对照区 -->
      <div class="ai-compare">
        <section class="ai-pane">
          <div class="pane-head">原文</div>
          <pre class="pane-body">{{ aiUI.sourceText || '（这个板块还是空的）' }}</pre>
        </section>

        <section class="ai-pane">
          <div class="pane-head">
            AI 新版
            <span v-if="streaming" class="pane-meta">生成中 · 已生成 {{ aiUI.chars }} 字</span>
            <span v-else-if="aiUI.status === 'done'" class="pane-meta ok">
              {{ aiUI.profileName }} · 请对照原文检查后再采纳
            </span>
          </div>

          <div class="pane-body">
            <template v-if="streaming">
              <pre class="pane-pre">{{ displayStream }}</pre>
            </template>

            <template v-else-if="aiUI.status === 'done' && aiUI.groups">
              <div v-for="(g, i) in aiUI.groups" :key="i" class="pv-group">
                <div v-if="aiUI.groups.length > 1" class="pv-group-head">第 {{ i + 1 }} 条</div>
                <div v-for="(line, j) in g" :key="j" class="pv-line">· {{ line }}</div>
              </div>
            </template>

            <template v-else-if="aiUI.status === 'error'">
              <p class="pane-error">{{ aiUI.error }}</p>
              <details v-if="aiUI.streamText" class="pane-raw">
                <summary>查看 AI 的原始返回</summary>
                <pre>{{ aiUI.streamText }}</pre>
              </details>
            </template>

            <p v-else class="pane-idle">
              {{ aiUI.mode === 'generate' ? '填好左边的问题，点「开始生成」。' : '点「开始润色」，结果会显示在这里。' }}
            </p>
          </div>
        </section>
      </div>

      <footer class="ai-foot">
        <span class="ai-note">AI 只改措辞，时间、单位、职务等事实信息一律照抄</span>
        <div class="ai-actions">
          <button class="ai-btn" @click="closeAi()">放弃</button>
          <button v-if="streaming" class="ai-btn danger" @click="cancelAi()">停止生成</button>
          <button v-else class="ai-btn" :disabled="aiUI.status !== 'done'" @click="runAiTask()">重新生成</button>
          <button class="ai-btn primary" :disabled="!canAccept" @click="acceptAi()">采纳替换</button>
        </div>
      </footer>
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

.ai-card {
  width: 900px;
  max-width: calc(100vw - 48px);
  max-height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(24, 28, 60, 0.28);
}

.ai-head {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 16px;
  border-bottom: 1px solid #ececf3;
}

.ai-title {
  font-size: 15px;
  font-weight: 600;
  color: #24242e;
}

.ai-mode {
  font-size: 11.5px;
  color: #667eea;
  background: #eef0fd;
  border-radius: 5px;
  padding: 2px 7px;
}

.ai-x {
  margin-left: auto;
  border: none;
  background: transparent;
  color: #a8a8bd;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 5px;
}

.ai-x:hover {
  background: #ececf3;
  color: #4a4a60;
}

.ai-input {
  padding: 13px 16px;
  border-bottom: 1px solid #ececf3;
  background: #fafaff;
}

.ai-label {
  font-size: 12.5px;
  color: #3c3c50;
  margin-bottom: 7px;
}

.ai-hint {
  color: #a0a0b6;
  margin-left: 8px;
  font-size: 11.5px;
}

.ai-inp {
  width: 100%;
  padding: 8px 11px;
  border: 1px solid #dcdce8;
  border-radius: 8px;
  font-size: 13px;
  outline: none;
}

.ai-inp:focus {
  border-color: #667eea;
}

.ai-textarea {
  width: 100%;
  padding: 9px 11px;
  border: 1px solid #dcdce8;
  border-radius: 8px;
  font-size: 13px;
  font-family: inherit;
  line-height: 1.6;
  resize: vertical;
  outline: none;
}

.ai-textarea:focus {
  border-color: #667eea;
}

.ai-guide {
  margin: 0 0 8px;
  padding-left: 18px;
  font-size: 12.5px;
  line-height: 1.75;
  color: #7c7c92;
}

.ai-chips {
  display: flex;
  gap: 6px;
  margin-top: 8px;
  flex-wrap: wrap;
}

.ai-chip {
  padding: 4px 11px;
  border: 1px solid #dcdce8;
  background: #fff;
  border-radius: 999px;
  font-size: 12px;
  color: #5a5a72;
}

.ai-chip:hover:not(:disabled) {
  border-color: #667eea;
  color: #667eea;
}

.ai-chip:disabled {
  opacity: 0.5;
}

.ai-chip.solo {
  margin-top: 8px;
  border-radius: 7px;
}

.ai-run {
  margin-top: 10px;
  padding: 7px 18px;
  border: none;
  border-radius: 8px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-size: 13px;
  font-weight: 500;
}

.ai-run:disabled {
  opacity: 0.6;
}

.ai-compare {
  flex: 1;
  display: flex;
  min-height: 0;
}

.ai-pane {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.ai-pane + .ai-pane {
  border-left: 1px solid #ececf3;
}

.pane-head {
  padding: 8px 15px;
  font-size: 12px;
  color: #8b8ba3;
  border-bottom: 1px solid #f2f2f7;
  display: flex;
  align-items: center;
  gap: 8px;
}

.pane-meta {
  color: #9094d6;
}

.pane-meta.ok {
  color: #3fbf7f;
}

.pane-body {
  flex: 1;
  overflow: auto;
  padding: 12px 15px;
  min-height: 170px;
  max-height: 46vh;
}

.pane-body pre,
.pane-body .pane-pre {
  margin: 0;
  font-family: inherit;
  font-size: 13px;
  line-height: 1.8;
  color: #3c3c50;
  white-space: pre-wrap;
  word-break: break-word;
}

.pv-group + .pv-group {
  margin-top: 12px;
  padding-top: 10px;
  border-top: 1px dashed #ececf3;
}

.pv-group-head {
  font-size: 11.5px;
  color: #9a9aae;
  margin-bottom: 4px;
}

.pv-line {
  font-size: 13px;
  line-height: 1.8;
  color: #24242e;
}

.pane-idle {
  margin: 0;
  font-size: 12.5px;
  color: #b0b0c2;
  line-height: 1.7;
}

.pane-error {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.7;
  color: #d9534f;
}

.pane-raw {
  margin-top: 10px;
  font-size: 12px;
  color: #8b8ba3;
}

.pane-raw pre {
  margin-top: 6px;
  padding: 8px;
  background: #f7f7fb;
  border-radius: 6px;
  font-size: 11.5px;
  max-height: 180px;
  overflow: auto;
}

.ai-foot {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 16px;
  border-top: 1px solid #ececf3;
  background: #fafaff;
}

.ai-note {
  font-size: 11.5px;
  color: #a0a0b6;
}

.ai-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.ai-btn {
  padding: 7px 16px;
  border: 1px solid #dcdce8;
  background: #fff;
  border-radius: 8px;
  font-size: 13px;
  color: #3c3c50;
}

.ai-btn:hover:not(:disabled) {
  border-color: #667eea;
  color: #667eea;
}

.ai-btn:disabled {
  opacity: 0.5;
  cursor: default;
}

.ai-btn.danger {
  border-color: #e6a6a4;
  color: #d9534f;
}

.ai-btn.primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
  color: #fff;
  font-weight: 500;
}

.ai-btn.primary:hover:not(:disabled) {
  opacity: 0.92;
  color: #fff;
}
</style>
