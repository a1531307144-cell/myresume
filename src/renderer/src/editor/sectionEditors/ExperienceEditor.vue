<script setup lang="ts">
import { computed } from 'vue'
import type { ExperienceData, ExperienceItem, Section } from '@shared/schema'
import { uid } from '@shared/id'

const props = defineProps<{ section: Section }>()
const data = computed(() => props.section.data as ExperienceData)

function addItem(): void {
  data.value.items.push({ id: uid(), title: '', date: '', role: '', details: [] })
}

function removeItem(id: string): void {
  const i = data.value.items.findIndex((x) => x.id === id)
  if (i >= 0) data.value.items.splice(i, 1)
}

function moveItem(id: string, dir: -1 | 1): void {
  const arr = data.value.items
  const i = arr.findIndex((x) => x.id === id)
  const j = i + dir
  if (i < 0 || j < 0 || j >= arr.length) return
  ;[arr[i], arr[j]] = [arr[j]!, arr[i]!]
}

function onDetails(item: ExperienceItem, e: Event): void {
  item.details = (e.target as HTMLTextAreaElement).value.split('\n')
}
</script>

<template>
  <div>
    <div v-for="(item, idx) in data.items" :key="item.id" class="ed-item-card">
      <div class="ed-item-head">
        <span class="ed-item-title">条目 {{ idx + 1 }}</span>
        <span>
          <button class="ed-btn" title="上移" @click="moveItem(item.id, -1)">↑</button>
          <button class="ed-btn" style="margin: 0 4px" title="下移" @click="moveItem(item.id, 1)">↓</button>
          <button class="ed-btn danger" title="删除" @click="removeItem(item.id)">✕</button>
        </span>
      </div>
      <div class="ed-row">
        <div class="ed-field">
          <label class="ed-label">名称（单位 / 课题 / 项目 / 组织）</label>
          <input v-model="item.title" class="ed-inp" placeholder="请输入名称" />
        </div>
        <div class="ed-field narrow">
          <label class="ed-label">时间</label>
          <input v-model="item.date" class="ed-inp" placeholder="如 2025.06–2025.09" />
        </div>
      </div>
      <div class="ed-row">
        <div class="ed-field">
          <label class="ed-label">职务 / 角色（可留空）</label>
          <input v-model="item.role" class="ed-inp" placeholder="如 项目负责人、实习生" />
        </div>
      </div>
      <div class="ed-row">
        <div class="ed-field">
          <label class="ed-label">具体内容（每行一条）</label>
          <textarea
            class="ed-inp"
            placeholder="如：&#10;负责……的整理与分析&#10;撰写……报告并获得……"
            :value="item.details.join('\n')"
            @input="onDetails(item, $event)"
          ></textarea>
        </div>
      </div>
    </div>
    <button class="ed-add" @click="addItem">＋ 添加条目</button>
  </div>
</template>
