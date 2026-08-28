<script setup lang="ts">
import { computed } from 'vue'
import type { BasicInfoData, ResumeDocument, SectionType } from '@shared/schema'
import { isSectionEmpty } from '@shared/sectionDefs'
import { typographyStyle } from '@shared/fonts'
import LawBasicInfo from './sections/LawBasicInfo.vue'
import LawEducation from './sections/LawEducation.vue'
import LawExperience from './sections/LawExperience.vue'
import LawListBlock from './sections/LawListBlock.vue'
import LawTextBlock from './sections/LawTextBlock.vue'

const props = defineProps<{ doc: ResumeDocument }>()

const RENDERERS: Record<SectionType, unknown> = {
  basicInfo: LawBasicInfo,
  education: LawEducation,
  experience: LawExperience,
  listBlock: LawListBlock,
  textBlock: LawTextBlock
}

const basicSection = computed(() => props.doc.sections.find((s) => s.type === 'basicInfo'))
const basicData = computed<BasicInfoData | null>(() =>
  basicSection.value ? (basicSection.value.data as BasicInfoData) : null
)
const showHeader = computed(() => (basicSection.value ? !isSectionEmpty(basicSection.value) : false))
const filledContacts = computed(() => (basicData.value?.contacts ?? []).filter((c) => c.value.trim()))
const contentSections = computed(() => props.doc.sections.filter((s) => s.type !== 'basicInfo' && !isSectionEmpty(s)))
const pageStyle = computed(() => typographyStyle(props.doc))
</script>

<template>
  <div class="resume-page tpl-law" :style="pageStyle">
    <header v-if="showHeader && basicData" class="law-header">
      <div class="law-title-block">
        <h1 class="law-name">{{ basicData.name }}</h1>
        <p class="law-contacts">
          <span v-for="c in filledContacts" :key="c.id" class="law-contact">{{ c.label }}：{{ c.value }}</span>
        </p>
      </div>
      <img v-if="basicData.photo" :src="basicData.photo.dataUrl" class="law-photo" alt="证件照" />
    </header>

    <section v-for="s in contentSections" :key="s.id" class="section">
      <h2 class="section-title">{{ s.title }}</h2>
      <component :is="RENDERERS[s.type]" :section="s" />
    </section>
  </div>
</template>

<style scoped>
.tpl-law {
  font-family: 'SimSun', '宋体', 'Songti SC', serif;
  font-size: 14px;
  line-height: 1.75;
  color: #000;
  background: #fff;
  width: 210mm;
  min-height: 297mm;
  padding: 15mm;
}

.law-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
}

.law-title-block {
  flex: 1;
  min-width: 0;
}

.law-name {
  font-family: 'SimHei', '黑体', 'Microsoft YaHei', sans-serif;
  font-size: 1.9em;
  font-weight: 700;
  margin: 0;
  letter-spacing: 0.08em;
}

.law-contacts {
  margin: 0.85em 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.15em 1.5em;
  font-size: 0.95em;
}

.law-photo {
  width: 100px;
  height: 130px;
  object-fit: cover;
  border: 1px solid #000;
  margin-left: 20px;
  flex-shrink: 0;
}

.section {
  margin-top: 1.2em;
}

.section-title {
  font-family: 'SimHei', '黑体', 'Microsoft YaHei', sans-serif;
  font-size: 1.15em;
  font-weight: 700;
  border-bottom: 1.5px solid #000;
  padding-bottom: 0.2em;
  margin: 0 0 0.55em;
}
</style>
