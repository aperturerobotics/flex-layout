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
      // Deduplicate react so the library source and website share one instance.
      react: resolve(__dirname, "node_modules/react"),
      "react-dom": resolve(__dirname, "node_modules/react-dom"),
      "react/jsx-runtime": resolve(__dirname, "node_modules/react/jsx-runtime"),
      "react/jsx-dev-runtime": resolve(
        __dirname,
        "node_modules/react/jsx-dev-runtime",
      ),
    },
  },
  build: {
    outDir: "dist",
  },
  server: {
    port: 5174,
  },
});
