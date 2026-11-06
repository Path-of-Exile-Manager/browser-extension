/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";
import pkg from "./package.json" with { type: "json" };

// Конфиг панели (страница расширения panel.html, React + дизайн-система) и тестов.
// Content script, хук навигации и service worker собираются отдельно в scripts/build.mjs:
// content scripts в Chrome не умеют ES-модули, поэтому их нужно собирать в один IIFE-файл.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: ".",
  base: "./",
  define: {
    __EXT_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: {
      input: { panel: fileURLToPath(new URL("./panel.html", import.meta.url)) },
    },
  },
  server: {
    watch: { ignored: ["**/.screens/**", "**/dist/**", "**/release/**"] },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test-setup.ts"],
    css: false,
  },
});
