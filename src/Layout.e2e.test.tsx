import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render } from "vitest-browser-react";
import { Layout, Model, IJsonModel, Actions } from "./index";
import "@testing-library/jest-dom/vitest";

const jsonModel: IJsonModel = {
    global: {},
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [
                    { type: "tab", name: "Tab 1", component: "test", id: "tab1" },
                    { type: "tab", name: "Tab 2", component: "test", id: "tab2" },
                    { type: "tab", name: "Tab 3", component: "test", id: "tab3" },
                ],
            },
        ],
    },
};

describe("Browser E2E Setup", () => {
    it("can run browser tests", () => {
        expect(true).toBe(true);
    });

    it("has access to browser APIs", () => {
        expect(typeof document).toBe("object");
        expect(typeof window).toBe("object");
    });
});

describe("Layout E2E", () => {
    let container: HTMLDivElement;

    beforeEach(() => {
        container = document.createElement("div");
        container.style.width = "800px";
        container.style.height = "600px";
        container.style.position = "relative";
        document.body.appendChild(container);
    });

    afterEach(() => {
        document.body.removeChild(container);
    });

    it("renders Layout with tabs", async () => {
        const model = Model.fromJson(jsonModel);
        await render(<Layout model={model} factory={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

        // Wait for layout to render
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Verify layout structure
        expect(document.querySelector(".flexlayout__layout")).not.toBeNull();
        expect(document.querySelector(".flexlayout__tabset")).not.toBeNull();
        expect(document.querySelectorAll(".flexlayout__tab_button").length).toBe(3);
    });

    it("selects tab when clicking tab button", async () => {
        const model = Model.fromJson(jsonModel);
        let selectedTabId = "tab1"; // First tab is selected by default

        await render(
            <Layout
                model={model}
                factory={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>}
                onModelChange={(_newModel, action) => {
                    if (action.type === Actions.SELECT_TAB) {
                        selectedTabId = action.data.tabNode;
                    }
                }}
            />,
            { container },
        );

        // Wait for layout to render
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Click on the second tab button
        const tabButtons = document.querySelectorAll(".flexlayout__tab_button");
        expect(tabButtons.length).toBe(3);

        (tabButtons[1] as HTMLElement).click();

        // Wait for action
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Verify second tab is now selected
        expect(selectedTabId).toBe("tab2");
    });

    it("calls onDragStateChange when drag starts and ends", async () => {
        const model = Model.fromJson(jsonModel);
        const dragStates: boolean[] = [];

        await render(
            <Layout
                model={model}
                factory={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>}
                onDragStateChange={(isDragging) => {
                    dragStates.push(isDragging);
                }}
            />,
            { container },
        );

        // Wait for layout to render
        await new Promise((resolve) => setTimeout(resolve, 100));

        const tabButton = document.querySelector(".flexlayout__tab_button") as HTMLElement;
        const layoutElement = document.querySelector(".flexlayout__layout") as HTMLElement;
        expect(tabButton).not.toBeNull();
        expect(layoutElement).not.toBeNull();

        const rect = tabButton.getBoundingClientRect();
        const startX = rect.left + rect.width / 2;
        const startY = rect.top + rect.height / 2;

        const dataTransfer = new DataTransfer();

        // Start drag
        tabButton.dispatchEvent(
            new DragEvent("dragstart", {
                bubbles: true,
                cancelable: true,
                clientX: startX,
                clientY: startY,
                dataTransfer,
            }),
        );

        // Enter layout to trigger drag state
        layoutElement.dispatchEvent(
            new DragEvent("dragenter", {
                bubbles: true,
                cancelable: true,
                clientX: startX + 10,
                clientY: startY,
                dataTransfer,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 50));

        // Should have called with true
        expect(dragStates).toContain(true);

        // End drag to trigger clear
        tabButton.dispatchEvent(
            new DragEvent("dragend", {
                bubbles: true,
                cancelable: true,
                clientX: startX + 10,
                clientY: startY,
                dataTransfer,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 50));

        // Should have called with false
        expect(dragStates).toContain(false);
    });

    it("shows drag overlay when dragging over layout", async () => {
        const model = Model.fromJson(jsonModel);

        await render(<Layout model={model} factory={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

        // Wait for layout to render
        await new Promise((resolve) => setTimeout(resolve, 100));

        const tabButton = document.querySelector(".flexlayout__tab_button") as HTMLElement;
        const layoutElement = document.querySelector(".flexlayout__layout") as HTMLElement;

        const rect = tabButton.getBoundingClientRect();
        const startX = rect.left + rect.width / 2;
        const startY = rect.top + rect.height / 2;

        const dataTransfer = new DataTransfer();

        // Start drag
        tabButton.dispatchEvent(
            new DragEvent("dragstart", {
                bubbles: true,
                cancelable: true,
                clientX: startX,
                clientY: startY,
                dataTransfer,
            }),
        );

        // Enter layout
        layoutElement.dispatchEvent(
            new DragEvent("dragenter", {
                bubbles: true,
                cancelable: true,
                clientX: startX + 50,
                clientY: startY,
                dataTransfer,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 50));

        // Drag over to trigger overlay
        layoutElement.dispatchEvent(
            new DragEvent("dragover", {
                bubbles: true,
                cancelable: true,
                clientX: startX + 50,
                clientY: startY + 50,
                dataTransfer,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Should show outline rect
        const outlineRect = document.querySelector(".flexlayout__outline_rect");
        expect(outlineRect).not.toBeNull();

        // End drag
        tabButton.dispatchEvent(
            new DragEvent("dragend", {
                bubbles: true,
                cancelable: true,
                clientX: startX + 50,
                clientY: startY + 50,
                dataTransfer,
            }),
        );
    });

    // Tests for drag overlay visibility fix (dragleave handling)
    // This verifies the fix for: drag overlay disappearing when dragging into nested content.
    // The issue was that dragleave events would hide the overlay even when the cursor was
    // still inside the layout (just moving between child elements).

    it("drag overlay remains visible when dragging into content area", async () => {
        const model = Model.fromJson(jsonModel);

        await render(
            <Layout
                model={model}
                factory={(node) => (
                    <div data-testid={`content-${node.getId()}`} style={{ width: "100%", height: "100%" }}>
                        Content for {node.getName()}
                    </div>
                )}
            />,
            { container },
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        const tabButton = document.querySelectorAll(".flexlayout__tab_button")[1] as HTMLElement; // Use second tab
        const layoutElement = document.querySelector(".flexlayout__layout") as HTMLElement;
        const tabContent = document.querySelector(".flexlayout__tab") as HTMLElement;

        expect(tabButton).not.toBeNull();
        expect(layoutElement).not.toBeNull();
        expect(tabContent).not.toBeNull();

        const rect = tabButton.getBoundingClientRect();
        const startX = rect.left + rect.width / 2;
        const startY = rect.top + rect.height / 2;

        const dataTransfer = new DataTransfer();

        // Start drag on second tab
        tabButton.dispatchEvent(
            new DragEvent("dragstart", {
                bubbles: true,
                cancelable: true,
                clientX: startX,
                clientY: startY,
                dataTransfer,
            }),
        );

        // Enter layout
        layoutElement.dispatchEvent(
            new DragEvent("dragenter", {
                bubbles: true,
                cancelable: true,
                clientX: startX,
                clientY: startY,
                dataTransfer,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 50));

        // Drag over tab bar to show overlay
        layoutElement.dispatchEvent(
            new DragEvent("dragover", {
                bubbles: true,
                cancelable: true,
                clientX: startX,
                clientY: startY + 10,
                dataTransfer,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Verify overlay is visible
        const outlineRect = document.querySelector(".flexlayout__outline_rect") as HTMLElement;
        expect(outlineRect).not.toBeNull();
        expect(outlineRect.style.visibility).toBe("visible");

        // Now drag down into content area (100px below tab)
        const contentY = startY + 100;

        layoutElement.dispatchEvent(
            new DragEvent("dragover", {
                bubbles: true,
                cancelable: true,
                clientX: startX,
                clientY: contentY,
                dataTransfer,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Overlay should still be visible after dragging into content area
        const outlineAfterMove = document.querySelector(".flexlayout__outline_rect") as HTMLElement;
        expect(outlineAfterMove).not.toBeNull();
        expect(outlineAfterMove.style.visibility).toBe("visible");

        // End drag
        tabButton.dispatchEvent(
            new DragEvent("dragend", {
                bubbles: true,
                cancelable: true,
                clientX: startX,
                clientY: contentY,
                dataTransfer,
            }),
        );
    });

    it("drag overlay remains visible when dragleave fires with relatedTarget inside layout", async () => {
        const model = Model.fromJson(jsonModel);

        await render(
            <Layout
                model={model}
                factory={(node) => (
                    <div data-testid={`content-${node.getId()}`} style={{ width: "100%", height: "100%" }}>
                        Content for {node.getName()}
                    </div>
                )}
            />,
            { container },
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        const tabButton = document.querySelectorAll(".flexlayout__tab_button")[1] as HTMLElement;
        const layoutElement = document.querySelector(".flexlayout__layout") as HTMLElement;
        const tabContent = document.querySelector(".flexlayout__tab") as HTMLElement;

        const rect = tabButton.getBoundingClientRect();
        const startX = rect.left + rect.width / 2;
        const startY = rect.top + rect.height / 2;

        const dataTransfer = new DataTransfer();

        // Start drag
        tabButton.dispatchEvent(
            new DragEvent("dragstart", {
                bubbles: true,
                cancelable: true,
                clientX: startX,
                clientY: startY,
                dataTransfer,
            }),
        );

        // Enter layout
        layoutElement.dispatchEvent(
            new DragEvent("dragenter", {
                bubbles: true,
                cancelable: true,
                clientX: startX,
                clientY: startY,
                dataTransfer,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 50));

        // Drag over to show overlay
        layoutElement.dispatchEvent(
            new DragEvent("dragover", {
                bubbles: true,
                cancelable: true,
                clientX: startX,
                clientY: startY + 10,
                dataTransfer,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Verify overlay is visible
        let outlineRect = document.querySelector(".flexlayout__outline_rect") as HTMLElement;
        expect(outlineRect).not.toBeNull();
        expect(outlineRect.style.visibility).toBe("visible");

        // Simulate dragleave with relatedTarget being a child element (still inside layout)
        // This is what happens when cursor moves from one element to another within the layout
        layoutElement.dispatchEvent(
            new DragEvent("dragleave", {
                bubbles: true,
                cancelable: true,
                clientX: startX,
                clientY: startY + 100,
                dataTransfer,
                relatedTarget: tabContent, // Target is inside the layout
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Overlay should still be visible because relatedTarget is inside the layout
        outlineRect = document.querySelector(".flexlayout__outline_rect") as HTMLElement;
        expect(outlineRect).not.toBeNull();
        expect(outlineRect.style.visibility).toBe("visible");

        // End drag
        tabButton.dispatchEvent(
            new DragEvent("dragend", {
                bubbles: true,
                cancelable: true,
                clientX: startX,
                clientY: startY + 100,
                dataTransfer,
            }),
        );
    });

    it("drag overlay hides when dragleave fires with relatedTarget outside layout", async () => {
        const model = Model.fromJson(jsonModel);

        await render(
            <Layout
                model={model}
                factory={(node) => (
                    <div data-testid={`content-${node.getId()}`} style={{ width: "100%", height: "100%" }}>
                        Content for {node.getName()}
                    </div>
                )}
            />,
            { container },
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        const tabButton = document.querySelectorAll(".flexlayout__tab_button")[1] as HTMLElement;
        const layoutElement = document.querySelector(".flexlayout__layout") as HTMLElement;

        const rect = tabButton.getBoundingClientRect();
        const startX = rect.left + rect.width / 2;
        const startY = rect.top + rect.height / 2;

        const dataTransfer = new DataTransfer();

        // Start drag
        tabButton.dispatchEvent(
            new DragEvent("dragstart", {
                bubbles: true,
                cancelable: true,
                clientX: startX,
                clientY: startY,
                dataTransfer,
            }),
        );

        // Enter layout
        layoutElement.dispatchEvent(
            new DragEvent("dragenter", {
                bubbles: true,
                cancelable: true,
                clientX: startX,
                clientY: startY,
                dataTransfer,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 50));

        // Drag over to show overlay
        layoutElement.dispatchEvent(
            new DragEvent("dragover", {
                bubbles: true,
                cancelable: true,
                clientX: startX,
                clientY: startY + 10,
                dataTransfer,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Verify overlay is visible
        let outlineRect = document.querySelector(".flexlayout__outline_rect") as HTMLElement;
        expect(outlineRect).not.toBeNull();
        expect(outlineRect.style.visibility).toBe("visible");

        // Simulate dragleave with relatedTarget outside the layout (e.g., body or null)
        // This simulates cursor actually leaving the layout area
        layoutElement.dispatchEvent(
            new DragEvent("dragleave", {
                bubbles: true,
                cancelable: true,
                clientX: startX,
                clientY: startY - 100, // Above the layout
                dataTransfer,
                relatedTarget: document.body, // Target is outside the layout
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Overlay should be hidden because cursor left the layout
        outlineRect = document.querySelector(".flexlayout__outline_rect") as HTMLElement;
        // Either the rect is removed or visibility is hidden
        if (outlineRect) {
            expect(outlineRect.style.visibility).toBe("hidden");
        }

        // End drag
        tabButton.dispatchEvent(
            new DragEvent("dragend", {
                bubbles: true,
                cancelable: true,
                clientX: startX,
                clientY: startY - 100,
                dataTransfer,
            }),
        );
    });
});
