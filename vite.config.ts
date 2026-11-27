import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  base: '/decision--lab/',
  build: {
    // Keep existing generated files; replacing the build must not remove prior files.
    emptyOutDir: false,
  },
  plugins: [react()],
})
