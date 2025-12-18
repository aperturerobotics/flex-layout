// Unit test setup for vitest with happy-dom
// Provides mocks for browser APIs not available in happy-dom

import "@testing-library/jest-dom/vitest";

// Mock ResizeObserver if not available
if (typeof globalThis.ResizeObserver === "undefined") {
    class ResizeObserverMock {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
    globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver;
}
