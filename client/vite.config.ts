import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')

function resolvePkg(pkg: string) {
  const local = path.join(__dirname, 'node_modules', pkg)
  if (fs.existsSync(path.join(local, 'package.json'))) return local
  return path.join(repoRoot, 'node_modules', pkg)
}

function resolveApiUrl(mode: string): string {
  const fromFiles = loadEnv(mode, repoRoot, 'VITE_').VITE_API_URL
  const raw = process.env.VITE_API_URL ?? fromFiles ?? 'http://localhost:8000'
  return raw.replace(/\/$/, '')
}

const sharedResolve = {
  alias: {
    react: resolvePkg('react'),
    'react-dom': resolvePkg('react-dom'),
    '@': path.resolve(__dirname, 'src'),
    '@components': path.resolve(__dirname, 'src/components'),
    '@styles': path.resolve(__dirname, 'src/styles'),
    '@hooks': path.resolve(__dirname, 'src/hooks'),
  },
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  const isLib = mode === 'lib'

  if (isLib) {
    return {
      publicDir: false,
      plugins: [react(), cssInjectedByJsPlugin()],
      define: {
        'process.env.NODE_ENV': JSON.stringify('production'),
      },
      resolve: sharedResolve,
      css: {
        postcss: path.resolve(__dirname, 'postcss.config.embed.js'),
      },
      build: {
        lib: {
          entry: path.resolve(__dirname, 'src/embed.tsx'),
          name: 'RemiWidget',
          formats: ['iife'],
          fileName: () => 'remi-widget.js',
        },
        rollupOptions: {
          output: {
            extend: true,
            inlineDynamicImports: true,
          },
        },
        outDir: 'dist-lib',
        emptyOutDir: true,
        cssCodeSplit: false,
        sourcemap: false,
        minify: 'esbuild',
      },
    }
  }

  return {
    envDir: repoRoot,
    define: {
      'import.meta.env.VITE_API_URL': JSON.stringify(resolveApiUrl(mode)),
    },
    plugins: [react()],
    resolve: sharedResolve,
    server: {
      port: 5173,
      host: true,
      open: true,
      watch: {
        ignored: ['**/dist/**', '**/dist-lib/**'],
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      minify: 'esbuild',
      cssCodeSplit: true,
    },
    test: {
      environment: 'jsdom',
      globals: true,
      include: ['tests/**/*.test.ts'],
    },
  }
})
