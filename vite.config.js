import { defineConfig } from 'vite'

export default defineConfig({
  base: './',
  server: {
    port: 5173,
    open: false,
    watch: {
      ignored: ['**/_2d-archive/**'],
    },
    fs: {
      deny: ['**/_2d-archive/**'],
    },
  },
  optimizeDeps: {
    entries: ['index.html'],
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      input: 'index.html',
    },
  },
})


