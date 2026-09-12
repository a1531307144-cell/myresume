<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Section, SectionType } from '@shared/schema'
import { useResumeStore } from '@renderer/stores/resume'
import { openSectionAi } from '@renderer/ai/useAiAssistant'
import BasicInfoEditor from './sectionEditors/BasicInfoEditor.vue'
import EducationEditor from './sectionEditors/EducationEditor.vue'
import ExperienceEditor from './sectionEditors/ExperienceEditor.vue'
import ListBlockEditor from './sectionEditors/ListBlockEditor.vue'
import TextBlockEditor from './sectionEditors/TextBlockEditor.vue'

const props = defineProps<{ section: Section }>()

const EDITORS: Record<SectionType, unknown> = {
  basicInfo: BasicInfoEditor,
  education: EducationEditor,
  experience: ExperienceEditor,
  listBlock: ListBlockEditor,
  textBlock: TextBlockEditor
}

const { removeSection, moveSection, renameSection } = useResumeStore()

const canDelete = computed(() => props.section.type !== 'basicInfo')
/** 基本信息里全是姓名／电话这类事实，不适合让 AI 改写，故不提供 AI 按钮 */
const canUseAi = computed(() => props.section.type !== 'basicInfo')

// 标题行内编辑
const editingTitle = ref(false)
const draftTitle = ref('')

function startEditTitle(): void {
  draftTitle.value = props.section.title
  editingTitle.value = true
}

function commitTitle(): void {
  if (draftTitle.value.trim()) renameSection(props.section.id, draftTitle.value.trim())
  editingTitle.value = false
}

// 两步删除确认（避免误删）
const confirmingDelete = ref(false)

function doDelete(): void {
  removeSection(props.section.id)
  confirmingDelete.value = false
}

// 标题编辑框自动聚焦（vFocus 命名约定 → v-focus 指令）
const vFocus = {
  mounted(el: HTMLInputElement): void {
    el.focus()
    el.select()
  }
}
</script>

<template>
  <div class="section-card" :data-section-id="section.id">
    <div class="card-head">
      <span class="drag-handle" title="拖动排序">⋮⋮</span>

      <input
        v-if="editingTitle"
        v-model="draftTitle"
        v-focus
        class="title-input"
        @blur="commitTitle"
        @keyup.enter="commitTitle"
      />
      <button v-else class="title-btn" :title="'点击修改「' + section.title + '」标题'" @click="startEditTitle">
        {{ section.title }}
      </button>

      <div class="card-actions">
        <button v-if="canUseAi" class="act ai" title="用 AI 润色或生成这个板块" @click="openSectionAi(section.id)">
          ✨AI
        </button>
        <button class="act" title="上移" @click="moveSection(section.id, -1)">↑</button>
        <button class="act" title="下移" @click="moveSection(section.id, 1)">↓</button>
        <template v-if="canDelete">
          <button v-if="!confirmingDelete" class="act danger" title="删除板块" @click="confirmingDelete = true">✕</button>
          <button v-else class="act confirm" title="再次点击确认删除" @click="doDelete">确认删除？</button>
        </template>
      </div>
    </div>

    <div class="card-body">
      <component :is="EDITORS[section.type]" :section="section" />
    </div>
  </div>
</template>

<style scoped>
.section-card {
  background: #fff;
  border: 1px solid #e6e6ef;
  border-radius: 10px;
  padding: 12px 12px 14px;
  margin-bottom: 12px;
}

.card-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.drag-handle {
  cursor: grab;
  color: #c2c2d2;
  font-size: 13px;
  letter-spacing: -2px;
  user-select: none;
}

.title-btn {
  border: 1px dashed transparent;
  background: transparent;
  font-size: 14px;
  font-weight: 600;
  color: #24242e;
  padding: 2px 6px;
  border-radius: 6px;
}

.title-btn:hover {
  border-color: #c5c5d8;
  background: #f7f7fb;
}

.title-input {
  flex: 1;
  padding: 3px 8px;
  border: 1px solid #667eea;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #24242e;
  outline: none;
}

.card-actions {
  margin-left: auto;
  display: flex;
  gap: 4px;
}

.act {
  border: 1px solid #e0e0ec;
  background: #fff;
  color: #8b8ba3;
  border-radius: 6px;
  font-size: 12px;
  padding: 2px 8px;
}

.act:hover {
  border-color: #667eea;
  color: #667eea;
}

.act.danger:hover {
  border-color: #d9534f;
  color: #d9534f;
}

.act.confirm {
  background: #d9534f;
  border-color: #d9534f;
  color: #fff;
}

.act.ai {
  border-color: #c9cdf5;
  background: #f4f5ff;
  color: #5a63d8;
  font-weight: 500;
}

.act.ai:hover {
  border-color: #667eea;
  background: #667eea;
  color: #fff;
}
</style>
