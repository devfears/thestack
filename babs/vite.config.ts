import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    strictPort: true, // Fail if port is in use instead of trying another port
    allowedHosts: true,
  },
  preview: {
    port: 5174,
    strictPort: true, // Fail if port is in use instead of trying another port
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
