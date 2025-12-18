// Global test setup for vitest browser tests
// Mocks localStorage for tests that use state persistence
// Import CSS for proper layout measurement in browser tests
import "../../style/light.css";

const localStorageMock = (() => {
    let store: Record<string, string> = {};
    return {
        getItem: (key: string) => store[key] ?? null,
        setItem: (key: string, value: string) => {
            store[key] = value;
        },
        removeItem: (key: string) => {
            delete store[key];
        },
        clear: () => {
            store = {};
        },
        get length() {
            return Object.keys(store).length;
        },
        key: (index: number) => Object.keys(store)[index] ?? null,
    };
})();

Object.defineProperty(globalThis, "localStorage", {
    value: localStorageMock,
    writable: true,
});
