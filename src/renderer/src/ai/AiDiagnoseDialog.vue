<script setup lang="ts">
import { computed } from 'vue'
import { settingsUI } from '@renderer/fileUI/useFileActions'
import { applyIssue, cancelDiagnose, closeDiagnose, diagnoseUI, openDiagnose, runDiagnose } from './useAiAssistant'

/** 全文诊断：AI 通读整份简历，列出具体问题，可一键跳到对应板块去改。 */

const SEV_TEXT: Record<string, string> = { high: '优先改', medium: '建议改', low: '可选' }

const streaming = computed(() => diagnoseUI.status === 'streaming')
</script>

<template>
  <div v-if="diagnoseUI.open" class="modal-mask">
    <div class="dg-card">
      <header class="dg-head">
        <span class="dg-title">AI 诊断 · 通读全文</span>
        <button class="dg-x" title="关闭" @click="closeDiagnose()">✕</button>
      </header>

      <div class="dg-body">
        <template v-if="diagnoseUI.status === 'idle'">
          <p class="dg-lead">
            让 AI 通读整份简历，指出具体问题：哪段太空泛、哪句太啰嗦、哪里缺数字、和求职意向是否对得上。
            每条问题都可以点「让 AI 改」跳到对应板块去改。
          </p>
          <p class="dg-note">简历内容会发送到你配置的 AI 接口，不会存到别处。</p>
        </template>

        <template v-else-if="streaming">
          <div class="dg-progress">
            <div class="dg-bar"></div>
            <p class="dg-lead">AI 正在通读你的简历… 已生成 {{ diagnoseUI.chars }} 字</p>
          </div>
        </template>

        <template v-else-if="diagnoseUI.status === 'error'">
          <p class="dg-error">{{ diagnoseUI.error }}</p>
          <p v-if="!diagnoseUI.error.includes('Key')" class="dg-note">
            如果还没配置 AI 模型，可以先去
            <button class="dg-link" @click="settingsUI.open = true">AI 模型管理</button>
            添加。
          </p>
        </template>

        <template v-else-if="diagnoseUI.status === 'done'">
          <p v-if="diagnoseUI.summary" class="dg-summary">{{ diagnoseUI.summary }}</p>
          <p v-if="diagnoseUI.truncated" class="dg-note">
            简历较长，本次只覆盖了前 {{ diagnoseUI.includedSections }} 个板块（共 {{ diagnoseUI.totalSections }} 个）。
          </p>

          <p v-if="diagnoseUI.issues.length === 0" class="dg-lead">没有发现明显问题。</p>

          <ul v-else class="dg-list">
            <li v-for="(it, i) in diagnoseUI.issues" :key="i" class="dg-item">
              <div class="dg-item-head">
                <span class="dg-sev" :class="it.severity">{{ SEV_TEXT[it.severity] }}</span>
                <span class="dg-sec">{{ it.sectionTitle }}<template v-if="it.itemIndex > 0"> · 第 {{ it.itemIndex }} 条</template></span>
              </div>
              <div class="dg-problem">{{ it.problem }}</div>
              <div v-if="it.suggestion" class="dg-sug">改法：{{ it.suggestion }}</div>
              <button class="dg-fix" @click="applyIssue(it)">让 AI 改</button>
            </li>
          </ul>
        </template>
      </div>

      <footer class="dg-foot">
        <span class="dg-foot-note">诊断只给方向，改不改由你决定</span>
        <div class="dg-actions">
          <button class="dg-btn" @click="closeDiagnose()">关闭</button>
          <button v-if="streaming" class="dg-btn danger" @click="cancelDiagnose()">停止</button>
          <button v-else class="dg-btn primary" @click="runDiagnose()">
            {{ diagnoseUI.status === 'done' ? '重新诊断' : '开始诊断' }}
          </button>
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

