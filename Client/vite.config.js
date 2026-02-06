import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  /* server: {
    host: true,
    port: 5173,
    hmr: {
      host: "unreproached-skyler-regularly.ngrok-free.dev",
      protocol: "wss",
      clientPort: 443,
    },
  }, */
});
