import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  // exports/ holds large local working files (Excel exports, ~1,200 cached HTML pages from data scraping). Vite's
  // dependency scan would otherwise crawl every .html in the project and run out of memory at startup.
  optimizeDeps: { entries: ['index.html'] },
  server: { watch: { ignored: ['**/exports/**', '**/data/extended/**'] } },
})
