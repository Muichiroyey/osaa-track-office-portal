import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// The Office Portal runs on its own port (5175) alongside the Admin
// Panel's 5173 and the Student & Alumni Portal's 5174 — three separate
// apps that all proxy to the SAME backend on :5000 and therefore the same
// MySQL database. Nothing is duplicated server-side.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
      },
    },
  },
});
