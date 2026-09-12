<script setup lang="ts">
import { computed } from 'vue'
import type { EducationData, Section } from '@shared/schema'

const props = defineProps<{ section: Section }>()
const data = computed(() => props.section.data as EducationData)
</script>

<template>
  <div>
    <div v-for="item in data.items" :key="item.id" class="section-item edu-item">
      <div class="row-head">
        <span class="school">{{ item.school }}</span>
        <span class="date">{{ item.date }}</span>
      </div>
      <div v-if="item.degree" class="line degree">{{ item.degree }}</div>
      <div v-for="(e, i) in item.extras.filter((x) => x.trim())" :key="i" class="line extra">{{ e }}</div>
    </div>
  </div>
</template>

<style scoped>
.edu-item {
  margin-bottom: 0.85em;
}

.edu-item:last-child {
  margin-bottom: 0;
}

.row-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.school {
  font-weight: 600;
  color: #2e2e3a;
}

.date {
  flex-shrink: 0;
  margin-left: 12px;
  color: #8a90a8;
  font-size: 0.92em;
}

.degree {
  color: #4a5068;
}

.extra {
  color: #6d7387;
  font-size: 0.95em;
}
</style>
