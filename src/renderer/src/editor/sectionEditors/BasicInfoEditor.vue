<script setup lang="ts">
import { computed } from 'vue'
import type { BasicInfoData, Section } from '@shared/schema'
import { uid } from '@shared/id'
import PhotoPicker from '../PhotoPicker.vue'

const props = defineProps<{ section: Section }>()
const data = computed({
  get: () => props.section.data as BasicInfoData,
  set: (v) => Object.assign(props.section.data as BasicInfoData, v)
})

function addContact(): void {
  data.value.contacts.push({ id: uid(), label: '', value: '' })
}

function removeContact(id: string): void {
  const i = data.value.contacts.findIndex((c) => c.id === id)
  if (i >= 0) data.value.contacts.splice(i, 1)
}
</script>

<template>
  <div>
    <div class="ed-row">
      <PhotoPicker :photo="data.photo" @update:photo="data.photo = $event" />
      <div style="flex: 1; min-width: 0">
        <div class="ed-row" style="margin-bottom: 8px">
          <div class="ed-field">
            <label class="ed-label">姓名</label>
            <input v-model="data.name" class="ed-inp" placeholder="请输入姓名" />
          </div>
        </div>
        <div class="ed-row" style="margin-bottom: 0">
          <div class="ed-field">
            <label class="ed-label">联系方式（左侧标签可改，如「电话」「邮箱」）</label>
          </div>
        </div>
      </div>
    </div>

    <div v-for="c in data.contacts" :key="c.id" class="ed-row contact-row">
      <input v-model="c.label" class="ed-inp" style="flex: 0 0 96px" placeholder="标签" />
      <input v-model="c.value" class="ed-inp" style="flex: 1" placeholder="内容" />
      <button class="ed-btn danger" title="删除此行" @click="removeContact(c.id)">✕</button>
    </div>

    <button class="ed-add" @click="addContact">＋ 添加联系方式</button>
  </div>
</template>

<style scoped>
.contact-row {
  align-items: center;
}
</style>
