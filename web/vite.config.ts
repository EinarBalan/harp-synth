import basicSsl from "@vitejs/plugin-basic-ssl";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// AudioWorklet needs a secure context, so plain http://<lan-ip>:5173 has no audio on
// phones. The self-signed cert makes LAN dev a secure context; Safari will warn once.
export default defineConfig({
  plugins: [react(), basicSsl()],
  server: {
    host: "0.0.0.0"
  },
  test: {
    environment: "jsdom",
    globals: true
  }
});
