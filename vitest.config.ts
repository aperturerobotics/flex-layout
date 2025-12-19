import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        environment: "jsdom",
        include: ["**/*.test.{ts,tsx}"],
        exclude: [...configDefaults.exclude, "**/*.e2e.test.{ts,tsx}", "dist", "node_modules", "typedoc"],
        setupFiles: ["./src/test/unit-setup.ts"],
    },
});
