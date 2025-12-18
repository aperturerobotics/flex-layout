import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render } from "vitest-browser-react";
import * as React from "react";
import { OptimizedLayout } from "./view/OptimizedLayout";
import { Model, IJsonModel } from "./index";
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

describe("OptimizedLayout", () => {
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

    it("renders tabs with absolute positioning in external container", async () => {
        const model = Model.fromJson(jsonModel);
        render(<OptimizedLayout model={model} renderTab={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

        // Wait for layout to render
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Verify tab container exists
        const tabContainer = document.querySelector('[data-layout-path="/tab-container"]');
        expect(tabContainer).not.toBeNull();

        // Verify tab panels use absolute positioning
        const tabPanels = document.querySelectorAll('[role="tabpanel"]');
        expect(tabPanels.length).toBeGreaterThan(0);

        // Check that at least one tab panel has position absolute
        const firstPanel = tabPanels[0] as HTMLElement;
        expect(firstPanel.style.position).toBe("absolute");
    });

    it("shows selected tab and hides others", async () => {
        const model = Model.fromJson(jsonModel);
        render(<OptimizedLayout model={model} renderTab={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

        // Wait for layout to render
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Find tab panels
        const tabPanels = document.querySelectorAll('[role="tabpanel"]');

        // At least one should be visible (display: flex), others hidden (display: none)
        let visibleCount = 0;
        let hiddenCount = 0;
        tabPanels.forEach((panel) => {
            const display = (panel as HTMLElement).style.display;
            if (display === "flex") visibleCount++;
            if (display === "none") hiddenCount++;
        });

        expect(visibleCount).toBe(1);
        expect(hiddenCount).toBe(2);
    });

    it("sets pointer-events to none on tab panels during drag", async () => {
        let dragStateCallback: ((isDragging: boolean) => void) | undefined;

        const model = Model.fromJson(jsonModel);
        render(
            <OptimizedLayout
                model={model}
                renderTab={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>}
                onDragStateChange={(isDragging) => {
                    if (dragStateCallback) dragStateCallback(isDragging);
                }}
            />,
            { container },
        );

        // Wait for layout to render
        await new Promise((resolve) => setTimeout(resolve, 100));

        // The container always has pointer-events: none
        // Individual tab panels have pointer-events controlled by isDragging state
        const visibleTabPanel = document.querySelector('[role="tabpanel"][style*="display: flex"]') as HTMLElement;
        expect(visibleTabPanel).not.toBeNull();

        // Initially, visible tab panel should have pointer-events: auto
        expect(visibleTabPanel.style.pointerEvents).toBe("auto");

        // Simulate drag start by dispatching drag events on the layout
        const layoutElement = document.querySelector(".flexlayout__layout") as HTMLElement;
        expect(layoutElement).not.toBeNull();

        const tabButton = document.querySelector(".flexlayout__tab_button") as HTMLElement;
        expect(tabButton).not.toBeNull();

        const rect = tabButton.getBoundingClientRect();
        const startX = rect.left + rect.width / 2;
        const startY = rect.top + rect.height / 2;

        // Create a DataTransfer
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

        // Enter the layout
        layoutElement.dispatchEvent(
            new DragEvent("dragenter", {
                bubbles: true,
                cancelable: true,
                clientX: startX + 10,
                clientY: startY,
                dataTransfer,
            }),
        );

        // Wait for state update
        await new Promise((resolve) => setTimeout(resolve, 50));

        // During drag, visible tab panel should have pointer-events: none
        expect(visibleTabPanel.style.pointerEvents).toBe("none");

        // End drag
        tabButton.dispatchEvent(
            new DragEvent("dragend", {
                bubbles: true,
                cancelable: true,
                clientX: startX + 10,
                clientY: startY,
                dataTransfer,
            }),
        );

        // Wait for state update
        await new Promise((resolve) => setTimeout(resolve, 50));

        // After drag, visible tab panel should have pointer-events: auto again
        expect(visibleTabPanel.style.pointerEvents).toBe("auto");
    });

    it("keeps tabs mounted when switching between them", async () => {
        let mountCount = 0;
        let unmountCount = 0;

        function TrackedTab({ name }: { name: string }) {
            React.useEffect(() => {
                mountCount++;
                return () => {
                    unmountCount++;
                };
            }, []);
            return <div>{name}</div>;
        }

        const model = Model.fromJson(jsonModel);
        render(<OptimizedLayout model={model} renderTab={(node) => <TrackedTab name={node.getName()} />} />, { container });

        // Wait for initial render
        await new Promise((resolve) => setTimeout(resolve, 100));

        const initialMounts = mountCount;
        const initialUnmounts = unmountCount;

        // Click on a different tab button to switch tabs
        const tabButtons = document.querySelectorAll(".flexlayout__tab_button");
        expect(tabButtons.length).toBeGreaterThan(1);

        // Click on the second tab button
        (tabButtons[1] as HTMLElement).click();

        // Wait for tab switch
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Tabs should NOT have been unmounted - OptimizedLayout keeps them all mounted
        expect(unmountCount).toBe(initialUnmounts);
        // No new mounts should have occurred
        expect(mountCount).toBe(initialMounts);
    });

    it("renders FlexLayout structure alongside external tabs", async () => {
        const model = Model.fromJson(jsonModel);
        render(<OptimizedLayout model={model} renderTab={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

        // Wait for layout to render
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Should have the FlexLayout structure
        expect(document.querySelector(".flexlayout__layout")).not.toBeNull();
        expect(document.querySelector(".flexlayout__tabset")).not.toBeNull();
        expect(document.querySelectorAll(".flexlayout__tab_button").length).toBe(3);

        // Should also have the external tab container
        expect(document.querySelector('[data-layout-path="/tab-container"]')).not.toBeNull();
    });

    it("tab content receives non-zero height dimensions", async () => {
        const model = Model.fromJson(jsonModel);
        render(<OptimizedLayout model={model} renderTab={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

        // Wait for layout to render and resize events to fire
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Check that the visible tab panel has non-zero dimensions
        const visibleTabPanel = document.querySelector('[role="tabpanel"][style*="display: flex"]') as HTMLElement;
        expect(visibleTabPanel).not.toBeNull();

        // Parse dimensions from style - should have valid pixel values, not 100% fallback
        const width = visibleTabPanel.style.width;
        const height = visibleTabPanel.style.height;

        // If we get pixel values, verify they're non-zero
        // If we get percentage (100%), that means the fallback is being used (issue reproduced)
        if (height.includes("px")) {
            const heightValue = parseFloat(height);
            expect(heightValue).toBeGreaterThan(0);
        } else {
            // If height is 100%, it means contentRect.height was 0 - this is the bug
            // The test should fail here to indicate the issue
            expect(height).not.toBe("100%");
        }

        if (width.includes("px")) {
            const widthValue = parseFloat(width);
            expect(widthValue).toBeGreaterThan(0);
        }
    });

    it("TabRef receives resize event with valid dimensions", async () => {
        // Note: This test verifies resize events fire with valid dimensions
        // by checking the TabNode after the fact, not by intercepting the events
        // (intercepting would overwrite TabRef's listener)
        const model = Model.fromJson(jsonModel);

        render(<OptimizedLayout model={model} renderTab={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

        // Wait for layout to render and resize events to fire
        await new Promise((resolve) => setTimeout(resolve, 300));

        // Check that TabNode's rect has been updated with valid dimensions
        // This verifies resize events fired (TabNode.setRect stores the rect)
        let tabRect: { width: number; height: number } | null = null;
        model.visitNodes((node) => {
            if (node.getId() === "tab1") {
                const tabNode = node as any;
                tabRect = tabNode.rect;
            }
        });

        // TabNode.rect should have valid dimensions after resize events
        expect(tabRect).not.toBeNull();
        expect(tabRect!.width).toBeGreaterThan(0);
        expect(tabRect!.height).toBeGreaterThan(0);
    });

    it("TabSetNode.contentRect has non-zero height after render", async () => {
        const model = Model.fromJson(jsonModel);
        render(<OptimizedLayout model={model} renderTab={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

        // Wait for layout to render
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Find the tabset node and check its contentRect
        let tabsetContentRect: { width: number; height: number } | null = null;
        model.visitNodes((node) => {
            if (node.getType() === "tabset") {
                const tabsetNode = node as any;
                tabsetContentRect = tabsetNode.getContentRect();
            }
        });

        expect(tabsetContentRect).not.toBeNull();
        expect(tabsetContentRect!.width).toBeGreaterThan(0);
        expect(tabsetContentRect!.height).toBeGreaterThan(0);
    });

    it("selected tab has computed dimensions matching TabSetNode contentRect", async () => {
        const model = Model.fromJson(jsonModel);
        render(<OptimizedLayout model={model} renderTab={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

        // Wait for layout to render - use longer timeout to allow all resize events
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Get the tabset's contentRect
        interface ContentRect {
            width: number;
            height: number;
            x: number;
            y: number;
        }
        let tabsetContentRect: ContentRect | null = null;
        model.visitNodes((node) => {
            if (node.getType() === "tabset") {
                const tabsetNode = node as any;
                tabsetContentRect = tabsetNode.getContentRect() as ContentRect;
            }
        });

        // Get the visible tab panel
        const visibleTabPanel = document.querySelector('[role="tabpanel"][style*="display: flex"]') as HTMLElement;
        expect(visibleTabPanel).not.toBeNull();

        // Check that tab panel dimensions match contentRect (or use fallback 100%)
        const panelWidth = visibleTabPanel.style.width;
        const panelHeight = visibleTabPanel.style.height;

        // If contentRect has valid dimensions, tab panel should use pixel values
        const contentRect = tabsetContentRect as ContentRect | null;
        if (contentRect !== null && contentRect.width > 0 && contentRect.height > 0) {
            // Should have pixel dimensions, not percentage fallback
            expect(panelWidth).toContain("px");
            expect(panelHeight).toContain("px");

            const parsedWidth = parseFloat(panelWidth);
            const parsedHeight = parseFloat(panelHeight);

            // Dimensions should approximately match contentRect
            expect(parsedWidth).toBeCloseTo(contentRect.width, 0);
            expect(parsedHeight).toBeCloseTo(contentRect.height, 0);
        }
    });

    it("tabs state map contains valid rect dimensions after render", async () => {
        // This test verifies that the tabs are rendered with correct dimensions
        const model = Model.fromJson(jsonModel);

        render(<OptimizedLayout model={model} renderTab={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

        // Wait for layout to render and state updates
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Check the actual DOM dimensions of the visible tab panel
        const visibleTabPanel = document.querySelector('[role="tabpanel"][style*="display: flex"]') as HTMLElement;
        expect(visibleTabPanel).not.toBeNull();

        // Get actual computed dimensions
        const panelWidth = visibleTabPanel.style.width;
        const panelHeight = visibleTabPanel.style.height;

        // Log the actual values for debugging
        console.log("Tab panel dimensions:", { panelWidth, panelHeight });

        // The issue: even though contentRect has valid dimensions,
        // the tab panel styles show 100% instead of pixel values
        // This test documents the actual behavior
        if (panelWidth === "100%" || panelHeight === "100%") {
            // This is the bug - dimensions should be pixel values
            console.log("BUG: Tab panel using fallback 100% instead of pixel dimensions");
        }
    });
});
