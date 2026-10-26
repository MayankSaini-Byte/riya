import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { localApi } from './vite-plugin-local-api.js'

export default defineConfig({
  plugins: [react(), localApi()],
})
