<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import type { RecentItem } from '@shared/ipc'
import { isSectionEmpty } from '@shared/sectionDefs'
import { store } from '@renderer/stores/resume'
import { backToEditorAction, importDocAction, openDocAction, openRecentAction, startWithTemplate } from './useFileActions'

const recent = ref<RecentItem[]>([])
const version = ref('')

/** 当前内存里有实质内容时，首页提供「返回当前简历」 */
const hasOpenDoc = computed(() => !store.doc.sections.every((s) => isSectionEmpty(s)))

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

      <button v-if="hasOpenDoc" class="back-btn" @click="backToEditorAction()">← 返回正在编辑的简历</button>

      <div class="start-cards">
        <button class="start-card" @click="startWithTemplate('law-classic')">
          <div class="card-preview law">
            <span class="mock-photo"></span>
            <span class="mock-name"></span>
            <span class="mock-line w70"></span>
            <span class="mock-gap"></span>
            <span class="mock-heading"></span>
            <span class="mock-line"></span>
            <span class="mock-line w80"></span>
          </div>
          <div class="card-name">法学正式风</div>
          <div class="card-desc">宋体排版 · 黑白稳重 · 照片右上角<br />法学生求职首选</div>
        </button>

        <button class="start-card" @click="startWithTemplate('simple-modern')">
          <div class="card-preview simple">
            <span class="mock-name accent"></span>
            <span class="mock-line w50"></span>
            <span class="mock-gap"></span>
            <span class="mock-heading bar"></span>
            <span class="mock-line"></span>
            <span class="mock-line w85"></span>
          </div>
          <div class="card-name">通用简约风</div>
          <div class="card-desc">现代无衬线 · 留白呼吸 · 靛蓝点缀<br />适配任何专业与行业</div>
        </button>
      </div>

      <button class="import-entry" @click="importDocAction()">已有简历？导入 Word / PDF，自动生成板块 →</button>

      <div class="start-recent">
        <div class="recent-head">最近打开</div>
        <button v-if="recent.length === 0" class="recent-empty" @click="openDocAction()">还没有文件——点此打开或从上方模板开始</button>
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
  height: 100vh;
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
  padding: 40px 24px 24px;
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
  display: flex;
  gap: 22px;
  margin-top: 34px;
  flex-wrap: wrap;
  justify-content: center;
}

.start-card {
  width: 250px;
  padding: 12px 12px 16px;
  background: #fff;
  border: 1px solid #e8e8f1;
  border-radius: 14px;
  cursor: pointer;
  text-align: left;
  transition: all 0.16s ease;
}

.start-card:hover {
  transform: translateY(-4px);
  box-shadow: 0 14px 34px rgba(60, 70, 140, 0.16);
  border-color: #c9cdf5;
}

.card-preview {
  height: 170px;
  border-radius: 9px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 18px 20px;
  position: relative;
  overflow: hidden;
}

.card-preview.law {
  background: #fff;
  border: 1px solid #dcdce6;
}

.card-preview.simple {
  background: linear-gradient(160deg, #f7f8ff, #eef1fc);
  border: 1px solid #dfe4f5;
}

.mock-photo {
  position: absolute;
  top: 16px;
  right: 16px;
  width: 26px;
  height: 34px;
  border: 1px solid #b9b9c6;
  background: #fbfbfd;
}

.mock-name {
  width: 84px;
  height: 13px;
  background: #2c2c34;
  border-radius: 2px;
}

.mock-name.accent {
  background: linear-gradient(90deg, #667eea, #9b8ae0);
}

.mock-heading {
  width: 56px;
  height: 7px;
  background: #2c2c34;
  border-radius: 2px;
}

.mock-heading.bar {
  background: #667eea;
}

.mock-line {
  height: 6px;
  border-radius: 3px;
  background: #dcdce6;
}

.w85 {
  width: 85%;
}

.w80 {
  width: 80%;
}

.w70 {
  width: 70%;
}

.w50 {
  width: 50%;
}

.mock-gap {
  height: 10px;
}

.card-name {
  margin-top: 12px;
  font-size: 15px;
  font-weight: 600;
  color: #24242e;
}

.card-desc {
  margin-top: 5px;
  font-size: 12px;
  line-height: 1.65;
  color: #9a9aae;
}

.start-recent {
  margin-top: 28px;
  width: 524px;
  max-width: calc(100vw - 48px);
}

.import-entry {
  margin-top: 22px;
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
