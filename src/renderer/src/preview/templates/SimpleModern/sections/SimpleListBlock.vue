<script setup lang="ts">
import { computed } from 'vue'
import type { ListBlockData, Section } from '@shared/schema'

const props = defineProps<{ section: Section }>()
const data = computed(() => props.section.data as ListBlockData)
const entries = computed(() => data.value.entries.filter((e) => e.text.trim() || e.label.trim()))
</script>

<template>
  <div>
    <div v-for="entry in entries" :key="entry.id" class="section-item line list-entry">
      <template v-if="entry.label.trim()">
        <span class="label">{{ entry.label }}：</span><span>{{ entry.text }}</span>
      </template>
      <template v-else>{{ entry.text }}</template>
    </div>
  </div>
</template>

<style scoped>
.list-entry {
  margin-bottom: 0.3em;
}

.label {
  font-weight: 600;
  color: #1f1f28;
}
</style>
