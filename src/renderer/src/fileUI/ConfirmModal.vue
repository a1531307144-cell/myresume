<script setup lang="ts">
import { modal, modalApi } from './useFileActions'
</script>

<template>
  <transition name="fade">
    <div v-if="modal.visible" class="modal-mask">
      <div class="modal-card">
        <h3 class="modal-title">{{ modal.title }}</h3>
        <p class="modal-text">{{ modal.text }}</p>
        <div class="modal-btns">
          <button
            v-for="b in modal.buttons"
            :key="b.value"
            class="modal-btn"
            :class="b.kind ?? 'plain'"
            @click="modalApi.onChoose(b.value)"
          >
            {{ b.label }}
          </button>
        </div>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.modal-mask {
  position: fixed;
  inset: 0;
  background: rgba(24, 26, 40, 0.42);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
}

.modal-card {
  width: 380px;
  max-width: calc(100vw - 48px);
  background: #fff;
  border-radius: 12px;
  padding: 20px 22px 18px;
  box-shadow: 0 12px 40px rgba(20, 24, 50, 0.22);
}

.modal-title {
  margin: 0 0 10px;
  font-size: 16px;
  color: #24242e;
}

.modal-text {
  margin: 0 0 18px;
  font-size: 13px;
  line-height: 1.7;
  color: #5c5c74;
  white-space: pre-line;
}

.modal-btns {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.modal-btn {
  padding: 7px 16px;
  border-radius: 7px;
  font-size: 13px;
  border: 1px solid transparent;
}

.modal-btn.plain {
  background: #f2f3f8;
  color: #5c5c74;
}

.modal-btn.plain:hover {
  background: #e8e9f2;
}

.modal-btn.primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
}

.modal-btn.danger {
  background: #fdf0ef;
  color: #d9534f;
  border-color: #f2cfcd;
}

.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.14s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
