import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'

/** Staging builds (`--mode staging`) must never be indexed: noindex meta + a robots.txt that disallows all. */
function stagingNoIndex(): Plugin {
  let outDir = 'dist'
  return {
    name: 'partey-staging-noindex',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    transformIndexHtml(html) {
      return html.replace(/<meta name="robots" content="[^"]*" \/>/, '<meta name="robots" content="noindex, nofollow" />')
    },
    closeBundle() {
      writeFileSync(resolve(outDir, 'robots.txt'), '# Partey staging: not for search engines.\nUser-agent: *\nDisallow: /\n')
    },
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), ...(mode === 'staging' ? [stagingNoIndex()] : [])],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@shared': fileURLToPath(new URL('./shared', import.meta.url)),
    },
  },
  server: {
    host: true,
  },
  build: {
    // The Firebase SDK (auth + firestore + rtdb + functions) is one cohesive, lazily-loaded chunk.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'firebase'
          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom') || id.includes('node_modules/react-router')) return 'react'
        },
      },
    },
  },
}))
