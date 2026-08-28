<script setup lang="ts">
import { computed } from 'vue'
import { store } from '@renderer/stores/resume'

const statusText = computed(() => {
  switch (store.saveStatus) {
    case 'saved':
      return '已保存'
    case 'saving':
      return '保存中…'
    case 'dirty':
      return '未保存'
    case 'draft':
      return '草稿已暂存'
    case 'error':
      return '保存失败'
    default:
      return ''
  }
})
</script>

<template>
  <span class="save-status" :class="store.saveStatus" :title="store.filePath ?? '尚未保存为文件（内容已自动暂存为草稿）'">
    <span class="dot"></span>
    {{ store.fileName ?? '未命名简历' }} · {{ statusText }}
  </span>
</template>

<style scoped>
.save-status {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #7c7c92;
}

.dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #b3b3c4;
}

.save-status.saved .dot {
  background: #3fbf7f;
}

.save-status.saving .dot {
  background: #e6a23c;
}

.save-status.dirty .dot,
.save-status.draft .dot {
  background: #9094d6;
}

.save-status.error .dot {
  background: #d9534f;
}
</style>
