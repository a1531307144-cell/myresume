<script setup lang="ts">
import { computed } from 'vue'
import type { ListBlockData, Section } from '@shared/schema'

/** 侧栏是深色底，这里用浅色字；label 提亮以保持层次。 */
const props = defineProps<{ section: Section }>()
const data = computed(() => props.section.data as ListBlockData)
const entries = computed(() => data.value.entries.filter((e) => e.text.trim() || e.label.trim()))
</script>

<template>
  <div>
    <div v-for="entry in entries" :key="entry.id" class="section-item line list-entry">
      <template v-if="entry.label.trim()">
        <span class="label">{{ entry.label }}：</span><span class="text">{{ entry.text }}</span>
      </template>
      <template v-else><span class="text">{{ entry.text }}</span></template>
    </div>
  </div>
</template>

<style scoped>
.list-entry {
  margin-bottom: 0.34em;
  font-size: 0.9em;
  word-break: break-word;
}

.label {
  color: #ffffff;
  font-weight: 600;
}

.text {
  color: #dfe3f0;
}
</style>