.dg-card {
  width: 640px;
  max-width: calc(100vw - 48px);
  max-height: calc(100vh - 60px);
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 24px 60px rgba(24, 28, 60, 0.28);
}

.dg-head {
  display: flex;
  align-items: center;
  padding: 13px 16px;
  border-bottom: 1px solid #ececf3;
}

.dg-title {
  font-size: 15px;
  font-weight: 600;
  color: #24242e;
}

.dg-x {
  margin-left: auto;
  border: none;
  background: transparent;
  color: #a8a8bd;
  font-size: 14px;
  padding: 2px 6px;
  border-radius: 5px;
}

.dg-x:hover {
  background: #ececf3;
  color: #4a4a60;
}

.dg-body {
  flex: 1;
  overflow: auto;
  padding: 14px 16px;
}

.dg-lead {
  margin: 0;
  font-size: 13px;
  line-height: 1.85;
  color: #5a5a72;
}

.dg-note {
  margin: 8px 0 0;
  font-size: 11.5px;
  line-height: 1.7;
  color: #a0a0b6;
}

.dg-link {
  border: none;
  background: transparent;
  color: #667eea;
  font-size: 11.5px;
  padding: 0;
  text-decoration: underline;
}

.dg-error {
  margin: 0;
  font-size: 13px;
  line-height: 1.7;
  color: #d9534f;
}

.dg-progress {
  padding: 6px 0;
}

.dg-bar {
  height: 5px;
  border-radius: 3px;
  background: linear-gradient(90deg, #e8e9fb, #667eea, #e8e9fb);
  background-size: 220% 100%;
  animation: dg-slide 1.1s linear infinite;
  margin-bottom: 12px;
}

@keyframes dg-slide {
  from {
    background-position: 120% 0;
  }
  to {
    background-position: -120% 0;
  }
}

.dg-summary {
  margin: 0 0 12px;
  padding: 9px 12px;
  background: #f4f5ff;
  border-radius: 8px;
  font-size: 13px;
  line-height: 1.7;
  color: #3c3c50;
}

.dg-list {
  margin: 0;
  padding: 0;
  list-style: none;
}

.dg-item {
  padding: 11px 0;
  border-top: 1px solid #f2f2f7;
}

.dg-item:first-child {
  border-top: none;
}

.dg-item-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 5px;
}

.dg-sev {
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 5px;
  background: #ececf3;
  color: #5a5a72;
}

.dg-sev.high {
  background: #fdecec;
  color: #d9534f;
}

.dg-sev.medium {
  background: #fdf3e5;
  color: #c8860d;
}

.dg-sec {
  font-size: 12px;
  color: #8b8ba3;
}

.dg-problem {
  font-size: 13px;
  line-height: 1.7;
  color: #24242e;
}

.dg-sug {
  margin-top: 3px;
  font-size: 12.5px;
  line-height: 1.7;
  color: #7c7c92;
}

.dg-fix {
  margin-top: 7px;
  padding: 4px 12px;
  border: 1px solid #667eea;
  background: #fff;
  border-radius: 7px;
  font-size: 12px;
  color: #667eea;
}

.dg-fix:hover {
  background: #667eea;
  color: #fff;
}

.dg-foot {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 16px;
  border-top: 1px solid #ececf3;
  background: #fafaff;
}

.dg-foot-note {
  font-size: 11.5px;
  color: #a0a0b6;
}

.dg-actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.dg-btn {
  padding: 7px 16px;
  border: 1px solid #dcdce8;
  background: #fff;
  border-radius: 8px;
  font-size: 13px;
  color: #3c3c50;
}

.dg-btn:hover {
  border-color: #667eea;
  color: #667eea;
}

.dg-btn.danger {
  border-color: #e6a6a4;
  color: #d9534f;
}

.dg-btn.primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
  color: #fff;
  font-weight: 500;
}

.dg-btn.primary:hover {
  opacity: 0.92;
  color: #fff;
}
</style>
