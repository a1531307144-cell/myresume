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
  color: #2e2e3a;
}

.role {
  margin-left: 10px;
  color: #4a5068;
  font-size: 0.92em;
}

.date {
  flex-shrink: 0;
  margin-left: 12px;
  color: #8a90a8;
  font-size: 0.92em;
}

.detail {
  color: #4a5068;
  padding-left: 0.95em;
  position: relative;
}

.detail::before {
  content: '';
  position: absolute;
  left: 0.1em;
  top: 0.72em;
  width: 5px;
  height: 1.5px;
  background: #8892b8;
}
</style>
