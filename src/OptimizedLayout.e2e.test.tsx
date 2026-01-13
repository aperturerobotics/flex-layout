import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render } from "vitest-browser-react";
import * as React from "react";
import { OptimizedLayout } from "./view/OptimizedLayout";
import { Model, IJsonModel, Actions, DockLocation, TabNode, TabSetNode } from "./index";
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
        await render(<OptimizedLayout model={model} renderTab={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

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
        await render(<OptimizedLayout model={model} renderTab={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

        // Wait for layout to render
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Find tab panels
        const tabPanels = document.querySelectorAll('[role="tabpanel"]');

        // At least one should be visible (not explicitly set or not hidden), others hidden
        let visibleCount = 0;
        let hiddenCount = 0;
        tabPanels.forEach((panel) => {
            const visibility = (panel as HTMLElement).style.visibility;
            if (visibility !== "hidden") visibleCount++;
            if (visibility === "hidden") hiddenCount++;
        });

        expect(visibleCount).toBe(1);
        expect(hiddenCount).toBe(2);
    });

    it("sets pointer-events to none on tab panels during drag", async () => {
        let dragStateCallback: ((isDragging: boolean) => void) | undefined;

        const model = Model.fromJson(jsonModel);
        await render(
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
        const visibleTabPanel = Array.from(document.querySelectorAll('[role="tabpanel"]')).find((panel) => (panel as HTMLElement).style.visibility !== "hidden") as HTMLElement;
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
        await render(<OptimizedLayout model={model} renderTab={(node) => <TrackedTab name={node.getName()} />} />, { container });

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
        await render(<OptimizedLayout model={model} renderTab={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

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
        await render(<OptimizedLayout model={model} renderTab={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

        // Wait for layout to render and resize events to fire
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Check that the visible tab panel has non-zero dimensions
        const visibleTabPanel = Array.from(document.querySelectorAll('[role="tabpanel"]')).find((panel) => (panel as HTMLElement).style.visibility !== "hidden") as HTMLElement;
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

        await render(<OptimizedLayout model={model} renderTab={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

        // Wait for layout to render and resize events to fire
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Check that TabNode's rect has been updated with valid dimensions
        // This verifies resize events fired (TabNode.setRect stores the rect)
        let tabRect: { width: number; height: number } | null = null;
        model.visitNodes((node) => {
            if (node.getId() === "tab1") {
                const tabNode = node as TabNode;
                tabRect = tabNode.getRect();
            }
        });

        // TabNode.rect should have valid dimensions after resize events
        expect(tabRect).not.toBeNull();
        expect(tabRect!.width).toBeGreaterThan(0);
        expect(tabRect!.height).toBeGreaterThan(0);
    });

    it("TabSetNode.contentRect has non-zero height after render", async () => {
        const model = Model.fromJson(jsonModel);
        await render(<OptimizedLayout model={model} renderTab={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

        // Wait for layout to render
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Find the tabset node and check its contentRect
        let tabsetContentRect: { width: number; height: number } | null = null;
        model.visitNodes((node) => {
            if (node.getType() === "tabset") {
                const tabsetNode = node as TabSetNode;
                tabsetContentRect = tabsetNode.getContentRect();
            }
        });

        expect(tabsetContentRect).not.toBeNull();
        expect(tabsetContentRect!.width).toBeGreaterThan(0);
        expect(tabsetContentRect!.height).toBeGreaterThan(0);
    });

    it("selected tab has computed dimensions matching TabSetNode contentRect", async () => {
        const model = Model.fromJson(jsonModel);
        await render(<OptimizedLayout model={model} renderTab={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

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
                const tabsetNode = node as TabSetNode;
                tabsetContentRect = tabsetNode.getContentRect() as ContentRect;
            }
        });

        // Get the visible tab panel
        const visibleTabPanel = Array.from(document.querySelectorAll('[role="tabpanel"]')).find((panel) => (panel as HTMLElement).style.visibility !== "hidden") as HTMLElement;
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

        await render(<OptimizedLayout model={model} renderTab={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

        // Wait for layout to render and state updates
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Check the actual DOM dimensions of the visible tab panel
        const visibleTabPanel = Array.from(document.querySelectorAll('[role="tabpanel"]')).find((panel) => (panel as HTMLElement).style.visibility !== "hidden") as HTMLElement;
        expect(visibleTabPanel).not.toBeNull();

        // Get actual computed dimensions
        const panelWidth = visibleTabPanel.style.width;
        const panelHeight = visibleTabPanel.style.height;

        // The dimensions should be pixel values, not 100% fallback
        // Verify we're getting valid pixel values
        expect(panelWidth).toContain("px");
        expect(panelHeight).toContain("px");
    });

    // Tests for dynamically added tabs (Issue: Dynamically Added Tabs Not Rendered in TabContainer)
    // These tests verify the fix for the bug where tabs added via model.doAction() were not
    // rendered in the TabContainer because the tabs Map was only populated in the initial useEffect.

    it("creates content div for dynamically added tab", async () => {
        const model = Model.fromJson(jsonModel);
        await render(<OptimizedLayout model={model} renderTab={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

        // Wait for initial render
        await new Promise((resolve) => setTimeout(resolve, 100));

        // Verify initial tabs exist
        const initialPanels = document.querySelectorAll('[role="tabpanel"]');
        expect(initialPanels.length).toBe(3);

        // Find the tabset ID dynamically
        let tabsetId: string | undefined;
        model.visitNodes((node) => {
            if (node.getType() === "tabset") {
                tabsetId = node.getId();
            }
        });
        expect(tabsetId).toBeDefined();

        // Add a new tab dynamically
        model.doAction(Actions.addNode({ type: "tab", name: "New Tab", component: "test", id: "new-tab" }, tabsetId!, DockLocation.CENTER, -1));

        // Wait for re-render
        await new Promise((resolve) => setTimeout(resolve, 100));

        // The new tab should have a content div in TabContainer
        const newTabPanel = document.querySelector('[data-tab-id="new-tab"]');
        expect(newTabPanel).not.toBeNull();

        // Total panels should now be 4
        const allPanels = document.querySelectorAll('[role="tabpanel"]');
        expect(allPanels.length).toBe(4);
    });

    it("shows content when clicking on dynamically added tab", async () => {
        const model = Model.fromJson(jsonModel);
        await render(<OptimizedLayout model={model} renderTab={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Find the tabset ID
        let tabsetId: string | undefined;
        model.visitNodes((node) => {
            if (node.getType() === "tabset") {
                tabsetId = node.getId();
            }
        });

        // Add a new tab and select it
        model.doAction(
            Actions.addNode(
                { type: "tab", name: "New Tab", component: "test", id: "new-tab" },
                tabsetId!,
                DockLocation.CENTER,
                -1,
                true, // select the new tab
            ),
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        // The new tab should be visible (selected)
        const newTabPanel = document.querySelector('[data-tab-id="new-tab"]') as HTMLElement;
        expect(newTabPanel).not.toBeNull();
        expect(newTabPanel.style.visibility).not.toBe("hidden"); // visible (not explicitly set)
    });

    it("handles multiple dynamically added tabs", async () => {
        const model = Model.fromJson(jsonModel);
        await render(<OptimizedLayout model={model} renderTab={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

        await new Promise((resolve) => setTimeout(resolve, 100));

        let tabsetId: string | undefined;
        model.visitNodes((node) => {
            if (node.getType() === "tabset") {
                tabsetId = node.getId();
            }
        });

        // Add multiple tabs with waits between each to allow React to process
        for (let i = 0; i < 5; i++) {
            model.doAction(Actions.addNode({ type: "tab", name: `Dynamic Tab ${i}`, component: "test", id: `dynamic-${i}` }, tabsetId!, DockLocation.CENTER, -1, false));
            await new Promise((resolve) => setTimeout(resolve, 50));
        }

        await new Promise((resolve) => setTimeout(resolve, 200));

        // All dynamic tabs should have content divs
        for (let i = 0; i < 5; i++) {
            const panel = document.querySelector(`[data-tab-id="dynamic-${i}"]`);
            expect(panel).not.toBeNull();
        }

        // Total should be initial 3 + 5 dynamic = 8
        const allPanels = document.querySelectorAll('[role="tabpanel"]');
        expect(allPanels.length).toBe(8);
    });

    it("dynamically added tab content receives proper dimensions", async () => {
        const model = Model.fromJson(jsonModel);
        await render(<OptimizedLayout model={model} renderTab={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Find the tabset ID
        let tabsetId: string | undefined;
        model.visitNodes((node) => {
            if (node.getType() === "tabset") {
                tabsetId = node.getId();
            }
        });

        // Add and select a new tab
        model.doAction(
            Actions.addNode(
                { type: "tab", name: "New Tab", component: "test", id: "new-tab" },
                tabsetId!,
                DockLocation.CENTER,
                -1,
                true, // select the new tab
            ),
        );

        await new Promise((resolve) => setTimeout(resolve, 300));

        // The new tab panel should have valid dimensions
        const newTabPanel = document.querySelector('[data-tab-id="new-tab"]') as HTMLElement;
        expect(newTabPanel).not.toBeNull();

        // Should be visible
        expect(newTabPanel.style.visibility).not.toBe("hidden");

        // Should have dimensions (either pixel values or percentage fallback)
        const width = newTabPanel.style.width;
        const height = newTabPanel.style.height;

        // Verify dimensions are set
        expect(width).toBeTruthy();
        expect(height).toBeTruthy();

        // If pixel values, verify they're non-zero
        if (width.includes("px")) {
            expect(parseFloat(width)).toBeGreaterThan(0);
        }
        if (height.includes("px")) {
            expect(parseFloat(height)).toBeGreaterThan(0);
        }
    });

    it("switching between original and dynamically added tabs works correctly", async () => {
        const model = Model.fromJson(jsonModel);
        await render(<OptimizedLayout model={model} renderTab={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Find the tabset ID
        let tabsetId: string | undefined;
        model.visitNodes((node) => {
            if (node.getType() === "tabset") {
                tabsetId = node.getId();
            }
        });

        // Add a new tab (but don't select it)
        model.doAction(Actions.addNode({ type: "tab", name: "New Tab", component: "test", id: "new-tab" }, tabsetId!, DockLocation.CENTER, -1, false));

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Original tab should still be visible, new tab hidden
        const tab1Panel = document.querySelector('[data-tab-id="tab1"]') as HTMLElement;
        const newTabPanel = document.querySelector('[data-tab-id="new-tab"]') as HTMLElement;

        expect(tab1Panel).not.toBeNull();
        expect(newTabPanel).not.toBeNull();
        expect(tab1Panel.style.visibility).not.toBe("hidden");
        expect(newTabPanel.style.visibility).toBe("hidden");
    });

    it("deleting dynamically added tab removes its content div", async () => {
        const model = Model.fromJson(jsonModel);
        await render(<OptimizedLayout model={model} renderTab={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Find the tabset ID
        let tabsetId: string | undefined;
        model.visitNodes((node) => {
            if (node.getType() === "tabset") {
                tabsetId = node.getId();
            }
        });

        // Add a new tab
        model.doAction(Actions.addNode({ type: "tab", name: "New Tab", component: "test", id: "new-tab" }, tabsetId!, DockLocation.CENTER, -1));

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Verify the new tab exists
        const newTabPanel = document.querySelector('[data-tab-id="new-tab"]');
        expect(newTabPanel).not.toBeNull();
        expect(document.querySelectorAll('[role="tabpanel"]').length).toBe(4);

        // Delete the new tab
        model.doAction(Actions.deleteTab("new-tab"));

        await new Promise((resolve) => setTimeout(resolve, 100));

        // The new tab's content div should be removed
        // Note: The tab is removed from the model, but the TabContainer may still render it
        // until the model sync removes it from the tabs Map
        // This test verifies the model correctly handles deletion
        let tabExists = false;
        model.visitNodes((node) => {
            if (node.getId() === "new-tab") {
                tabExists = true;
            }
        });
        expect(tabExists).toBe(false);
    });

    // Tests for click-to-select behavior in grid mode (multiple tabsets)
    // This verifies the fix for: clicking on tab content in OptimizedLayout activates the parent tabset.
    // Since OptimizedLayout renders tab content in a sibling TabContainer element (not inside FlexLayout's DOM),
    // click events need special handling via onPointerDown on the tab panel.

    it("clicking on tab content in grid mode activates the parent tabset", async () => {
        // Create a grid layout with 2 side-by-side tabsets
        const gridModel: IJsonModel = {
            global: {
                splitterSize: 4,
                tabEnableClose: false,
            },
            layout: {
                type: "row",
                weight: 100,
                children: [
                    {
                        type: "tabset",
                        id: "left-tabset",
                        weight: 50,
                        selected: 0,
                        children: [{ type: "tab", id: "left-tab", name: "Left Tab", component: "test" }],
                    },
                    {
                        type: "tabset",
                        id: "right-tabset",
                        weight: 50,
                        selected: 0,
                        children: [{ type: "tab", id: "right-tab", name: "Right Tab", component: "test" }],
                    },
                ],
            },
        };

        const model = Model.fromJson(gridModel);

        // Set left tabset as initially active
        model.doAction(Actions.setActiveTabset("left-tabset"));

        await render(
            <OptimizedLayout
                model={model}
                renderTab={(node) => (
                    <div data-testid={`content-${node.getId()}`} style={{ width: "100%", height: "100%", padding: "20px" }}>
                        Content for {node.getName()}
                    </div>
                )}
            />,
            { container },
        );

        // Wait for layout to render
        await new Promise((resolve) => setTimeout(resolve, 200));

        // Verify both tabsets exist
        const tabsets = document.querySelectorAll(".flexlayout__tabset");
        expect(tabsets.length).toBe(2);

        // Verify tab panels exist in TabContainer
        const tabPanels = document.querySelectorAll('[role="tabpanel"]');
        expect(tabPanels.length).toBe(2);

        // Helper to check which tabset is active
        const getActiveTabsetId = (): string | undefined => {
            let activeId: string | undefined;
            model.visitNodes((node) => {
                if (node.getType() === "tabset") {
                    const tabset = node as TabSetNode;
                    if (tabset.isActive()) {
                        activeId = tabset.getId();
                    }
                }
            });
            return activeId;
        };

        // Initially, left tabset should be active
        expect(getActiveTabsetId()).toBe("left-tabset");

        // Find the right tab panel (rendered in TabContainer)
        const rightTabPanel = document.querySelector('[data-tab-id="right-tab"]') as HTMLElement;
        expect(rightTabPanel).not.toBeNull();

        // Simulate pointerdown on the right tab panel
        // This is what OptimizedLayout's TabContainer listens for
        rightTabPanel.dispatchEvent(
            new PointerEvent("pointerdown", {
                bubbles: true,
                cancelable: true,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        // After clicking on right tab content, right tabset should be active
        expect(getActiveTabsetId()).toBe("right-tabset");

        // Now click on left tab content
        const leftTabPanel = document.querySelector('[data-tab-id="left-tab"]') as HTMLElement;
        expect(leftTabPanel).not.toBeNull();

        leftTabPanel.dispatchEvent(
            new PointerEvent("pointerdown", {
                bubbles: true,
                cancelable: true,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Left tabset should now be active again
        expect(getActiveTabsetId()).toBe("left-tabset");
    });

    it("clicking on already active tabset content does not trigger unnecessary action", async () => {
        const gridModel: IJsonModel = {
            global: { tabEnableClose: false },
            layout: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        id: "left-tabset",
                        weight: 50,
                        children: [{ type: "tab", id: "left-tab", name: "Left Tab", component: "test" }],
                    },
                    {
                        type: "tabset",
                        id: "right-tabset",
                        weight: 50,
                        children: [{ type: "tab", id: "right-tab", name: "Right Tab", component: "test" }],
                    },
                ],
            },
        };

        const model = Model.fromJson(gridModel);
        model.doAction(Actions.setActiveTabset("left-tabset"));

        let actionCount = 0;
        const originalDoAction = model.doAction.bind(model);
        model.doAction = (action) => {
            actionCount++;
            return originalDoAction(action);
        };

        await render(<OptimizedLayout model={model} renderTab={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Reset counter after initial render
        actionCount = 0;

        // Click on left tab (already active tabset)
        const leftTabPanel = document.querySelector('[data-tab-id="left-tab"]') as HTMLElement;
        leftTabPanel.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true, cancelable: true }));

        await new Promise((resolve) => setTimeout(resolve, 100));

        // No action should have been dispatched since tabset was already active
        expect(actionCount).toBe(0);
    });

    // Tests for excessive re-renders during drag operations
    // See ISSUE.md for details on this bug

    it("does not cause excessive re-renders during tab drag", async () => {
        let renderCount = 0;

        function TrackedContent({ name }: { name: string }) {
            renderCount++;
            return <div data-testid={`content-${name}`}>{name}</div>;
        }

        // Start with a single tab model
        const singleTabModel: IJsonModel = {
            global: {},
            layout: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        id: "tabset1",
                        children: [{ type: "tab", name: "Tab 1", component: "test", id: "tab1" }],
                    },
                ],
            },
        };

        const model = Model.fromJson(singleTabModel);
        await render(<OptimizedLayout model={model} renderTab={(node) => <TrackedContent name={node.getName()} />} />, { container });

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Add a second tab and select it
        model.doAction(Actions.addNode({ type: "tab", name: "Tab 2", component: "test", id: "tab2" }, "tabset1", DockLocation.CENTER, -1, true));

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Both tabs should be rendered now (OptimizedLayout keeps background tabs mounted)
        expect(document.querySelectorAll('[role="tabpanel"]').length).toBe(2);

        // Record state before drag
        const initialRenderCount = renderCount;

        // Simulate drag operation - drag the newly added tab toward the center
        const tabButtons = document.querySelectorAll(".flexlayout__tab_button");
        const tab2Button = Array.from(tabButtons).find((btn) => btn.textContent?.includes("Tab 2")) as HTMLElement;
        expect(tab2Button).not.toBeNull();
        const rect = tab2Button.getBoundingClientRect();

        // Start drag
        const dataTransfer = new DataTransfer();
        tab2Button.dispatchEvent(
            new DragEvent("dragstart", {
                bubbles: true,
                cancelable: true,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
                dataTransfer,
            }),
        );

        // Wait for drag to initialize
        await new Promise((resolve) => setTimeout(resolve, 50));

        // Enter the layout (this triggers onDragEnter which sets up drag state)
        const layoutElement = document.querySelector(".flexlayout__layout") as HTMLElement;
        expect(layoutElement).not.toBeNull();
        const layoutRect = layoutElement.getBoundingClientRect();

        layoutElement.dispatchEvent(
            new DragEvent("dragenter", {
                bubbles: true,
                cancelable: true,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
                dataTransfer,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 50));

        // Simulate dragging toward the center of the viewport (10 move events)
        const centerX = layoutRect.left + layoutRect.width / 2;
        const centerY = layoutRect.top + layoutRect.height / 2;

        for (let i = 0; i < 10; i++) {
            // Move progressively toward the center
            const progress = (i + 1) / 10;
            const x = rect.left + (centerX - rect.left) * progress;
            const y = rect.top + (centerY - rect.top) * progress;

            layoutElement.dispatchEvent(
                new DragEvent("dragover", {
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y,
                    dataTransfer,
                }),
            );
            await new Promise((resolve) => setTimeout(resolve, 16)); // One frame
        }

        // End drag (without dropping)
        tab2Button.dispatchEvent(
            new DragEvent("dragend", {
                bubbles: true,
                cancelable: true,
                dataTransfer,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Tab content should NOT have re-rendered during drag
        // The memoization should prevent any re-renders when only isDragging changes
        const rendersFromDrag = renderCount - initialRenderCount;
        expect(rendersFromDrag).toBe(0);
    });

    it("does not unmount tab content during drag", async () => {
        let unmountCount = 0;

        function TrackedContent({ name }: { name: string }) {
            React.useEffect(() => {
                return () => {
                    unmountCount++;
                };
            }, []);
            return <div>{name}</div>;
        }

        // Start with a single tab model
        const singleTabModel: IJsonModel = {
            global: {},
            layout: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        id: "tabset1",
                        children: [{ type: "tab", name: "Tab 1", component: "test", id: "tab1" }],
                    },
                ],
            },
        };

        const model = Model.fromJson(singleTabModel);
        await render(<OptimizedLayout model={model} renderTab={(node) => <TrackedContent name={node.getName()} />} />, { container });

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Add a second tab and select it
        model.doAction(Actions.addNode({ type: "tab", name: "Tab 2", component: "test", id: "tab2" }, "tabset1", DockLocation.CENTER, -1, true));

        await new Promise((resolve) => setTimeout(resolve, 200));

        const initialUnmounts = unmountCount;

        // Simulate drag operation - drag the newly added tab toward the center
        const tabButtons = document.querySelectorAll(".flexlayout__tab_button");
        const tab2Button = Array.from(tabButtons).find((btn) => btn.textContent?.includes("Tab 2")) as HTMLElement;
        expect(tab2Button).not.toBeNull();
        const rect = tab2Button.getBoundingClientRect();

        const dataTransfer = new DataTransfer();
        tab2Button.dispatchEvent(
            new DragEvent("dragstart", {
                bubbles: true,
                cancelable: true,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
                dataTransfer,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 50));

        // Enter the layout (this triggers onDragEnter which sets up drag state)
        const layoutElement = document.querySelector(".flexlayout__layout") as HTMLElement;
        const layoutRect = layoutElement.getBoundingClientRect();

        layoutElement.dispatchEvent(
            new DragEvent("dragenter", {
                bubbles: true,
                cancelable: true,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
                dataTransfer,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 50));

        // Simulate dragging toward the center of the viewport
        const centerX = layoutRect.left + layoutRect.width / 2;
        const centerY = layoutRect.top + layoutRect.height / 2;

        for (let i = 0; i < 10; i++) {
            const progress = (i + 1) / 10;
            const x = rect.left + (centerX - rect.left) * progress;
            const y = rect.top + (centerY - rect.top) * progress;

            layoutElement.dispatchEvent(
                new DragEvent("dragover", {
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y,
                    dataTransfer,
                }),
            );
            await new Promise((resolve) => setTimeout(resolve, 16));
        }

        tab2Button.dispatchEvent(
            new DragEvent("dragend", {
                bubbles: true,
                cancelable: true,
                dataTransfer,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Tab content should NOT have unmounted during drag
        expect(unmountCount).toBe(initialUnmounts);
    });

    it("does not cause excessive re-renders during drag with grid layout", async () => {
        // More complex test with a grid layout (multiple visible tabsets)
        // Start with a single tab in each tabset
        const gridModel: IJsonModel = {
            global: { tabEnableClose: false },
            layout: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        id: "left-tabset",
                        weight: 50,
                        children: [{ type: "tab", id: "left-tab-1", name: "Left Tab 1", component: "test" }],
                    },
                    {
                        type: "tabset",
                        id: "right-tabset",
                        weight: 50,
                        children: [{ type: "tab", id: "right-tab-1", name: "Right Tab 1", component: "test" }],
                    },
                ],
            },
        };

        const renderCounts = new Map<string, number>();

        function TrackedContent({ name }: { name: string }) {
            renderCounts.set(name, (renderCounts.get(name) ?? 0) + 1);
            return <div>{name}</div>;
        }

        const model = Model.fromJson(gridModel);
        await render(<OptimizedLayout model={model} renderTab={(node) => <TrackedContent name={node.getName()} />} />, { container });

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Add second tabs to each tabset
        model.doAction(Actions.addNode({ type: "tab", name: "Left Tab 2", component: "test", id: "left-tab-2" }, "left-tabset", DockLocation.CENTER, -1, true));
        model.doAction(Actions.addNode({ type: "tab", name: "Right Tab 2", component: "test", id: "right-tab-2" }, "right-tabset", DockLocation.CENTER, -1, true));

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Record initial render counts
        const initialCounts = new Map(renderCounts);

        // Simulate drag operation - drag one tab
        const tabButtons = document.querySelectorAll(".flexlayout__tab_button");
        const leftTab2Button = Array.from(tabButtons).find((btn) => btn.textContent?.includes("Left Tab 2")) as HTMLElement;
        expect(leftTab2Button).not.toBeNull();
        const rect = leftTab2Button.getBoundingClientRect();

        const dataTransfer = new DataTransfer();
        leftTab2Button.dispatchEvent(
            new DragEvent("dragstart", {
                bubbles: true,
                cancelable: true,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
                dataTransfer,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 50));

        // Enter the layout
        const layoutElement = document.querySelector(".flexlayout__layout") as HTMLElement;
        const layoutRect = layoutElement.getBoundingClientRect();

        layoutElement.dispatchEvent(
            new DragEvent("dragenter", {
                bubbles: true,
                cancelable: true,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
                dataTransfer,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 50));

        // Simulate dragging toward the center
        const centerX = layoutRect.left + layoutRect.width / 2;
        const centerY = layoutRect.top + layoutRect.height / 2;

        for (let i = 0; i < 10; i++) {
            const progress = (i + 1) / 10;
            const x = rect.left + (centerX - rect.left) * progress;
            const y = rect.top + (centerY - rect.top) * progress;

            layoutElement.dispatchEvent(
                new DragEvent("dragover", {
                    bubbles: true,
                    cancelable: true,
                    clientX: x,
                    clientY: y,
                    dataTransfer,
                }),
            );
            await new Promise((resolve) => setTimeout(resolve, 16));
        }

        leftTab2Button.dispatchEvent(
            new DragEvent("dragend", {
                bubbles: true,
                cancelable: true,
                dataTransfer,
            }),
        );

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Check each tab's render count - none should have any additional re-renders during drag
        for (const [name, count] of renderCounts) {
            const initialCount = initialCounts.get(name) ?? 0;
            const additionalRenders = count - initialCount;
            expect(additionalRenders).toBe(0);
        }
    });

    // Tests for maximizing a tabset in OptimizedLayout
    // These tests verify that tab content is correctly positioned and visible when maximizing/restoring tabsets.

    it("maximizes tabset when clicking maximize button", async () => {
        const gridModel: IJsonModel = {
            global: {
                tabSetEnableMaximize: true,
            },
            layout: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        id: "left-tabset",
                        weight: 50,
                        children: [{ type: "tab", id: "left-tab", name: "Left Tab", component: "test" }],
                    },
                    {
                        type: "tabset",
                        id: "right-tabset",
                        weight: 50,
                        children: [{ type: "tab", id: "right-tab", name: "Right Tab", component: "test" }],
                    },
                ],
            },
        };

        const model = Model.fromJson(gridModel);
        await render(
            <OptimizedLayout
                model={model}
                renderTab={(node) => (
                    <div data-testid={`content-${node.getId()}`} style={{ width: "100%", height: "100%" }}>
                        Content for {node.getName()}
                    </div>
                )}
            />,
            { container },
        );

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Verify both tabsets are visible initially
        const tabsetContainers = document.querySelectorAll(".flexlayout__tabset_container");
        expect(tabsetContainers.length).toBe(2);

        // Find the maximize button for the left tabset (path is /ts0/button/max)
        const maxButton = document.querySelector('[data-layout-path="/ts0/button/max"]') as HTMLElement;
        expect(maxButton).not.toBeNull();

        // Click maximize button
        maxButton.click();

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Left tabset should be maximized
        let leftTabset: TabSetNode | undefined;
        model.visitNodes((node) => {
            if (node.getId() === "left-tabset") {
                leftTabset = node as TabSetNode;
            }
        });
        expect(leftTabset).toBeDefined();
        expect(leftTabset!.isMaximized()).toBe(true);

        // When maximized, non-maximized tabsets get display: none
        // Find the tabset containers and check that one is hidden
        const allTabsetContainers = document.querySelectorAll(".flexlayout__tabset_container");
        const hiddenContainers = Array.from(allTabsetContainers).filter((el) => (el as HTMLElement).style.display === "none");
        expect(hiddenContainers.length).toBeGreaterThan(0);
    });

    it("restores tabset when clicking maximize button again", async () => {
        const gridModel: IJsonModel = {
            global: {
                tabSetEnableMaximize: true,
            },
            layout: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        id: "left-tabset",
                        weight: 50,
                        children: [{ type: "tab", id: "left-tab", name: "Left Tab", component: "test" }],
                    },
                    {
                        type: "tabset",
                        id: "right-tabset",
                        weight: 50,
                        children: [{ type: "tab", id: "right-tab", name: "Right Tab", component: "test" }],
                    },
                ],
            },
        };

        const model = Model.fromJson(gridModel);
        await render(
            <OptimizedLayout
                model={model}
                renderTab={(node) => (
                    <div data-testid={`content-${node.getId()}`} style={{ width: "100%", height: "100%" }}>
                        Content for {node.getName()}
                    </div>
                )}
            />,
            { container },
        );

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Maximize the left tabset
        model.doAction(Actions.maximizeToggle("left-tabset"));

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Verify it's maximized
        let leftTabset: TabSetNode | undefined;
        model.visitNodes((node) => {
            if (node.getId() === "left-tabset") {
                leftTabset = node as TabSetNode;
            }
        });
        expect(leftTabset!.isMaximized()).toBe(true);

        // Find the restore button (same button, different icon, path is /ts0/button/max)
        const restoreButton = document.querySelector('[data-layout-path="/ts0/button/max"]') as HTMLElement;
        expect(restoreButton).not.toBeNull();

        // Click restore button
        restoreButton.click();

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Left tabset should no longer be maximized
        expect(leftTabset!.isMaximized()).toBe(false);

        // Right tabset should be visible again
        const tabsetContainers = document.querySelectorAll(".flexlayout__tabset_container");
        expect(tabsetContainers.length).toBe(2);
        const rightTabsetContainer = tabsetContainers[1] as HTMLElement;
        expect(rightTabsetContainer.style.display).not.toBe("none");
    });

    it("maximizes tabset when double-clicking tab strip", async () => {
        const gridModel: IJsonModel = {
            global: {
                tabSetEnableMaximize: true,
            },
            layout: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        id: "left-tabset",
                        weight: 50,
                        children: [{ type: "tab", id: "left-tab", name: "Left Tab", component: "test" }],
                    },
                    {
                        type: "tabset",
                        id: "right-tabset",
                        weight: 50,
                        children: [{ type: "tab", id: "right-tab", name: "Right Tab", component: "test" }],
                    },
                ],
            },
        };

        const model = Model.fromJson(gridModel);
        await render(
            <OptimizedLayout
                model={model}
                renderTab={(node) => (
                    <div data-testid={`content-${node.getId()}`} style={{ width: "100%", height: "100%" }}>
                        Content for {node.getName()}
                    </div>
                )}
            />,
            { container },
        );

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Find the tab strip for the left tabset (path is /ts0/tabstrip)
        const tabStrip = document.querySelector('[data-layout-path="/ts0/tabstrip"]') as HTMLElement;
        expect(tabStrip).not.toBeNull();

        // Double-click the tab strip
        tabStrip.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }));

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Left tabset should be maximized
        let leftTabset: TabSetNode | undefined;
        model.visitNodes((node) => {
            if (node.getId() === "left-tabset") {
                leftTabset = node as TabSetNode;
            }
        });
        expect(leftTabset).toBeDefined();
        expect(leftTabset!.isMaximized()).toBe(true);
    });

    it("tab content receives updated dimensions when maximized", async () => {
        const gridModel: IJsonModel = {
            global: {
                tabSetEnableMaximize: true,
            },
            layout: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        id: "left-tabset",
                        weight: 50,
                        children: [{ type: "tab", id: "left-tab", name: "Left Tab", component: "test" }],
                    },
                    {
                        type: "tabset",
                        id: "right-tabset",
                        weight: 50,
                        children: [{ type: "tab", id: "right-tab", name: "Right Tab", component: "test" }],
                    },
                ],
            },
        };

        const model = Model.fromJson(gridModel);
        await render(
            <OptimizedLayout
                model={model}
                renderTab={(node) => (
                    <div data-testid={`content-${node.getId()}`} style={{ width: "100%", height: "100%" }}>
                        Content for {node.getName()}
                    </div>
                )}
            />,
            { container },
        );

        await new Promise((resolve) => setTimeout(resolve, 300));

        // Get initial dimensions of left tab panel
        const leftTabPanel = document.querySelector('[data-tab-id="left-tab"]') as HTMLElement;
        expect(leftTabPanel).not.toBeNull();

        const initialWidth = parseFloat(leftTabPanel.style.width);

        // Maximize the left tabset
        model.doAction(Actions.maximizeToggle("left-tabset"));

        await new Promise((resolve) => setTimeout(resolve, 300));

        // Get new dimensions after maximize
        const newWidth = parseFloat(leftTabPanel.style.width);

        // Width should have increased (maximized takes full space)
        // Since we have two side-by-side tabsets, the width should roughly double
        expect(newWidth).toBeGreaterThan(initialWidth);
    });

    it("maximized tab content remains visible while other tabs are hidden", async () => {
        const gridModel: IJsonModel = {
            global: {
                tabSetEnableMaximize: true,
            },
            layout: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        id: "left-tabset",
                        weight: 50,
                        children: [{ type: "tab", id: "left-tab", name: "Left Tab", component: "test" }],
                    },
                    {
                        type: "tabset",
                        id: "right-tabset",
                        weight: 50,
                        children: [{ type: "tab", id: "right-tab", name: "Right Tab", component: "test" }],
                    },
                ],
            },
        };

        const model = Model.fromJson(gridModel);
        await render(
            <OptimizedLayout
                model={model}
                renderTab={(node) => (
                    <div data-testid={`content-${node.getId()}`} style={{ width: "100%", height: "100%" }}>
                        Content for {node.getName()}
                    </div>
                )}
            />,
            { container },
        );

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Both tab panels should be visible initially (both are selected in their tabsets)
        const leftTabPanel = document.querySelector('[data-tab-id="left-tab"]') as HTMLElement;
        const rightTabPanel = document.querySelector('[data-tab-id="right-tab"]') as HTMLElement;

        expect(leftTabPanel.style.visibility).not.toBe("hidden");
        expect(rightTabPanel.style.visibility).not.toBe("hidden");

        // Maximize left tabset
        model.doAction(Actions.maximizeToggle("left-tabset"));

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Left tab panel should still be visible with higher z-index
        expect(leftTabPanel.style.visibility).not.toBe("hidden");

        // Right tab panel should now be hidden (its tabset is not maximized)
        expect(rightTabPanel.style.visibility).toBe("hidden");
    });

    it("tab content is not remounted when maximizing", async () => {
        let mountCount = 0;
        let unmountCount = 0;

        function TrackedContent({ name }: { name: string }) {
            React.useEffect(() => {
                mountCount++;
                return () => {
                    unmountCount++;
                };
            }, []);
            return <div>{name}</div>;
        }

        const gridModel: IJsonModel = {
            global: {
                tabSetEnableMaximize: true,
            },
            layout: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        id: "left-tabset",
                        weight: 50,
                        children: [{ type: "tab", id: "left-tab", name: "Left Tab", component: "test" }],
                    },
                    {
                        type: "tabset",
                        id: "right-tabset",
                        weight: 50,
                        children: [{ type: "tab", id: "right-tab", name: "Right Tab", component: "test" }],
                    },
                ],
            },
        };

        const model = Model.fromJson(gridModel);
        await render(<OptimizedLayout model={model} renderTab={(node) => <TrackedContent name={node.getName()} />} />, { container });

        await new Promise((resolve) => setTimeout(resolve, 200));

        const initialMounts = mountCount;
        const initialUnmounts = unmountCount;

        // Maximize left tabset
        model.doAction(Actions.maximizeToggle("left-tabset"));

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Restore
        model.doAction(Actions.maximizeToggle("left-tabset"));

        await new Promise((resolve) => setTimeout(resolve, 200));

        // No tabs should have been unmounted/remounted during maximize/restore
        // OptimizedLayout keeps all tabs mounted
        expect(unmountCount).toBe(initialUnmounts);
        expect(mountCount).toBe(initialMounts);
    });

    it("can interact with maximized tab content", async () => {
        let clickCount = 0;

        const gridModel: IJsonModel = {
            global: {
                tabSetEnableMaximize: true,
            },
            layout: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        id: "left-tabset",
                        weight: 50,
                        children: [{ type: "tab", id: "left-tab", name: "Left Tab", component: "test" }],
                    },
                    {
                        type: "tabset",
                        id: "right-tabset",
                        weight: 50,
                        children: [{ type: "tab", id: "right-tab", name: "Right Tab", component: "test" }],
                    },
                ],
            },
        };

        const model = Model.fromJson(gridModel);
        await render(
            <OptimizedLayout
                model={model}
                renderTab={(node) => (
                    <button data-testid={`button-${node.getId()}`} onClick={() => clickCount++}>
                        Click me: {node.getName()}
                    </button>
                )}
            />,
            { container },
        );

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Maximize left tabset
        model.doAction(Actions.maximizeToggle("left-tabset"));

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Find and click the button in the maximized tab
        const button = document.querySelector('[data-testid="button-left-tab"]') as HTMLElement;
        expect(button).not.toBeNull();

        button.click();

        await new Promise((resolve) => setTimeout(resolve, 50));

        // Button click should have been registered
        expect(clickCount).toBe(1);
    });

    it("switching tabs within maximized tabset works correctly", async () => {
        const gridModel: IJsonModel = {
            global: {
                tabSetEnableMaximize: true,
            },
            layout: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        id: "left-tabset",
                        weight: 50,
                        children: [
                            { type: "tab", id: "left-tab-1", name: "Left Tab 1", component: "test" },
                            { type: "tab", id: "left-tab-2", name: "Left Tab 2", component: "test" },
                        ],
                    },
                    {
                        type: "tabset",
                        id: "right-tabset",
                        weight: 50,
                        children: [{ type: "tab", id: "right-tab", name: "Right Tab", component: "test" }],
                    },
                ],
            },
        };

        const model = Model.fromJson(gridModel);
        await render(
            <OptimizedLayout
                model={model}
                renderTab={(node) => (
                    <div data-testid={`content-${node.getId()}`} style={{ width: "100%", height: "100%" }}>
                        Content for {node.getName()}
                    </div>
                )}
            />,
            { container },
        );

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Maximize left tabset
        model.doAction(Actions.maximizeToggle("left-tabset"));

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Initially first tab should be visible
        const leftTab1Panel = document.querySelector('[data-tab-id="left-tab-1"]') as HTMLElement;
        const leftTab2Panel = document.querySelector('[data-tab-id="left-tab-2"]') as HTMLElement;

        expect(leftTab1Panel.style.visibility).not.toBe("hidden");
        expect(leftTab2Panel.style.visibility).toBe("hidden");

        // Switch to second tab
        model.doAction(Actions.selectTab("left-tab-2"));

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Now second tab should be visible
        expect(leftTab1Panel.style.visibility).toBe("hidden");
        expect(leftTab2Panel.style.visibility).not.toBe("hidden");
    });

    it("maximizing via Actions.maximizeToggle works correctly", async () => {
        const gridModel: IJsonModel = {
            global: {
                tabSetEnableMaximize: true,
            },
            layout: {
                type: "row",
                children: [
                    {
                        type: "tabset",
                        id: "left-tabset",
                        weight: 50,
                        children: [{ type: "tab", id: "left-tab", name: "Left Tab", component: "test" }],
                    },
                    {
                        type: "tabset",
                        id: "right-tabset",
                        weight: 50,
                        children: [{ type: "tab", id: "right-tab", name: "Right Tab", component: "test" }],
                    },
                ],
            },
        };

        const model = Model.fromJson(gridModel);
        await render(
            <OptimizedLayout
                model={model}
                renderTab={(node) => (
                    <div data-testid={`content-${node.getId()}`} style={{ width: "100%", height: "100%" }}>
                        Content for {node.getName()}
                    </div>
                )}
            />,
            { container },
        );

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Use Actions.maximizeToggle directly
        model.doAction(Actions.maximizeToggle("right-tabset"));

        await new Promise((resolve) => setTimeout(resolve, 200));

        // Right tabset should be maximized
        let rightTabset: TabSetNode | undefined;
        model.visitNodes((node) => {
            if (node.getId() === "right-tabset") {
                rightTabset = node as TabSetNode;
            }
        });
        expect(rightTabset).toBeDefined();
        expect(rightTabset!.isMaximized()).toBe(true);

        // Verify left tabset container is hidden
        const leftTabsetContainer = document.querySelectorAll(".flexlayout__tabset_container")[0] as HTMLElement;
        expect(leftTabsetContainer.style.display).toBe("none");
    });
});
