import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src'),
        '@shared': resolve('src/shared')
      }
    },
    // 预打包大依赖：避免首次使用时触发依赖优化导致的整页重载（会打断进行中的导入）
    optimizeDeps: {
      include: ['pdfjs-dist', 'mammoth/mammoth.browser']
    },
    plugins: [vue()],
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          print: resolve('src/renderer/print.html')
        }
      }
    }
  }
})
