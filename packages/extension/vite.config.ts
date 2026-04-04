import { defineConfig } from "vite";
import { resolve } from "path";

// Build each entry separately as IIFE (Chrome MV3 requires non-module scripts)
export default defineConfig({
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      input: {
        content: resolve(__dirname, "src/content/index.ts"),
        background: resolve(__dirname, "src/background/index.ts"),
        popup: resolve(__dirname, "src/popup/index.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        format: "es",
      },
    },
    copyPublicDir: true,
  },
  publicDir: "public",
});
