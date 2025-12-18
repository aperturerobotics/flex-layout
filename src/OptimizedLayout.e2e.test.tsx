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

    it("sets pointer-events to none on tab container during drag", async () => {
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

        const tabContainer = document.querySelector('[data-layout-path="/tab-container"]') as HTMLElement;
        expect(tabContainer).not.toBeNull();

        // Initially, pointer-events should be auto
        expect(tabContainer.style.pointerEvents).toBe("auto");

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

        // Now pointer-events should be none
        expect(tabContainer.style.pointerEvents).toBe("none");

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

        // pointer-events should be back to auto
        expect(tabContainer.style.pointerEvents).toBe("auto");
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
});
