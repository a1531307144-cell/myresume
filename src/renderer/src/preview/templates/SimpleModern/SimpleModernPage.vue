<script setup lang="ts">
import { computed } from 'vue'
import type { BasicInfoData, ResumeDocument, SectionType } from '@shared/schema'
import { isSectionEmpty } from '@shared/sectionDefs'
import { typographyStyle } from '@shared/fonts'
import SimpleBasicInfo from './sections/SimpleBasicInfo.vue'
import SimpleEducation from './sections/SimpleEducation.vue'
import SimpleExperience from './sections/SimpleExperience.vue'
import SimpleListBlock from './sections/SimpleListBlock.vue'
import SimpleTextBlock from './sections/SimpleTextBlock.vue'

const props = defineProps<{ doc: ResumeDocument }>()

const RENDERERS: Record<SectionType, unknown> = {
  basicInfo: SimpleBasicInfo,
  education: SimpleEducation,
  experience: SimpleExperience,
  listBlock: SimpleListBlock,
  textBlock: SimpleTextBlock
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
  <div class="resume-page tpl-simple" :style="pageStyle">
    <header v-if="showHeader && basicData" class="s-header">
      <div class="s-title-block">
        <h1 class="s-name">{{ basicData.name }}</h1>
        <p class="s-contacts">
          <span v-for="c in filledContacts" :key="c.id" class="s-contact">
            <span class="s-contact-label">{{ c.label }}</span> {{ c.value }}
          </span>
        </p>
      </div>
      <img v-if="basicData.photo" :src="basicData.photo.dataUrl" class="s-photo" alt="证件照" />
    </header>

    <section v-for="s in contentSections" :key="s.id" class="section">
      <h2 class="section-title">{{ s.title }}</h2>
      <component :is="RENDERERS[s.type]" :section="s" />
    </section>
  </div>
</template>

<style scoped>
.tpl-simple {
  font-family: 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', sans-serif;
  font-size: 14px;
  line-height: 1.7;
  color: #2f2f3a;
  background: #fff;
  width: 210mm;
  min-height: 297mm;
  padding: 18mm;
}

.s-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding-bottom: 1em;
  border-bottom: 2px solid #1f1f28;
}

.s-title-block {
  flex: 1;
  min-width: 0;
}

.s-name {
  font-size: 2.1em;
  font-weight: 600;
  color: #1f1f28;
  margin: 0;
  letter-spacing: 0.04em;
}

.s-contacts {
  margin: 0.6em 0 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.2em 1.4em;
  font-size: 0.92em;
  color: #7a7a8c;
}

.s-contact-label {
  color: #667eea;
}

.s-photo {
  width: 100px;
  height: 130px;
  object-fit: cover;
  border-radius: 6px;
  margin-left: 20px;
  flex-shrink: 0;
}

.section {
  margin-top: 1.6em;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5em;
  font-size: 1.08em;
  font-weight: 600;
  color: #1f1f28;
  padding-bottom: 0.35em;
  border-bottom: 1px solid #eceef4;
  margin: 0 0 0.7em;
}

.section-title::before {
  content: '';
  width: 4px;
  height: 1em;
  background: #667eea;
  border-radius: 2px;
  flex-shrink: 0;
}
</style>
