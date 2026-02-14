import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/demo.v1": "http://localhost:8080",
      "/stats.v1": "http://localhost:8080",
    },
  },
});
