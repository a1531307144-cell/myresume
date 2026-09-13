<script setup lang="ts">
import { computed } from 'vue'
import type { BasicInfoData, ResumeDocument, Section, SectionType } from '@shared/schema'
import { isSectionEmpty } from '@shared/sectionDefs'
import { otherContacts, readJobTarget } from '@shared/basicInfo'
import { typographyStyle } from '@shared/fonts'
import SidebarBasicInfo from './sections/SidebarBasicInfo.vue'
import SidebarEducation from './sections/SidebarEducation.vue'
import SidebarExperience from './sections/SidebarExperience.vue'
import SidebarListBlock from './sections/SidebarListBlock.vue'
import SidebarTextBlock from './sections/SidebarTextBlock.vue'

/** 双栏侧边栏：左侧深色栏放照片／联系方式／条目列表（技能、证书、荣誉），主栏放经历与正文。 */

const props = defineProps<{ doc: ResumeDocument }>()

const RENDERERS: Record<SectionType, unknown> = {
  basicInfo: SidebarBasicInfo,
  education: SidebarEducation,
  experience: SidebarExperience,
  listBlock: SidebarListBlock,
  textBlock: SidebarTextBlock
}

const basicSection = computed(() => props.doc.sections.find((s) => s.type === 'basicInfo'))
const basicData = computed<BasicInfoData | null>(() =>
  basicSection.value ? (basicSection.value.data as BasicInfoData) : null
)

/** 求职意向单独提到主栏顶部醒目位置，就不在侧栏联系方式里重复出现 */
const jobTarget = computed(() => readJobTarget(props.doc.sections))
const contacts = computed(() => otherContacts(basicData.value?.contacts))

const contentSections = computed(() =>
  props.doc.sections.filter((s) => s.type !== 'basicInfo' && !isSectionEmpty(s))
)
/** 条目列表（技能证书／荣誉奖项）放侧栏，其余放主栏 */
const sideSections = computed<Section[]>(() => contentSections.value.filter((s) => s.type === 'listBlock'))
const mainSections = computed<Section[]>(() => contentSections.value.filter((s) => s.type !== 'listBlock'))

const pageStyle = computed(() => typographyStyle(props.doc))
</script>

<template>
  <div class="resume-page tpl-sidebar" :style="pageStyle">
    <aside class="sd-side">
      <img v-if="basicData?.photo" :src="basicData.photo.dataUrl" class="sd-photo" alt="证件照" />

      <section v-if="contacts.length" class="sd-block">
        <h2 class="sd-title">联系方式</h2>
        <div v-for="c in contacts" :key="c.id" class="sd-row line">
          <span class="sd-label">{{ c.label }}</span>
          <span class="sd-value">{{ c.value }}</span>
        </div>
      </section>

      <section v-for="s in sideSections" :key="s.id" class="section sd-block">
        <h2 class="section-title sd-title">{{ s.title }}</h2>
        <component :is="RENDERERS[s.type]" :section="s" />
      </section>
    </aside>

    <main class="sd-main">
      <header v-if="basicData" class="sd-head">
        <h1 class="sd-name">{{ basicData.name }}</h1>
        <p v-if="jobTarget" class="sd-target">
          <span class="sd-target-label">求职意向</span>{{ jobTarget }}
        </p>
      </header>

      <section v-for="s in mainSections" :key="s.id" class="section">
        <h2 class="section-title">{{ s.title }}</h2>
        <component :is="RENDERERS[s.type]" :section="s" />
      </section>
    </main>
  </div>
</template>

<style scoped>
.tpl-sidebar {
  display: flex;
  align-items: stretch;
  width: 210mm;
  min-height: 297mm;
  padding: 0;
  background: #fff;
  color: #2b2b36;
  font-family: 'Microsoft YaHei', 'PingFang SC', 'Noto Sans SC', sans-serif;
  font-size: 14px;
  line-height: 1.7;
}

.sd-side {
  width: 66mm;
  flex-shrink: 0;
  padding: 16mm 8mm 16mm 10mm;
  background: #3a4560;
  color: #eef0f8;
}

.sd-photo {
  display: block;
  width: 34mm;
  height: 44mm;
  object-fit: cover;
  margin: 0 auto 8mm;
  border: 2px solid rgba(255, 255, 255, 0.55);
  border-radius: 2px;
}

.sd-block {
  margin-top: 6mm;
}

.sd-block:first-of-type {
  margin-top: 0;
}

.sd-title {
  font-size: 0.95em;
  font-weight: 600;
  letter-spacing: 0.14em;
  color: #fff;
  margin: 0 0 0.55em;
  padding-bottom: 0.35em;
  border-bottom: 1px solid rgba(255, 255, 255, 0.28);
}

.sd-row {
  margin-bottom: 0.3em;
  font-size: 0.9em;
  word-break: break-all;
}

.sd-label {
  display: block;
  font-size: 0.86em;
  color: #a9b2cc;
  letter-spacing: 0.08em;
}

.sd-value {
  color: #f2f4fa;
}

.sd-main {
  flex: 1;
  min-width: 0;
  padding: 16mm 11mm;
}

.sd-head {
  padding-bottom: 1em;
  margin-bottom: 0.4em;
  border-bottom: 2px solid #3a4560;
}

.sd-name {
  font-size: 2.1em;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #2b2b36;
  margin: 0;
}

.sd-target {
  margin: 0.5em 0 0;
  font-size: 0.95em;
  color: #46527a;
}

.sd-target-label {
  display: inline-block;
  margin-right: 0.6em;
  padding: 0.06em 0.5em;
  background: #3a4560;
  color: #fff;
  font-size: 0.86em;
  letter-spacing: 0.1em;
  border-radius: 2px;
}

.section {
  margin-top: 1.5em;
}

.section-title {
  font-size: 1.05em;
  font-weight: 600;
  color: #2b2b36;
  letter-spacing: 0.1em;
  margin: 0 0 0.6em;
  padding-left: 0.6em;
  border-left: 3px solid #3a4560;
}
</style>
