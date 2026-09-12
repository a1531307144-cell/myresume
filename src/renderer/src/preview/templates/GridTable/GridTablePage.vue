<script setup lang="ts">
import { computed } from 'vue'
import type { BasicInfoData, ContactField, ResumeDocument, SectionType } from '@shared/schema'
import { isSectionEmpty } from '@shared/sectionDefs'
import { typographyStyle } from '@shared/fonts'
import GridBasicInfo from './sections/GridBasicInfo.vue'
import GridEducation from './sections/GridEducation.vue'
import GridExperience from './sections/GridExperience.vue'
import GridListBlock from './sections/GridListBlock.vue'
import GridTextBlock from './sections/GridTextBlock.vue'

/** 表格线框：细线分区、信息密度最高，一页能装下最多内容。 */

const props = defineProps<{ doc: ResumeDocument }>()

const RENDERERS: Record<SectionType, unknown> = {
  basicInfo: GridBasicInfo,
  education: GridEducation,
  experience: GridExperience,
  listBlock: GridListBlock,
  textBlock: GridTextBlock
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
  <div class="resume-page tpl-grid" :style="pageStyle">
    <header v-if="basicData" class="gr-head">
      <div class="gr-fields">
        <span class="gr-key">姓名</span>
        <span class="gr-val strong">{{ basicData.name }}</span>
        <span class="gr-key">求职意向</span>
        <span class="gr-val">{{ jobTarget }}</span>
        <template v-if="contacts.length">
          <span class="gr-key">联系方式</span>
          <span class="gr-val contacts">
            <span v-for="c in contacts" :key="c.id" class="gr-c">
              <span class="gr-c-label">{{ c.label }}</span>{{ c.value }}
            </span>
          </span>
        </template>
      </div>
      <div v-if="basicData.photo" class="gr-photo">
        <img :src="basicData.photo.dataUrl" alt="证件照" />
      </div>
    </header>

    <section v-for="s in contentSections" :key="s.id" class="section">
      <h2 class="section-title">{{ s.title }}</h2>
      <component :is="RENDERERS[s.type]" :section="s" />
    </section>
  </div>
</template>

<style scoped>
.tpl-grid {
  width: 210mm;
  min-height: 297mm;
  padding: 13mm 14mm;
  background: #fff;
  color: #26262f;
  font-family: 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', sans-serif;
  font-size: 13px;
  line-height: 1.62;
}

.gr-head {
  display: flex;
  align-items: stretch;
  border: 1.5px solid #26262f;
}

.gr-fields {
  flex: 1;
  min-width: 0;
  display: grid;
  /* 标签列按内容自适应（「联系方式」四个字不会被挤成竖排），值列吃掉剩余宽度 */
  grid-template-columns: max-content minmax(0, 1fr);
  align-content: center;
}

.gr-key {
  padding: 0.34em 0.75em;
  font-size: 0.92em;
  color: #6b7186;
  letter-spacing: 0.08em;
  white-space: nowrap;
  background: #f4f5f8;
  border-right: 1px solid #c9ced9;
  border-bottom: 1px solid #c9ced9;
}

.gr-val {
  padding: 0.34em 0.8em;
  min-width: 0;
  word-break: break-word;
  border-bottom: 1px solid #c9ced9;
}

/* 最后一行的下边框去掉，避免与外框叠成双线 */
.gr-key:nth-last-child(2),
.gr-val:last-child {
  border-bottom: none;
}

.gr-val.strong {
  font-size: 1.12em;
  font-weight: 700;
  letter-spacing: 0.06em;
}

.gr-val.contacts {
  display: flex;
  flex-wrap: wrap;
  gap: 0.2em 1.6em;
}

.gr-c-label {
  color: #8b90a4;
  margin-right: 0.4em;
}

.gr-photo {
  width: 26mm;
  flex-shrink: 0;
  border-left: 1.5px solid #26262f;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 2mm;
}

.gr-photo img {
  width: 100%;
  height: auto;
  max-height: 34mm;
  object-fit: cover;
  display: block;
}

.section {
  margin-top: 0.9em;
}

.section-title {
  margin: 0;
  padding: 0.28em 0.7em;
  font-size: 1em;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #26262f;
  background: #eef0f4;
  border: 1px solid #c9ced9;
  border-left: 4px solid #26262f;
}
</style>
