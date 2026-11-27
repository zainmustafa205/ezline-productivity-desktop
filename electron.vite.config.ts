import { resolve } from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'electron-vite'
import type { Plugin } from 'vite'

/**
 * Content Security Policy of every window, written into index.html at build time.
 * The windows never call the backend themselves (the main process does), so
 * connect-src stays 'self'. Development adds what the Vite dev server needs
 * (inline React refresh preamble, injected styles, HMR web socket).
 */
function contentSecurityPolicy(isDevelopment: boolean): string {
  const policy = [
    "default-src 'none'",
    isDevelopment ? "script-src 'self' 'unsafe-inline'" : "script-src 'self'",
    isDevelopment ? "style-src 'self' 'unsafe-inline'" : "style-src 'self'",
    "img-src 'self' data:",
    "font-src 'self'",
    isDevelopment ? "connect-src 'self' ws://localhost:* http://localhost:*" : "connect-src 'self'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
    "object-src 'none'",
  ]
  return policy.join('; ')
}

function cspPlugin(isDevelopment: boolean): Plugin {
  return {
    name: 'productivityai:content-security-policy',
    transformIndexHtml(html) {
      return html.replace('%CONTENT_SECURITY_POLICY%', contentSecurityPolicy(isDevelopment))
    },
  }
}

export default defineConfig(({ command, mode }) => {
  const isDevelopment = command === 'serve' || mode === 'development'

  return {
    main: {
      build: {
        rolldownOptions: {
          input: {
            index: resolve(import.meta.dirname, 'src/main/index.ts'),
            'dev-tracker': resolve(import.meta.dirname, 'src/main/dev-tracker.ts'),
          },
        },
      },
    },
    preload: {
      build: {
        rolldownOptions: {
          input: { index: resolve(import.meta.dirname, 'src/preload/index.ts') },
          // Sandboxed preload scripts must be CommonJS.
          output: { format: 'cjs', entryFileNames: '[name].cjs' },
        },
      },
    },
    renderer: {
      root: resolve(import.meta.dirname, 'src/renderer'),
      plugins: [react(), tailwindcss(), cspPlugin(isDevelopment)],
      build: {
        minify: !isDevelopment,
        rolldownOptions: {
          input: { index: resolve(import.meta.dirname, 'src/renderer/index.html') },
        },
      },
    },
  }
})
