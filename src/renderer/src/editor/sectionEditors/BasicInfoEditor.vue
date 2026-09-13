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

/**
 * 常用联系方式标签备选。签名作用：像「求职意向」这种各模板会提到醒目位置的字段，
 * 用户得知道要新增一行、标签填这四个字——否则会看着模板里的位置不知道去哪儿填。
 */
const CONTACT_LABELS = ['求职意向', '电话', '邮箱', '所在地', '微信', '政治面貌', '民族', '出生年月']

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
            <label class="ed-label">联系方式（左侧标签可改；填「求职意向」会显示在简历显眼处）</label>
          </div>
        </div>
      </div>
    </div>

    <div v-for="c in data.contacts" :key="c.id" class="ed-row contact-row">
      <input v-model="c.label" class="ed-inp" list="mr-contact-labels" style="flex: 0 0 96px" placeholder="标签" />
      <input v-model="c.value" class="ed-inp" style="flex: 1" placeholder="内容" />
      <button class="ed-btn danger" title="删除此行" @click="removeContact(c.id)">✕</button>
    </div>

    <button class="ed-add" @click="addContact">＋ 添加联系方式</button>

    <!-- 标签输入框的备选（点一下输入框即可见），让常用字段能被发现而不是靠猜 -->
    <datalist id="mr-contact-labels">
      <option v-for="l in CONTACT_LABELS" :key="l" :value="l"></option>
    </datalist>
  </div>
</template>

<style scoped>
.contact-row {
  align-items: center;
}
</style>
