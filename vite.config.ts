import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Ermöglicht Zugriff von anderen Rechnern im Netzwerk
    port: 5173,
  },
})
