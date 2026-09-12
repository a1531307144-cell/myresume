<script setup lang="ts">
import { computed } from 'vue'
import type { ExperienceData, Section } from '@shared/schema'

const props = defineProps<{ section: Section }>()
const data = computed(() => props.section.data as ExperienceData)
</script>

<template>
  <div>
    <div v-for="item in data.items" :key="item.id" class="section-item exp-item">
      <div class="row-head">
        <span class="left">
          <span class="title">{{ item.title }}</span>
          <span v-if="item.role" class="role">{{ item.role }}</span>
        </span>
        <span class="date">{{ item.date }}</span>
      </div>
      <div v-for="(d, i) in item.details.filter((x) => x.trim())" :key="i" class="line detail">
        <span class="dot">·</span>{{ d }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.exp-item {
  margin-bottom: 0.95em;
}

.exp-item:last-child {
  margin-bottom: 0;
}

.row-head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
}

.title {
  font-weight: 600;
  color: #2c2c38;
}

.role {
  margin-left: 10px;
  color: #667eea;
  font-size: 0.9em;
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

.detail {
  color: #4c4c60;
}

.dot {
  color: #667eea;
  margin-right: 0.45em;
}
</style>
