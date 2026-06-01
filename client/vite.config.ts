import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

function resolvePkg(pkg: string) {
  const local = path.join(__dirname, 'node_modules', pkg)
  if (fs.existsSync(path.join(local, 'package.json'))) return local
  return path.join(repoRoot, 'node_modules', pkg)
}

function resolveApiUrl(mode: string): string {
  const fromFiles = loadEnv(mode, repoRoot, 'VITE_').VITE_API_URL
  // Vercel injects env at build time via process.env — must not rely on .env files alone
  const raw = process.env.VITE_API_URL ?? fromFiles ?? 'http://localhost:8000'
  return raw.replace(/\/$/, '')
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  // Use repo-root `.env*` so one `.env.local` covers Vite + backend (see backend/app/config.py)
  envDir: repoRoot,
  define: {
    'import.meta.env.VITE_API_URL': JSON.stringify(resolveApiUrl(mode)),
  },
  plugins: [react()],
  resolve: {
    alias: {
      react: resolvePkg('react'),
      'react-dom': resolvePkg('react-dom'),
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
}))
