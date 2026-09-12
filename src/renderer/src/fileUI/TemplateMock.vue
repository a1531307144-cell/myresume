<script setup lang="ts">
import type { TemplateMock } from '@renderer/preview/templates'

/**
 * 起始页卡片上的版式示意。
 * 这里画的是抽象小样（灰条代表文字），不依赖任何真实简历数据
 * —— 项目从一开始就坚持「仓库与安装包不含任何示例简历」。
 */
defineProps<{ kind: TemplateMock; accent: string }>()
</script>

<template>
  <div class="mock" :class="`m-${kind}`" :style="{ '--accent': accent }">
    <!-- 顶部色带 -->
    <div v-if="kind === 'topband'" class="band">
      <span class="band-name"></span>
      <span class="band-photo"></span>
    </div>

    <!-- 深色侧栏 -->
    <div v-if="kind === 'sidebar'" class="side">
      <span class="side-photo"></span>
      <span class="side-bar w70"></span>
      <span class="side-bar w55"></span>
      <span class="side-bar w65"></span>
    </div>

    <div class="body">
      <!-- 姓名行 -->
      <div class="name-row">
        <span class="name" :class="{ accent: kind !== 'classic' }"></span>
        <span v-if="kind === 'classic'" class="photo"></span>
      </div>
      <span class="sub w50"></span>

      <div class="gap"></div>

      <!-- 板块：时间轴带圆点 -->
      <template v-for="n in 2" :key="n">
        <div class="heading-row">
          <span v-if="kind === 'timeline'" class="dot"></span>
          <span class="heading" :class="{ bar: kind !== 'classic' && kind !== 'grid' }"></span>
          <span v-if="kind === 'timeline'" class="en"></span>
        </div>
        <span class="line" :class="{ rule: kind === 'grid' }"></span>
        <span class="line w80" :class="{ rule: kind === 'grid' }"></span>
        <div v-if="n === 1" class="gap-sm"></div>
      </template>
    </div>

    <!-- 时间轴竖线 -->
    <span v-if="kind === 'timeline'" class="tl-line"></span>
  </div>
</template>

<style scoped>
.mock {
  position: relative;
  height: 142px;
  border-radius: 8px;
  border: 1px solid #dfe1ea;
  background: #fff;
  overflow: hidden;
  display: flex;
  padding: 13px 15px;
  gap: 12px;
}

.body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

/* ————— 通用灰条 ————— */
.name {
  height: 12px;
  width: 76px;
  border-radius: 2px;
  background: #2c2c34;
}

.name.accent {
  background: var(--accent);
}

.sub {
  height: 6px;
  border-radius: 3px;
  background: #dfe1ea;
}

.heading {
  height: 7px;
  width: 52px;
  border-radius: 2px;
  background: #8d90a3;
}

.heading.bar {
  background: var(--accent);
}

.line {
  height: 5px;
  border-radius: 3px;
  background: #e6e8f0;
}

.line.rule {
  border-bottom: 1px solid #d3d6e0;
  border-radius: 0;
  background: transparent;
  height: 1px;
}

.w80 {
  width: 80%;
}

.w70 {
  width: 70%;
}

.w65 {
  width: 65%;
}

.w55 {
  width: 55%;
}

.w50 {
  width: 50%;
}

.gap {
  height: 6px;
}

.gap-sm {
  height: 4px;
}

.name-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
}

.heading-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

/* ————— 顶部色带 ————— */
.m-topband {
  padding-top: 0;
  flex-direction: column;
  gap: 10px;
}

.m-topband .band {
  margin: 0 -15px;
  padding: 11px 15px;
  background: var(--accent);
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.band-name {
  width: 66px;
  height: 11px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.92);
}

.band-photo {
  width: 22px;
  height: 28px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.18);
}

.m-topband .body {
  padding-top: 2px;
}

/* ————— 深色侧栏 ————— */
.m-sidebar {
  padding: 0;
  gap: 0;
}

.m-sidebar .side {
  width: 62px;
  flex-shrink: 0;
  padding: 12px 9px;
  background: var(--accent);
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.side-photo {
  width: 26px;
  height: 32px;
  margin: 0 auto 5px;
  border: 1px solid rgba(255, 255, 255, 0.6);
  background: rgba(255, 255, 255, 0.16);
}

.side-bar {
  height: 4px;
  border-radius: 2px;
  background: rgba(255, 255, 255, 0.42);
}

.m-sidebar .body {
  padding: 13px 12px;
}

.m-sidebar .photo {
  display: none;
}

/* ————— 时间轴 ————— */
.m-timeline .body {
  padding-left: 14px;
}

.tl-line {
  position: absolute;
  left: 22px;
  top: 34px;
  bottom: 14px;
  border-left: 1.5px dotted #c7cbe0;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #fff;
  border: 2px solid var(--accent);
  margin-left: -17px;
  flex-shrink: 0;
}

.en {
  width: 24px;
  height: 4px;
  border-radius: 2px;
  background: #e0e2ee;
}

/* ————— 表格线框 ————— */
.m-grid {
  border-color: #c4c8d4;
}

.m-grid .name-row {
  border-bottom: 1px solid #c4c8d4;
  padding-bottom: 6px;
}

.m-grid .heading {
  background: transparent;
  border-bottom: 2px solid var(--accent);
  border-radius: 0;
  height: 6px;
}

.m-grid .line.rule {
  border-bottom-color: #dfe1ea;
}

/* ————— 法学正式风 / 通用简约风（沿用原卡片的观感） ————— */
.m-classic .photo,
.photo {
  width: 24px;
  height: 30px;
  border: 1px solid #b9b9c6;
  background: #fbfbfd;
  flex-shrink: 0;
}

.m-classic .heading {
  background: #2c2c34;
}

.m-simple .heading {
  background: var(--accent);
}
</style>
