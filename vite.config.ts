import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  base: '/decision--lab/',
  build: {
    // Recreate dist on every build so Pages only publishes assets from this build.
    emptyOutDir: true,
  },
  plugins: [react()],
})
