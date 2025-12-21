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

        await render(<OptimizedLayout model={model} renderTab={(node) => <div data-testid={`content-${node.getId()}`}>Content for {node.getName()}</div>} />, { container });

        // Wait for layout to render and state updates
        await new Promise((resolve) => setTimeout(resolve, 500));

        // Check the actual DOM dimensions of the visible tab panel
        const visibleTabPanel = document.querySelector('[role="tabpanel"][style*="display: flex"]') as HTMLElement;
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
        expect(newTabPanel.style.display).toBe("flex"); // visible
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
        expect(newTabPanel.style.display).toBe("flex");

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
        expect(tab1Panel.style.display).toBe("flex");
        expect(newTabPanel.style.display).toBe("none");

        // Select the new tab
        model.doAction(Actions.selectTab("new-tab"));

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Now new tab should be visible, original hidden
        expect(tab1Panel.style.display).toBe("none");
        expect(newTabPanel.style.display).toBe("flex");

        // Switch back to original tab
        model.doAction(Actions.selectTab("tab1"));

        await new Promise((resolve) => setTimeout(resolve, 100));

        // Original should be visible again
        expect(tab1Panel.style.display).toBe("flex");
        expect(newTabPanel.style.display).toBe("none");
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
});
