<script setup lang="ts">
import { computed } from 'vue'
import type { ExperienceData, Section } from '@shared/schema'

const props = defineProps<{ section: Section }>()
const data = computed(() => props.section.data as ExperienceData)
</script>

<template>
  <div class="gr-body">
    <div v-for="item in data.items" :key="item.id" class="section-item gr-item">
      <div class="gr-row">
        <span class="gr-date">{{ item.date }}</span>
        <span class="gr-strong">{{ item.title }}</span>
        <span class="gr-side">{{ item.role }}</span>
      </div>
      <div v-for="(d, i) in item.details.filter((x) => x.trim())" :key="i" class="line gr-sub">{{ d }}</div>
    </div>
  </div>
</template>

<style scoped>
.gr-body {
  border: 1px solid #c9ced9;
  border-top: none;
}

.gr-item {
  padding: 0.32em 0.7em;
}

.gr-item + .gr-item {
  border-top: 1px dashed #dfe2ea;
}

.gr-row {
  display: grid;
  grid-template-columns: 30mm minmax(0, 1fr) auto;
  align-items: baseline;
  gap: 0.6em;
}

.gr-date {
  color: #6b7186;
  font-size: 0.94em;
}

.gr-strong {
  font-weight: 600;
  color: #26262f;
}

.gr-side {
  color: #3f4457;
  font-size: 0.94em;
}

.gr-sub {
  color: #565c70;
  font-size: 0.95em;
  padding-left: 30mm;
}
</style>
