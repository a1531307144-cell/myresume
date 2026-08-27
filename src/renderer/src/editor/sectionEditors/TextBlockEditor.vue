<script setup lang="ts">
import { computed } from 'vue'
import type { Section, TextBlockData } from '@shared/schema'
import { uid } from '@shared/id'

const props = defineProps<{ section: Section }>()
const data = computed(() => props.section.data as TextBlockData)

function addParagraph(): void {
  data.value.paragraphs.push('')
}

function removeParagraph(i: number): void {
  if (data.value.paragraphs.length > 1) {
    data.value.paragraphs.splice(i, 1)
  }
}
</script>

<template>
  <div>
    <div v-for="(p, i) in data.paragraphs" :key="i" class="ed-row" style="align-items: flex-end">
      <div class="ed-field">
        <label class="ed-label">第 {{ i + 1 }} 段</label>
        <textarea v-model="data.paragraphs[i]" class="ed-inp" placeholder="请输入内容…"></textarea>
      </div>
      <button
        v-if="data.paragraphs.length > 1"
        class="ed-btn danger"
        style="margin-bottom: 2px"
        title="删除此段"
        @click="removeParagraph(i)"
      >
        ✕
      </button>
    </div>
    <button class="ed-add" @click="addParagraph">＋ 添加段落</button>
  </div>
</template>
