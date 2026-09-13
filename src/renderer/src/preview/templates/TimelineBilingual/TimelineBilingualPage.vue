<script setup lang="ts">
import { computed } from 'vue'
import type { BasicInfoData, ResumeDocument, SectionType } from '@shared/schema'
import { isSectionEmpty } from '@shared/sectionDefs'
import { otherContacts, readJobTarget } from '@shared/basicInfo'
import { typographyStyle } from '@shared/fonts'
import TimelineBasicInfo from './sections/TimelineBasicInfo.vue'
import TimelineEducation from './sections/TimelineEducation.vue'
import TimelineExperience from './sections/TimelineExperience.vue'
import TimelineListBlock from './sections/TimelineListBlock.vue'
import TimelineTextBlock from './sections/TimelineTextBlock.vue'

/** 时间轴：左侧竖点线串起各板块，板块标题中英双语。 */

const props = defineProps<{ doc: ResumeDocument }>()

const RENDERERS: Record<SectionType, unknown> = {
  basicInfo: TimelineBasicInfo,
  education: TimelineEducation,
  experience: TimelineExperience,
  listBlock: TimelineListBlock,
  textBlock: TimelineTextBlock
}

/**
 * 英文副标题：优先按**用户填的中文标题**关键词匹配，匹配不到再退回按板块类型。
 * 只按类型的话，「技能证书」和「荣誉奖项」同属 listBlock，会重复显示同一句英文。
 */
const EN_BY_KEYWORD: [RegExp, string][] = [
  [/奖|荣誉|表彰/, 'Honors'],
  [/证|资格|执照/, 'Certificates'],
  [/技能|专长|语言/, 'Skills'],
  [/课程/, 'Coursework'],
  [/项目|课题/, 'Projects'],
  [/实习|工作|职业/, 'Experience'],
  [/教育|学历|学习/, 'Education'],
  [/科研|研究|论文/, 'Research'],
  [/校园|社团|学生工作/, 'Campus'],
  [/兴趣|爱好/, 'Interests'],
  [/评价|自述|简介|概述/, 'About Me'],
  [/其他|其它|补充/, 'Other']
]

const EN_LABEL: Record<SectionType, string> = {
  basicInfo: 'Profile',
  education: 'Education',
  experience: 'Experience',
  listBlock: 'Highlights',
  textBlock: 'About Me'
}

function enLabel(title: string, type: SectionType): string {
  for (const [re, en] of EN_BY_KEYWORD) {
    if (re.test(title)) return en
  }
  return EN_LABEL[type]
}

const basicSection = computed(() => props.doc.sections.find((s) => s.type === 'basicInfo'))
const basicData = computed<BasicInfoData | null>(() =>
  basicSection.value ? (basicSection.value.data as BasicInfoData) : null
)
const jobTarget = computed(() => readJobTarget(props.doc.sections))
const contacts = computed(() => otherContacts(basicData.value?.contacts))
const contentSections = computed(() =>
  props.doc.sections.filter((s) => s.type !== 'basicInfo' && !isSectionEmpty(s))
)
const pageStyle = computed(() => typographyStyle(props.doc))
</script>

<template>
  <div class="resume-page tpl-timeline" :style="pageStyle">
    <header v-if="basicData" class="tl-head">
      <div class="tl-identity">
        <p class="tl-eyebrow">个人简历 · RESUME</p>
        <h1 class="tl-name">{{ basicData.name }}</h1>
        <p v-if="jobTarget" class="tl-target">{{ jobTarget }}</p>
        <p v-if="contacts.length" class="tl-contacts">
          <span v-for="c in contacts" :key="c.id" class="tl-contact">
            <span class="tl-contact-label">{{ c.label }}</span>{{ c.value }}
          </span>
        </p>
      </div>
      <img v-if="basicData.photo" :src="basicData.photo.dataUrl" class="tl-photo" alt="证件照" />
    </header>

    <div class="tl-body">
      <section v-for="s in contentSections" :key="s.id" class="section">
        <h2 class="section-title">
          <span class="tl-cn">{{ s.title }}</span>
          <span class="tl-en">{{ enLabel(s.title, s.type) }}</span>
        </h2>
        <component :is="RENDERERS[s.type]" :section="s" />
      </section>
    </div>
  </div>
</template>

<style scoped>
.tpl-timeline {
  width: 210mm;
  min-height: 297mm;
  padding: 18mm;
  background: #fff;
  color: #2c2c38;
  font-family: 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', sans-serif;
  font-size: 14px;
  line-height: 1.7;
}

.tl-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 20px;
  padding-bottom: 1.2em;
  border-bottom: 1px solid #e7e9f2;
}

.tl-identity {
  flex: 1;
  min-width: 0;
}

.tl-eyebrow {
  margin: 0 0 0.35em;
  font-size: 0.82em;
  letter-spacing: 0.3em;
  color: #8f97b3;
}

.tl-name {
  margin: 0;
  font-size: 2.05em;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #2c2c38;
}

.tl-target {
  margin: 0.4em 0 0;
  font-size: 0.98em;
  color: #667eea;
}

.tl-contacts {
  margin: 0.7em 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.25em 1.5em;
  font-size: 0.9em;
  color: #6f7590;
}

.tl-contact-label {
  margin-right: 0.45em;
  color: #a0a6bf;
}

.tl-photo {
  width: 92px;
  height: 92px;
  object-fit: cover;
  border-radius: 50%;
  border: 3px solid #eef0f9;
  flex-shrink: 0;
}

/* 竖点线：整条线画在容器上，各板块标题上的圆点压在线上 */
.tl-body {
  position: relative;
  margin-top: 1.5em;
  padding-left: 30px;
}

.tl-body::before {
  content: '';
  position: absolute;
  left: 5px;
  top: 0.55em;
  bottom: 0.3em;
  border-left: 2px dotted #cdd3e6;
}

.section {
  position: relative;
  margin-top: 1.7em;
}

.section:first-child {
  margin-top: 0;
}

.section-title {
  position: relative;
  display: flex;
  align-items: baseline;
  gap: 0.7em;
  margin: 0 0 0.7em;
  font-size: 1.1em;
  font-weight: 700;
  color: #2c2c38;
  letter-spacing: 0.04em;
}

/* 圆点：标题左边距内 30px、线在 x=5..7（中心 6），
   圆点相对标题左移 30px 且自身宽 12px，圆心正好落在 6px 上 */
.section-title::before {
  content: '';
  position: absolute;
  left: -30px;
  top: 0.3em;
  width: 12px;
  height: 12px;
  box-sizing: border-box;
  border-radius: 50%;
  background: #fff;
  border: 3px solid #667eea;
}

.tl-en {
  font-size: 0.74em;
  font-weight: 400;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: #a6acce;
}
</style>
