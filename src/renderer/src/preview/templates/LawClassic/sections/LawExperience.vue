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
        <span>
          <span class="strong">{{ item.title }}</span>
          <span v-if="item.role" class="role">{{ item.role }}</span>
        </span>
        <span class="date">{{ item.date }}</span>
      </div>
      <div v-for="(d, i) in item.details.filter((x) => x.trim())" :key="i" class="line detail">· {{ d }}</div>
    </div>
  </div>
</template>

<style scoped>
.exp-item {
  margin-bottom: 10px;
}

.exp-item:last-child {
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

.role {
  margin-left: 10px;
}

.date {
  flex-shrink: 0;
  margin-left: 12px;
}

.detail {
  padding-left: 2px;
}
</style>
