import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import react from "@vitejs/plugin-react";

// Check for UI mode via environment variable
// Set BROWSER_TEST_UI=1 to run tests with visible browser (headless: false)
const showUI = process.env.BROWSER_TEST_UI === "1";

export default defineConfig({
    plugins: [react()],
    optimizeDeps: {
        include: ["vitest-browser-react", "@testing-library/jest-dom/vitest", "react", "react-dom/client"],
    },
    test: {
        browser: {
            enabled: true,
            headless: !showUI,
            provider: playwright({
                launchOptions: {
                    headless: !showUI,
                },
            }),
            // https://vitest.dev/guide/browser/playwright
            instances: [{ browser: "chromium" }],
            // Disable automatic screenshots - they just capture loading states
            screenshotFailures: false,
            // Use a desktop viewport (default 414x896 is mobile)
            viewport: { width: 1280, height: 800 },
        },
        // Include E2E test files
        include: ["**/*.e2e.test.{ts,tsx}"],
        // Setup files for E2E tests
        setupFiles: ["./src/test/setup.ts"],
    },
});
