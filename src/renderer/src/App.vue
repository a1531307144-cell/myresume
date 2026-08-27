<script setup lang="ts">
import { ref, onMounted } from 'vue'

const version = ref('…')

onMounted(async () => {
  version.value = await window.myresume.app.getVersion()
})
</script>

<template>
  <div class="shell">
    <header class="topbar">
      <div class="brand">
        <span class="brand-mark">简</span>
        <span class="brand-name">我的简历</span>
      </div>
      <span class="version">v{{ version }} · 开发版</span>
    </header>

    <main class="hero">
      <h1>从这里开始，做出一份体面的简历</h1>
      <p class="hero-sub">空白起步 · 板块自由增删排序 · 所见即所得 · 导出可选中文字的高质量 PDF</p>

      <div class="tpl-cards">
        <div class="tpl-card">
          <div class="tpl-preview tpl-law">
            <span class="tpl-tag">内置模板</span>
          </div>
          <div class="tpl-name">法学正式风</div>
          <div class="tpl-desc">宋体排版 · 黑白稳重 · 照片右上角 · 法学生求职首选</div>
        </div>
        <div class="tpl-card">
          <div class="tpl-preview tpl-simple">
            <span class="tpl-tag">内置模板</span>
          </div>
          <div class="tpl-name">通用简约风</div>
          <div class="tpl-desc">现代无衬线 · 留白呼吸感 · 适配任何专业与行业</div>
        </div>
      </div>

      <p class="hero-note">编辑器正在建设中（里程碑 M1），当前为环境验证界面。</p>
    </main>

    <footer class="statusbar">
      <span>MIT 开源</span>
      <span>环境就绪 ✓</span>
    </footer>
  </div>
</template>

<style scoped>
.shell {
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  background: #fff;
  border-bottom: 1px solid #ececf3;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
}

.brand-mark {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: linear-gradient(135deg, #667eea, #764ba2);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.brand-name {
  font-size: 16px;
  font-weight: 600;
  color: #24242e;
}

.version {
  font-size: 12px;
  color: #9a9aae;
}

.hero {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  padding: 0 24px;
  text-align: center;
}

.hero h1 {
  margin: 0;
  font-size: 26px;
  font-weight: 700;
  color: #24242e;
}

.hero-sub {
  margin: 0;
  font-size: 14px;
  color: #7c7c92;
}

.tpl-cards {
  display: flex;
  gap: 20px;
  margin-top: 22px;
}

.tpl-card {
  width: 260px;
  padding: 12px;
  background: #fff;
  border: 1px solid #ececf3;
  border-radius: 12px;
  text-align: left;
  box-shadow: 0 4px 18px rgba(102, 126, 234, 0.08);
}

.tpl-preview {
  position: relative;
  height: 150px;
  border-radius: 8px;
  margin-bottom: 10px;
}

.tpl-law {
  background: linear-gradient(150deg, #fbfbfb, #efeff4);
  border: 1px solid #e3e3ea;
}

.tpl-law::after {
  content: '';
  position: absolute;
  top: 14px;
  right: 14px;
  width: 26px;
  height: 34px;
  border: 1px solid #c9c9d4;
  border-radius: 2px;
  background: #fff;
}

.tpl-law::before {
  content: '';
  position: absolute;
  left: 14px;
  top: 18px;
  width: 90px;
  height: 8px;
  background: #2c2c34;
  border-radius: 1px;
  box-shadow: 0 14px 0 #b9b9c6, 0 28px 0 -2px #dcdce5, 0 40px 0 -2px #dcdce5, 0 52px 0 -2px #dcdce5;
}

.tpl-simple {
  background: linear-gradient(150deg, #f4f6ff, #e8ecfb);
  border: 1px solid #dfe4f5;
}

.tpl-simple::before {
  content: '';
  position: absolute;
  left: 16px;
  top: 20px;
  width: 70px;
  height: 7px;
  background: #667eea;
  border-radius: 4px;
  box-shadow: 0 13px 0 #c6cdf3, 0 26px 0 -2px #dfe3fa, 0 38px 0 -2px #dfe3fa, 0 50px 0 -2px #dfe3fa;
}

.tpl-tag {
  position: absolute;
  bottom: 8px;
  right: 10px;
  font-size: 10px;
  color: #8b8ba3;
}

.tpl-name {
  font-size: 14px;
  font-weight: 600;
  color: #24242e;
  margin-bottom: 4px;
}

.tpl-desc {
  font-size: 12px;
  color: #9a9aae;
  line-height: 1.5;
}

.hero-note {
  margin-top: 26px;
  font-size: 12px;
  color: #b3b3c4;
}

.statusbar {
  display: flex;
  justify-content: space-between;
  padding: 8px 20px;
  font-size: 12px;
  color: #9a9aae;
  background: #fff;
  border-top: 1px solid #ececf3;
}
</style>
