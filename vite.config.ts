import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (id.includes("@azure")) {
              return "msal";
            }
            if (id.includes("@supabase")) {
              return "supabase";
            }
            if (id.includes("react") || id.includes("react-dom") || id.includes("react-router")) {
              return "vendor";
            }
          }
        },
      },
    },
  },
});

