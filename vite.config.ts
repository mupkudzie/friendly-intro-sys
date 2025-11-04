import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    proxy: {
      '/video_feed': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/start_recording': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/stop_recording': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      },
      '/recordings': {
        target: 'http://localhost:5000',
        changeOrigin: true,
        secure: false,
      }
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["react", "react-dom", "@tanstack/react-query"],
  },
}));
