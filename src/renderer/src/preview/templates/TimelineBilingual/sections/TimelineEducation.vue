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
      <div v-for="(e, i) in item.extras.filter((x) => x.trim())" :key="i" class="line extra">
        <span class="dot">·</span>{{ e }}
      </div>
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
  color: #2c2c38;
}

.date {
  flex-shrink: 0;
  margin-left: 12px;
  padding: 0 0.5em;
  background: #f3f4fb;
  border-radius: 3px;
  color: #7b82a3;
  font-size: 0.88em;
}

.degree {
  color: #4c4c60;
}

.extra {
  color: #6f7590;
  font-size: 0.95em;
}

.dot {
  color: #667eea;
  margin-right: 0.45em;
}
</style>
