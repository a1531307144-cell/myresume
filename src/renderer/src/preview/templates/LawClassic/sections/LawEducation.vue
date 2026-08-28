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
        <span class="strong">{{ item.school }}</span>
        <span class="date">{{ item.date }}</span>
      </div>
      <div v-if="item.degree" class="line">{{ item.degree }}</div>
      <div v-for="(e, i) in item.extras.filter((x) => x.trim())" :key="i" class="line">{{ e }}</div>
    </div>
  </div>
</template>

<style scoped>
.edu-item {
  margin-bottom: 0.55em;
}

.edu-item:last-child {
  margin-bottom: 0;
}

.row-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.strong {
  font-weight: 700;
}

.date {
  flex-shrink: 0;
  margin-left: 12px;
}
</style>
