<script setup lang="ts">
import { computed } from 'vue'
import type { EducationData, EducationItem, Section } from '@shared/schema'
import { uid } from '@shared/id'

const props = defineProps<{ section: Section }>()
const data = computed(() => props.section.data as EducationData)

function addItem(): void {
  data.value.items.push({ id: uid(), school: '', degree: '', date: '', extras: [] })
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

function onExtras(item: EducationItem, e: Event): void {
  item.extras = (e.target as HTMLTextAreaElement).value.split('\n')
}
</script>

<template>
  <div>
    <div v-for="(item, idx) in data.items" :key="item.id" class="ed-item-card">
      <div class="ed-item-head">
        <span class="ed-item-title">教育经历 {{ idx + 1 }}</span>
        <span>
          <button class="ed-btn" title="上移" @click="moveItem(item.id, -1)">↑</button>
          <button class="ed-btn" style="margin: 0 4px" title="下移" @click="moveItem(item.id, 1)">↓</button>
          <button class="ed-btn danger" title="删除" @click="removeItem(item.id)">✕</button>
        </span>
      </div>
      <div class="ed-row">
        <div class="ed-field">
          <label class="ed-label">学校</label>
          <input v-model="item.school" class="ed-inp" placeholder="请输入学校名称" />
        </div>
        <div class="ed-field narrow">
          <label class="ed-label">时间</label>
          <input v-model="item.date" class="ed-inp" placeholder="如 2023.09–2027.06" />
        </div>
      </div>
      <div class="ed-row">
        <div class="ed-field">
          <label class="ed-label">学位 / 专业</label>
          <input v-model="item.degree" class="ed-inp" placeholder="如 法学（民商法方向）本科" />
        </div>
      </div>
      <div class="ed-row">
        <div class="ed-field">
          <label class="ed-label">补充（每行一条，如 GPA、排名、主修课程）</label>
          <textarea
            class="ed-inp"
            placeholder="如：&#10;GPA 3.9 / 4.0（专业前 5%）&#10;主修：民法、商法、民事诉讼法"
            :value="item.extras.join('\n')"
            @input="onExtras(item, $event)"
          ></textarea>
        </div>
      </div>
    </div>
    <button class="ed-add" @click="addItem">＋ 添加教育经历</button>
  </div>
</template>
