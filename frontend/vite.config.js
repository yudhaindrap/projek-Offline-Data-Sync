import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],

  server: {
    host: true,
    port: 3000,

    proxy: {
      // 1. Proxy untuk REST API biasa (Sudah ada)
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      // 2. TAMBAHKAN INI: Proxy untuk Socket.io (WebSocket)
      '/socket.io': {
        target: 'http://localhost:5000',
        ws: true, // PENTING: Mengizinkan protokol WebSocket (ws://) lewat
        changeOrigin: true,
        secure: false,
      },
    },
  },
})