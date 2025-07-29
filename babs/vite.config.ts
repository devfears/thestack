import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      external: ["@farcaster/miniapp-wagmi-connector"]
    }
  },
  optimizeDeps: {
    exclude: ["@farcaster/miniapp-wagmi-connector"],
    include: ["eventemitter3"]
  }
});
