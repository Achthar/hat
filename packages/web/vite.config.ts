import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: { port: 3000 },
  optimizeDeps: {
    // Don't pre-bundle IDKit's WASM — let it load at runtime
    exclude: ["@worldcoin/idkit-core"],
  },
  assetsInclude: ["**/*.wasm"],
});
