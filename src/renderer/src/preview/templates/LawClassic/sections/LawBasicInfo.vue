<script setup lang="ts">
// 基本信息由 LawClassicPage 的页眉单独渲染，此组件仅为类型完整性占位（不会进入渲染循环）
defineProps<{ section: unknown }>()
</script>

<template>
  <span hidden></span>
</template>
