import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // ngrok (and similar tunnels) send a Host header that Vite blocks by default.
    // Leading dot = allow any subdomain (e.g. *.ngrok-free.dev).
    allowedHosts: [
      '.ngrok-free.dev',
      '.ngrok.io',
      '.ngrok.app',
      'overnervously-nidicolous-madlyn.ngrok-free.dev',
    ],
    // Other devices use https://<ngrok>/ — Socket.IO must hit the same origin (not localhost:5000 on *their* machine).
    // This forwards /socket.io to the local Express server.
    proxy: {
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
        ws: true,
      },
    },
  },
})
