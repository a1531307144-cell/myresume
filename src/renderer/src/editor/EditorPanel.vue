<script setup lang="ts">
import { useResumeStore } from '@renderer/stores/resume'
import type { SectionPreset } from '@shared/sectionPresets'
import SectionCard from './SectionCard.vue'
import SectionPicker from './SectionPicker.vue'
import './editors.css'

const { store, addSection, reorderSection } = useResumeStore()

function onPick(preset: SectionPreset): void {
  addSection(preset)
}

// 板块拖拽排序（原生 HTML5 拖拽，与上移/下移按钮并存）
let dragSectionId = ''

function onDragStart(e: DragEvent, id: string): void {
  dragSectionId = id
  if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
}

function onDragOver(e: DragEvent): void {
  e.preventDefault()
}

function onDrop(e: DragEvent, targetId: string): void {
  e.preventDefault()
  if (dragSectionId && dragSectionId !== targetId) {
    reorderSection(dragSectionId, targetId)
  }
  dragSectionId = ''
}
</script>

<template>
  <div class="editor-panel">
    <div class="editor-scroll">
      <SectionCard
        v-for="s in store.doc.sections"
        :key="s.id"
        :section="s"
        draggable="true"
        @dragstart="onDragStart($event, s.id)"
        @dragover="onDragOver"
        @drop="onDrop($event, s.id)"
      />
      <div class="editor-bottom-space"></div>
    </div>
    <div class="editor-footer">
      <SectionPicker @select="onPick" />
    </div>
  </div>
</template>

<style scoped>
.editor-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: #f7f7fb;
}

.editor-scroll {
  flex: 1;
  overflow-y: auto;
  padding: 14px 14px 0;
}

.editor-bottom-space {
  height: 8px;
}

.editor-footer {
  padding: 10px 14px 14px;
  border-top: 1px solid #ececf3;
  background: #f7f7fb;
}
</style>
