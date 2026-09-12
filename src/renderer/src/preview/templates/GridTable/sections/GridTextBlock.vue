<script setup lang="ts">
import { computed } from 'vue'
import type { Section, TextBlockData } from '@shared/schema'

const props = defineProps<{ section: Section }>()
const data = computed(() => props.section.data as TextBlockData)
const paragraphs = computed(() => data.value.paragraphs.filter((p) => p.trim()))
</script>

<template>
  <div class="gr-body">
    <p v-for="(p, i) in paragraphs" :key="i" class="section-item line gr-paragraph">{{ p }}</p>
  </div>
</template>

<style scoped>
.gr-body {
  border: 1px solid #c9ced9;
  border-top: none;
  padding: 0.36em 0.7em;
}

.gr-paragraph {
  margin: 0 0 0.4em;
  text-align: justify;
  color: #3f4457;
}

.gr-paragraph:last-child {
  margin-bottom: 0;
}
</style>
