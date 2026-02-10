import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  base: "/",
  plugins: [react()],
  resolve: {
    alias: {
      "@aptre/flex-layout/style": resolve(__dirname, "../style"),
      "@aptre/flex-layout": resolve(__dirname, "../src/index.ts"),
    },
  },
  build: {
    outDir: "dist",
  },
  server: {
    port: 5174,
  },
});
