<script setup lang="ts">
import { useResumeStore } from '@renderer/stores/resume'
import { SECTION_PRESETS } from '@shared/sectionPresets'

const { addSection } = useResumeStore()
/** 空状态下快捷添加两个最常用板块 */
const quickPresets = SECTION_PRESETS.filter((p) => p.defaultTitle === '教育背景' || p.defaultTitle === '实习经历')
</script>

<template>
  <div class="empty-preview">
    <div class="empty-page">
      <span class="empty-line title"></span>
      <span class="empty-line"></span>
      <span class="empty-line w60"></span>
      <span class="empty-line w80"></span>
      <span class="empty-line w70"></span>
      <span class="empty-line"></span>
    </div>
    <div class="empty-text">
      <h3>从一份空白简历开始</h3>
      <p>在左侧填写姓名和联系方式，内容会实时出现在这里</p>
      <p class="sub">这里的排版与导出的 PDF 完全一致</p>
      <div class="quick">
        <button v-for="p in quickPresets" :key="p.defaultTitle" class="quick-btn" @click="addSection(p)">
          ＋ {{ p.defaultTitle }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.empty-preview {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 48px;
  padding: 48px 24px;
  flex-wrap: wrap;
}

.empty-page {
  width: 260px;
  height: 350px;
  background: #fff;
  border: 1px solid #e0e0ea;
  border-radius: 4px;
  padding: 36px 28px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  box-shadow: 0 2px 12px rgba(30, 34, 60, 0.08);
}

.empty-line {
  height: 10px;
  border-radius: 3px;
  background: #ecEDf3;
}

.title {
  width: 45%;
  height: 22px;
  background: #dcdce6;
  margin-bottom: 14px;
}

.w80 {
  width: 80%;
}

.w70 {
  width: 70%;
}

.w60 {
  width: 60%;
}

.empty-text {
  max-width: 320px;
}

.empty-text h3 {
  font-size: 18px;
  color: #24242e;
  margin: 0 0 10px;
}

.empty-text p {
  font-size: 13px;
  color: #7c7c92;
  margin: 0 0 6px;
  line-height: 1.7;
}

.sub {
  font-size: 12px;
  color: #b3b3c4;
}

.quick {
  margin-top: 18px;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.quick-btn {
  padding: 6px 14px;
  border: 1px solid #667eea;
  background: #fff;
  color: #667eea;
  border-radius: 6px;
  font-size: 13px;
}

.quick-btn:hover {
  background: #667eea;
  color: #fff;
}
</style>
