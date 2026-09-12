<script setup lang="ts">
import { discardDraftsAction, dismissDraftNotice, draftNotice, restoreDraftsAction } from './useFileActions'

/** 左下角提示：检测到上次没保存的简历。10 秒不理会自动消失，草稿仍留在磁盘上。 */
</script>

<template>
  <transition name="draft-notice">
    <div v-if="draftNotice.visible" class="draft-notice">
      <div class="dn-body">
        <div class="dn-title">
          检测到 {{ draftNotice.count }} 份上次没保存的简历
        </div>
        <div class="dn-sub">
          <template v-if="draftNotice.when">{{ draftNotice.when }} 编辑过 ·</template>
          不理会则十秒后自动消失（内容仍留着，下次启动还会提示）
        </div>
      </div>
      <div class="dn-btns">
        <button class="dn-btn primary" @click="restoreDraftsAction()">恢复</button>
        <button class="dn-btn" @click="discardDraftsAction()">丢弃</button>
        <button class="dn-close" title="先不管" @click="dismissDraftNotice()">✕</button>
      </div>
    </div>
  </transition>
</template>

<style scoped>
.draft-notice {
  position: fixed;
  left: 20px;
  bottom: 20px;
  z-index: 125;
  max-width: min(420px, calc(100vw - 40px));
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 12px 14px;
  background: #fff;
  border: 1px solid #dcdce8;
  border-left: 3px solid #667eea;
  border-radius: 10px;
  box-shadow: 0 10px 30px rgba(40, 48, 92, 0.18);
}

.dn-body {
  min-width: 0;
}

.dn-title {
  font-size: 13px;
  font-weight: 600;
  color: #24242e;
}

.dn-sub {
  margin-top: 3px;
  font-size: 11.5px;
  line-height: 1.5;
  color: #8b8ba3;
}

.dn-btns {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.dn-btn {
  padding: 5px 12px;
  border: 1px solid #dcdce8;
  background: #fff;
  border-radius: 7px;
  font-size: 12.5px;
  color: #3c3c50;
}

.dn-btn:hover {
  border-color: #667eea;
  color: #667eea;
}

.dn-btn.primary {
  background: linear-gradient(135deg, #667eea, #764ba2);
  border: none;
  color: #fff;
  font-weight: 500;
}

.dn-btn.primary:hover {
  opacity: 0.92;
  color: #fff;
}

.dn-close {
  border: none;
  background: transparent;
  color: #a8a8bd;
  font-size: 12px;
  padding: 3px 5px;
  border-radius: 5px;
}

.dn-close:hover {
  background: #ececf3;
  color: #4a4a60;
}

.draft-notice-enter-active,
.draft-notice-leave-active {
  transition: all 0.22s ease;
}

.draft-notice-enter-from,
.draft-notice-leave-to {
  opacity: 0;
  transform: translateY(10px);
}
</style>
