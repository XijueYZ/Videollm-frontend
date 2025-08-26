import { fileURLToPath, URL } from 'node:url'

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // 设置根路径
  root: process.cwd(),
  // 设置基础路径
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ["notebook-inspire.sii.edu.cn", 'nat-notebook-inspire.sii.edu.cn'],
    watch: {
      ignored: ['**/node_modules/**']
    },
    middlewareMode: false,
    // 配置 HMR 连接
    hmr: true,
    // hmr: {
    //   // 强制 HMR 使用相对路径
    //   clientPort: 5173,
    //   path: '/ws'
    // },
    // 添加 Docker 支持的配置
    fs: {
      // 允许服务访问上级目录
      allow: ['..']
    }
  },
  // 优化构建配置
  build: {
    sourcemap: true,
    // 设置构建输出目录
    outDir: 'dist',
    // 资源文件处理
    assetsDir: 'assets',
    // 生成相对路径
    assetsInlineLimit: 4096
  }
})
