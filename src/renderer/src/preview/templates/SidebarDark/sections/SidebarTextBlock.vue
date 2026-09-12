<script setup lang="ts">
import { computed } from 'vue'
import type { Section, TextBlockData } from '@shared/schema'

const props = defineProps<{ section: Section }>()
const data = computed(() => props.section.data as TextBlockData)
const paragraphs = computed(() => data.value.paragraphs.filter((p) => p.trim()))
</script>

<template>
  <div>
    <p v-for="(p, i) in paragraphs" :key="i" class="section-item line paragraph">{{ p }}</p>
  </div>
</template>

<style scoped>
.paragraph {
  margin: 0 0 0.5em;
  text-align: justify;
  color: #4a4f5e;
}

.paragraph:last-child {
  margin-bottom: 0;
}
</style>
