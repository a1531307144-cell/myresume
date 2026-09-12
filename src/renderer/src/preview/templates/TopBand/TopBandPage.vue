<script setup lang="ts">
import { computed } from 'vue'
import type { BasicInfoData, ContactField, ResumeDocument, SectionType } from '@shared/schema'
import { isSectionEmpty } from '@shared/sectionDefs'
import { typographyStyle } from '@shared/fonts'
import TopBandBasicInfo from './sections/TopBandBasicInfo.vue'
import TopBandEducation from './sections/TopBandEducation.vue'
import TopBandExperience from './sections/TopBandExperience.vue'
import TopBandListBlock from './sections/TopBandListBlock.vue'
import TopBandTextBlock from './sections/TopBandTextBlock.vue'

/** 顶部色带：整幅色带放姓名与求职意向，下面单栏大留白——最干净百搭。 */

const props = defineProps<{ doc: ResumeDocument }>()

const RENDERERS: Record<SectionType, unknown> = {
  basicInfo: TopBandBasicInfo,
  education: TopBandEducation,
  experience: TopBandExperience,
  listBlock: TopBandListBlock,
  textBlock: TopBandTextBlock
}

const JOB_LABEL = /求职意向|求职方向|意向岗位|目标岗位|应聘岗位/

const basicSection = computed(() => props.doc.sections.find((s) => s.type === 'basicInfo'))
const basicData = computed<BasicInfoData | null>(() =>
  basicSection.value ? (basicSection.value.data as BasicInfoData) : null
)
const jobTarget = computed(
  () => (basicData.value?.contacts ?? []).find((c) => JOB_LABEL.test(c.label ?? ''))?.value.trim() ?? ''
)
const contacts = computed<ContactField[]>(() =>
  (basicData.value?.contacts ?? []).filter((c) => c.value.trim() && !JOB_LABEL.test(c.label ?? ''))
)
const contentSections = computed(() =>
  props.doc.sections.filter((s) => s.type !== 'basicInfo' && !isSectionEmpty(s))
)
const pageStyle = computed(() => typographyStyle(props.doc))
</script>

<template>
  <div class="resume-page tpl-topband" :style="pageStyle">
    <header v-if="basicData" class="tb-band">
      <div class="tb-identity">
        <h1 class="tb-name">{{ basicData.name }}</h1>
        <p v-if="jobTarget" class="tb-target">{{ jobTarget }}</p>
      </div>
      <img v-if="basicData.photo" :src="basicData.photo.dataUrl" class="tb-photo" alt="证件照" />
    </header>

    <div v-if="contacts.length" class="tb-contacts">
      <span v-for="c in contacts" :key="c.id" class="tb-contact line">
        <span class="tb-contact-label">{{ c.label }}</span>{{ c.value }}
      </span>
    </div>

    <main class="tb-main">
      <section v-for="s in contentSections" :key="s.id" class="section">
        <h2 class="section-title">{{ s.title }}</h2>
        <component :is="RENDERERS[s.type]" :section="s" />
      </section>
    </main>
  </div>
</template>

<style scoped>
.tpl-topband {
  width: 210mm;
  min-height: 297mm;
  padding: 0;
  background: #fff;
  color: #2e2e3a;
  font-family: 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', sans-serif;
  font-size: 14px;
  line-height: 1.75;
}

.tb-band {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 13mm 18mm 11mm;
  background: #35406b;
  color: #fff;
}

.tb-identity {
  min-width: 0;
}

.tb-name {
  margin: 0;
  font-size: 2.2em;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: #fff;
}

.tb-target {
  margin: 0.4em 0 0;
  font-size: 1em;
  letter-spacing: 0.06em;
  color: #c3caea;
}

.tb-photo {
  width: 30mm;
  height: 38mm;
  object-fit: cover;
  flex-shrink: 0;
  border: 2px solid rgba(255, 255, 255, 0.7);
}

.tb-contacts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3em 2em;
  padding: 5mm 18mm;
  background: #f4f5fa;
  font-size: 0.92em;
  color: #4d5470;
}

.tb-contact-label {
  margin-right: 0.5em;
  color: #8f96b5;
}

.tb-main {
  padding: 8mm 18mm 16mm;
}

.section {
  margin-top: 1.7em;
}

.section:first-child {
  margin-top: 0;
}

.section-title {
  position: relative;
  margin: 0 0 0.75em;
  padding-bottom: 0.32em;
  font-size: 1.1em;
  font-weight: 700;
  letter-spacing: 0.14em;
  color: #2b3050;
  border-bottom: 1px solid #e4e7f1;
}

/* 短下划线：在整条细线之上压一段主色，作为该模板的标志性装饰 */
.section-title::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: -1px;
  width: 2.6em;
  height: 2px;
  background: #35406b;
}
</style>
