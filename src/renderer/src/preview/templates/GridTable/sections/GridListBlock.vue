<script setup lang="ts">
import { computed } from 'vue'
import type { ListBlockData, Section } from '@shared/schema'

const props = defineProps<{ section: Section }>()
const data = computed(() => props.section.data as ListBlockData)
const entries = computed(() => data.value.entries.filter((e) => e.text.trim() || e.label.trim()))
</script>

<template>
  <div class="gr-body">
    <div v-for="entry in entries" :key="entry.id" class="section-item line gr-entry">
      <span v-if="entry.label.trim()" class="gr-label">{{ entry.label }}</span>
      <span class="gr-text">{{ entry.text }}</span>
    </div>
  </div>
</template>

<style scoped>
.gr-body {
  border: 1px solid #c9ced9;
  border-top: none;
}

.gr-entry {
  display: grid;
  grid-template-columns: 24mm minmax(0, 1fr);
  gap: 0.6em;
  padding: 0.26em 0.7em;
}

.gr-entry + .gr-entry {
  border-top: 1px dashed #dfe2ea;
}

.gr-label {
  color: #6b7186;
  font-size: 0.94em;
}

.gr-text {
  color: #26262f;
  word-break: break-word;
}
</style>
