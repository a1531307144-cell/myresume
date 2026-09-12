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
      <div v-for="(d, i) in item.details.filter((x) => x.trim())" :key="i" class="line detail">{{ d }}</div>
    </div>
  </div>
</template>

<style scoped>
.exp-item {
  margin-bottom: 0.9em;
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
  color: #2b2b36;
}

.role {
  margin-left: 10px;
  color: #46527a;
  font-size: 0.9em;
}

.date {
  flex-shrink: 0;
  margin-left: 12px;
  color: #7b8399;
  font-size: 0.9em;
}

.detail {
  color: #4a4f5e;
  padding-left: 0.95em;
  position: relative;
}

.detail::before {
  content: '';
  position: absolute;
  left: 0.15em;
  top: 0.68em;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: #3a4560;
}
</style>
