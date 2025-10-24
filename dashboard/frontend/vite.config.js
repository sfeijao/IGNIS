import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { resolve } from 'node:path'

// We output into dashboard/public/moderation-dist with stable file names
export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: '../public/moderation-dist',
    emptyOutDir: true,
    sourcemap: false,
    rollupOptions: {
      output: {
        entryFileNames: 'assets/[name].js',
        chunkFileNames: 'assets/[name].js',
        assetFileNames: 'assets/[name][extname]'
      },
      input: {
        main: resolve(__dirname, 'src/main.jsx')
      }
    }
  },
  server: {
    port: 5173
  }
})
