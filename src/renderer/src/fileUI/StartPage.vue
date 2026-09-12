<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { RecentItem } from '@shared/ipc'
import { activateTab, tabs } from '@renderer/stores/tabs'
import { TEMPLATE_LIST } from '@renderer/preview/templates'
import TemplateMock from './TemplateMock.vue'
import { importDocAction, openDocAction, openRecentAction, startWithTemplate } from './useFileActions'

const recent = ref<RecentItem[]>([])
const version = ref('')

/** 已经打开的简历（点击回到其中最近的一份） */
const docTabs = computed(() => tabs.filter((t) => t.kind === 'doc'))
const lastDocTab = computed(() => docTabs.value[docTabs.value.length - 1])

function backToLastDoc(): void {
  const tab = lastDocTab.value
  if (tab) void activateTab(tab.id)
}

onMounted(async () => {
  try {
    recent.value = await window.myresume.file.getRecent()
  } catch {
    recent.value = []
  }
  version.value = await window.myresume.app.getVersion()
})

function fmtDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('zh-CN')
  } catch {
    return ''
  }
}
</script>

<template>
  <div class="start-page">
    <div class="start-main">
      <div class="start-brand">
        <span class="start-mark">简</span>
        <h1 class="start-title">我的简历</h1>
      </div>
      <p class="start-sub">选择一个模板开始——之后可以随时切换，数据不会变</p>

      <button v-if="lastDocTab" class="back-btn" @click="backToLastDoc()">
        ← 返回正在编辑的简历（{{ lastDocTab.fileName ?? '未命名简历' }}）
      </button>

      <div class="start-cards">
        <button v-for="t in TEMPLATE_LIST" :key="t.id" class="start-card" @click="startWithTemplate(t.id)">
          <TemplateMock :kind="t.mock" :accent="t.accent" />
          <div class="card-name">{{ t.name }}</div>
          <div class="card-desc">{{ t.desc }}</div>
        </button>
      </div>

      <button class="import-entry" @click="importDocAction()">已有简历？导入 Word / PDF，自动生成板块 →</button>

      <div class="start-recent">
        <div class="recent-head">最近打开</div>
        <button v-if="recent.length === 0" class="recent-empty" @click="openDocAction()">
          还没有文件——点此打开或从上方模板开始
        </button>
        <button v-for="item in recent.slice(0, 5)" :key="item.path" class="recent-item" @click="openRecentAction(item.path)">
          <span class="recent-name">{{ item.name }}</span>
          <span class="recent-date">{{ fmtDate(item.updatedAt) }}</span>
        </button>
      </div>
    </div>

    <footer class="start-footer">MIT 开源 · 数据只存在你自己的电脑上 · v{{ version }}</footer>
  </div>
</template>

<style scoped>
.start-page {
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  background:
    radial-gradient(1200px 500px at 20% -10%, rgba(102, 126, 234, 0.1), transparent),
    radial-gradient(900px 400px at 90% 110%, rgba(118, 75, 162, 0.08), transparent),
    #f7f7fb;
  overflow: auto;
}

.start-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 36px 24px 24px;
}

.start-brand {
  display: flex;
  align-items: center;
  gap: 12px;
}

.start-mark {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-size: 24px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 24px rgba(102, 126, 234, 0.35);
}

.start-title {
  font-size: 30px;
  font-weight: 700;
  color: #24242e;
  margin: 0;
}

.start-sub {
  margin: 14px 0 0;
  font-size: 14px;
  color: #8b8ba3;
}

.back-btn {
  margin-top: 18px;
  padding: 8px 20px;
  border: 1px solid #667eea;
  border-radius: 8px;
  background: #fff;
  color: #667eea;
  font-size: 13px;
  font-weight: 500;
}

.back-btn:hover {
  background: #667eea;
  color: #fff;
}

.start-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  width: 780px;
  max-width: calc(100vw - 48px);
  margin-top: 30px;
}

.start-card {
  padding: 10px 10px 13px;
  background: #fff;
  border: 1px solid #e8e8f1;
  border-radius: 12px;
  cursor: pointer;
  text-align: left;
  transition: all 0.16s ease;
}

.start-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 28px rgba(60, 70, 140, 0.15);
  border-color: #c9cdf5;
}

.card-name {
  margin-top: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #24242e;
}

.card-desc {
  margin-top: 4px;
  font-size: 11.5px;
  line-height: 1.6;
  color: #9a9aae;
}

.start-recent {
  margin-top: 26px;
  width: 780px;
  max-width: calc(100vw - 48px);
}

.import-entry {
  margin-top: 20px;
  border: none;
  background: transparent;
  font-size: 13px;
  color: #667eea;
  padding: 6px 10px;
}

.import-entry:hover {
  text-decoration: underline;
}

.recent-head {
  font-size: 12px;
  color: #b3b3c4;
  margin-bottom: 8px;
}

.recent-item,
.recent-empty {
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 9px 14px;
  background: #fff;
  border: 1px solid #ececf3;
  border-radius: 9px;
  margin-bottom: 7px;
  font-size: 13px;
  color: #3c3c50;
}

.recent-item:hover {
  border-color: #667eea;
}

.recent-empty {
  color: #9a9aae;
  cursor: pointer;
}

.recent-empty:hover {
  color: #667eea;
}

.recent-date {
  font-size: 12px;
  color: #b3b3c4;
}

.start-footer {
  padding: 14px;
  font-size: 12px;
  color: #b3b3c4;
}
</style>
