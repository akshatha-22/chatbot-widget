import { defineConfig } from 'vite'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

// https://vitejs.dev/config/
export default defineConfig({
  // Use repo-root `.env*` so one `.env.local` covers Vite + backend (see backend/app/config.py)
  envDir: repoRoot,
  plugins: [react()],
  resolve: {
    alias: {
      // npm workspaces hoists react to repo root; Vite pre-bundle needs explicit paths
      react: path.join(repoRoot, 'node_modules/react'),
      'react-dom': path.join(repoRoot, 'node_modules/react-dom'),
      '@': path.resolve(__dirname, 'src'),
      '@components': path.resolve(__dirname, 'src/components'),
      '@styles': path.resolve(__dirname, 'src/styles'),
      '@hooks': path.resolve(__dirname, 'src/hooks'),
    },
  },
  server: {
    port: 5173,
    host: '127.0.0.1',
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'esbuild',
    cssCodeSplit: true,
  },
})
