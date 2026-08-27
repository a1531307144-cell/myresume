<script setup lang="ts">
import { computed } from 'vue'
import type { ListBlockData, Section } from '@shared/schema'
import { uid } from '@shared/id'

const props = defineProps<{ section: Section }>()
const data = computed(() => props.section.data as ListBlockData)

function addEntry(): void {
  data.value.entries.push({ id: uid(), label: '', text: '' })
}

function removeEntry(id: string): void {
  const i = data.value.entries.findIndex((x) => x.id === id)
  if (i >= 0) data.value.entries.splice(i, 1)
}

function moveEntry(id: string, dir: -1 | 1): void {
  const arr = data.value.entries
  const i = arr.findIndex((x) => x.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= arr.length) return
  ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
}
</script>

<template>
  <div>
    <div v-for="(entry, idx) in data.entries" :key="entry.id" class="ed-item-card">
      <div class="ed-item-head">
        <span class="ed-item-title">条目 {{ idx + 1 }}</span>
        <span>
          <button class="ed-btn" title="上移" @click="moveEntry(entry.id, -1)">↑</button>
          <button class="ed-btn" style="margin: 0 4px" title="下移" @click="moveEntry(entry.id, 1)">↓</button>
          <button class="ed-btn danger" title="删除" @click="removeEntry(entry.id)">✕</button>
        </span>
      </div>
      <div class="ed-row">
        <div class="ed-field" style="flex: 0 0 118px">
          <label class="ed-label">标签（可留空）</label>
          <input v-model="entry.label" class="ed-inp" placeholder="如 核心课程" />
        </div>
        <div class="ed-field">
          <label class="ed-label">内容</label>
          <textarea v-model="entry.text" class="ed-inp" placeholder="有标签显示为「标签：内容」，无标签显示为单独一行"></textarea>
        </div>
      </div>
    </div>
    <button class="ed-add" @click="addEntry">＋ 添加条目</button>
  </div>
</template>
