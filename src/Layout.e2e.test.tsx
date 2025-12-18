import { describe, it, expect } from "vitest";

describe("Browser E2E Setup", () => {
    it("can run browser tests", () => {
        expect(true).toBe(true);
    });

    it("has access to browser APIs", () => {
        expect(typeof document).toBe("object");
        expect(typeof window).toBe("object");
    });
});
