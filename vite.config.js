import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const API_TARGET = process.env.VITE_API_TARGET || 'http://localhost:5000';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true,
    // Allow access through a tunnel (cloudflared / ngrok) for sharing or mobile testing.
    allowedHosts: ['.trycloudflare.com', '.ngrok-free.app', '.ngrok.io', '.loca.lt'],
    // Forward /api to the backend so the browser never makes a cross-origin request.
    proxy: {
      '/api': { target: API_TARGET, changeOrigin: true }
    }
  }
});
