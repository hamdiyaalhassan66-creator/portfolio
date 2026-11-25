import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: ["es2022", "safari15"], // modern browsers, but older iPhones and iPads still work
    rollupOptions: {
      output: {
        // vendor code in its own cached chunks, so a site update doesn't re-download React or GSAP
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("gsap")) return "gsap";
          if (id.includes("/node_modules/three/") || id.includes("@react-three")) return "three";
          if (id.includes("react-router") || id.includes("@remix-run")) return "router";
          if (id.includes("/react/") || id.includes("/react-dom/") || id.includes("/scheduler/")) return "react";
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'https://dee-space07.vercel.app',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
