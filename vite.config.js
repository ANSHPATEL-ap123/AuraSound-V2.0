import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // This ensures the dev server handles the public folder correctly
  publicDir: 'public',
  server: {
    fs: {
      // Allows serving files from one level up if needed
      allow: ['..']
    }
  }
})