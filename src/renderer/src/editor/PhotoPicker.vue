<script setup lang="ts">
import { ref } from 'vue'
import type { BasicInfoData } from '@shared/schema'
import { compressImage } from './compressImage'

const props = defineProps<{ photo: BasicInfoData['photo'] }>()
const emit = defineEmits<{ 'update:photo': [photo: BasicInfoData['photo']] }>()

const busy = ref(false)

async function pick(): Promise<void> {
  busy.value = true
  try {
    const picked = await window.myresume.dialog.pickPhoto()
    if (!picked) return
    const compressed = await compressImage(picked.dataUrl)
    emit('update:photo', { dataUrl: compressed })
  } catch (err) {
    console.error('选择照片失败', err)
  } finally {
    busy.value = false
  }
}

function remove(): void {
  emit('update:photo', null)
}
</script>

<template>
  <div class="photo-picker">
    <div v-if="photo" class="photo-box has-photo">
      <img :src="photo.dataUrl" alt="证件照预览" />
      <div class="photo-ops">
        <button class="op" @click="pick">更换</button>
        <button class="op danger" @click="remove">移除</button>
      </div>
    </div>
    <button v-else class="photo-box empty" :disabled="busy" @click="pick">
      <span class="plus">＋</span>
      <span class="txt">{{ busy ? '处理中…' : '上传证件照' }}</span>
    </button>
  </div>
</template>

<style scoped>
.photo-picker {
  flex-shrink: 0;
}

.photo-box {
  width: 88px;
  height: 112px;
  border-radius: 8px;
  overflow: hidden;
}

.photo-box.has-photo {
  position: relative;
  border: 1px solid #e6e6ef;
}

.photo-box.has-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.photo-ops {
  position: absolute;
  inset: auto 0 0 0;
  display: flex;
  background: rgba(20, 20, 30, 0.55);
  backdrop-filter: blur(2px);
}

.op {
  flex: 1;
  border: none;
  background: transparent;
  color: #fff;
  font-size: 11px;
  padding: 4px 0;
}

.op.danger {
  border-left: 1px solid rgba(255, 255, 255, 0.25);
}

.photo-box.empty {
  border: 1.5px dashed #c5c5d8;
  background: #fafafd;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  color: #9a9aae;
}

.photo-box.empty:hover {
  border-color: #667eea;
  color: #667eea;
}

.plus {
  font-size: 20px;
  line-height: 1;
}

.txt {
  font-size: 11px;
}
</style>
