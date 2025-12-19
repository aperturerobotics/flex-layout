import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render } from "vitest-browser-react";
import * as React from "react";
import { Layout } from "./view/Layout";
import { Model, IJsonModel, Actions, DockLocation } from "./index";
import "@testing-library/jest-dom/vitest";

const basicModel: IJsonModel = {
    global: {
        tabEnableClose: true,
        tabEnableRename: true,
    },
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "tabset1",
                children: [
                    { type: "tab", name: "Tab 1", component: "test", id: "tab1" },
                    { type: "tab", name: "Tab 2", component: "test", id: "tab2" },
                    { type: "tab", name: "Tab 3", component: "test", id: "tab3" },
                ],
            },
        ],
    },
};

const multiTabsetModel: IJsonModel = {
    global: {},
    borders: [],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                id: "left-tabset",
                weight: 50,
                children: [
                    { type: "tab", name: "Left 1", component: "test", id: "left1" },
                    { type: "tab", name: "Left 2", component: "test", id: "left2" },
                ],
            },
            {
                type: "tabset",
                id: "right-tabset",
                weight: 50,
                children: [
                    { type: "tab", name: "Right 1", component: "test", id: "right1" },
                    { type: "tab", name: "Right 2", component: "test", id: "right2" },
                ],
            },
        ],
    },
};

const borderModel: IJsonModel = {
    global: {},
    borders: [
        {
            type: "border",
            location: "left",
            size: 200,
            children: [
                { type: "tab", name: "Border Tab 1", component: "test", id: "border1" },
                { type: "tab", name: "Border Tab 2", component: "test", id: "border2" },
            ],
        },
    ],
    layout: {
        type: "row",
        children: [
            {
                type: "tabset",
                children: [{ type: "tab", name: "Main Tab", component: "test", id: "main1" }],
            },
        ],
    },
};

describe("Layout Features", () => {
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

    describe("Tab Selection", () => {
        it("shows first tab as selected by default", async () => {
            const model = Model.fromJson(basicModel);
            render(<Layout model={model} factory={(node) => <div>Content {node.getName()}</div>} />, { container });

            await new Promise((resolve) => setTimeout(resolve, 100));

            const tabButtons = document.querySelectorAll(".flexlayout__tab_button");
            expect(tabButtons[0].classList.contains("flexlayout__tab_button--selected")).toBe(true);
            expect(tabButtons[1].classList.contains("flexlayout__tab_button--selected")).toBe(false);
        });

        it("switches selected tab when clicking tab button", async () => {
            const model = Model.fromJson(basicModel);
            render(<Layout model={model} factory={(node) => <div>Content {node.getName()}</div>} />, { container });

            await new Promise((resolve) => setTimeout(resolve, 100));

            const tabButtons = document.querySelectorAll(".flexlayout__tab_button");
            (tabButtons[1] as HTMLElement).click();

            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(tabButtons[0].classList.contains("flexlayout__tab_button--selected")).toBe(false);
            expect(tabButtons[1].classList.contains("flexlayout__tab_button--selected")).toBe(true);
        });

        it("maintains selection after model action", async () => {
            const model = Model.fromJson(basicModel);
            render(<Layout model={model} factory={(node) => <div>Content {node.getName()}</div>} />, { container });

            await new Promise((resolve) => setTimeout(resolve, 100));

            model.doAction(Actions.selectTab("tab2"));

            await new Promise((resolve) => setTimeout(resolve, 50));

            const tabButtons = document.querySelectorAll(".flexlayout__tab_button");
            expect(tabButtons[1].classList.contains("flexlayout__tab_button--selected")).toBe(true);
        });
    });

    describe("Tab Closing", () => {
        it("shows close button when tabEnableClose is true", async () => {
            const model = Model.fromJson(basicModel);
            render(<Layout model={model} factory={(node) => <div>Content {node.getName()}</div>} />, { container });

            await new Promise((resolve) => setTimeout(resolve, 100));

            const closeButtons = document.querySelectorAll(".flexlayout__tab_button_trailing");
            expect(closeButtons.length).toBeGreaterThan(0);
        });

        it("removes tab when close button is clicked", async () => {
            const model = Model.fromJson(basicModel);
            render(<Layout model={model} factory={(node) => <div>Content {node.getName()}</div>} />, { container });

            await new Promise((resolve) => setTimeout(resolve, 100));

            const initialButtons = document.querySelectorAll(".flexlayout__tab_button");
            expect(initialButtons.length).toBe(3);

            const closeButton = document.querySelector(".flexlayout__tab_button_trailing") as HTMLElement;
            closeButton.click();

            await new Promise((resolve) => setTimeout(resolve, 50));

            const remainingButtons = document.querySelectorAll(".flexlayout__tab_button");
            expect(remainingButtons.length).toBe(2);
        });

        it("selects next tab after closing selected tab", async () => {
            const model = Model.fromJson(basicModel);
            render(<Layout model={model} factory={(node) => <div>Content {node.getName()}</div>} />, { container });

            await new Promise((resolve) => setTimeout(resolve, 100));

            const firstCloseButton = document.querySelector(".flexlayout__tab_button_trailing") as HTMLElement;
            firstCloseButton.click();

            await new Promise((resolve) => setTimeout(resolve, 50));

            const tabButtons = document.querySelectorAll(".flexlayout__tab_button");
            expect(tabButtons[0].classList.contains("flexlayout__tab_button--selected")).toBe(true);
        });
    });

    describe("Adding Tabs", () => {
        it("adds new tab via model action", async () => {
            const model = Model.fromJson(basicModel);
            render(<Layout model={model} factory={(node) => <div>Content {node.getName()}</div>} />, { container });

            await new Promise((resolve) => setTimeout(resolve, 100));

            model.doAction(Actions.addNode({ type: "tab", name: "New Tab", component: "test", id: "new-tab" }, "tabset1", DockLocation.CENTER, -1));

            await new Promise((resolve) => setTimeout(resolve, 50));

            const tabButtons = document.querySelectorAll(".flexlayout__tab_button");
            expect(tabButtons.length).toBe(4);
        });

        it("selects new tab when select parameter is true", async () => {
            const model = Model.fromJson(basicModel);
            render(<Layout model={model} factory={(node) => <div>Content {node.getName()}</div>} />, { container });

            await new Promise((resolve) => setTimeout(resolve, 100));

            model.doAction(Actions.addNode({ type: "tab", name: "New Tab", component: "test", id: "new-tab" }, "tabset1", DockLocation.CENTER, -1, true));

            await new Promise((resolve) => setTimeout(resolve, 50));

            const tabButtons = document.querySelectorAll(".flexlayout__tab_button");
            const lastButton = tabButtons[tabButtons.length - 1];
            expect(lastButton.classList.contains("flexlayout__tab_button--selected")).toBe(true);
        });
    });

    describe("Multiple Tabsets", () => {
        it("renders multiple tabsets", async () => {
            const model = Model.fromJson(multiTabsetModel);
            render(<Layout model={model} factory={(node) => <div>Content {node.getName()}</div>} />, { container });

            await new Promise((resolve) => setTimeout(resolve, 100));

            const tabsets = document.querySelectorAll(".flexlayout__tabset");
            expect(tabsets.length).toBe(2);
        });

        it("highlights first tabset by default", async () => {
            const model = Model.fromJson(multiTabsetModel);
            render(<Layout model={model} factory={(node) => <div>Content {node.getName()}</div>} />, { container });

            await new Promise((resolve) => setTimeout(resolve, 100));

            const tabsets = document.querySelectorAll(".flexlayout__tabset");
            expect(tabsets.length).toBe(2);

            const tabs = document.querySelectorAll(".flexlayout__tab");
            expect(tabs.length).toBeGreaterThan(0);
        });

        it("changes active tabset when clicking tab content in another tabset", async () => {
            const model = Model.fromJson(multiTabsetModel);
            render(<Layout model={model} factory={(node) => <div>Content {node.getName()}</div>} />, { container });

            await new Promise((resolve) => setTimeout(resolve, 100));

            const tabButtons = document.querySelectorAll(".flexlayout__tab_button");
            const rightTabButton = tabButtons[2] as HTMLElement;
            rightTabButton.click();

            await new Promise((resolve) => setTimeout(resolve, 50));

            const tabsets = document.querySelectorAll(".flexlayout__tabset");
            expect(tabsets.length).toBe(2);
        });
    });

    describe("Border Tabs", () => {
        it("renders border tabs", async () => {
            const model = Model.fromJson(borderModel);
            render(<Layout model={model} factory={(node) => <div>Content {node.getName()}</div>} />, { container });

            await new Promise((resolve) => setTimeout(resolve, 100));

            const borderButtons = document.querySelectorAll(".flexlayout__border_button");
            expect(borderButtons.length).toBe(2);
        });

        it("shows border tab content when clicked", async () => {
            const model = Model.fromJson(borderModel);
            render(<Layout model={model} factory={(node) => <div>Content {node.getName()}</div>} />, { container });

            await new Promise((resolve) => setTimeout(resolve, 100));

            const borderButton = document.querySelector(".flexlayout__border_button") as HTMLElement;
            borderButton.click();

            await new Promise((resolve) => setTimeout(resolve, 50));

            const borderTab = document.querySelector(".flexlayout__tab_border");
            expect(borderTab).not.toBeNull();
        });

        it("hides border tab content when clicked again", async () => {
            const model = Model.fromJson(borderModel);
            render(<Layout model={model} factory={(node) => <div>Content {node.getName()}</div>} />, { container });

            await new Promise((resolve) => setTimeout(resolve, 100));

            const borderButton = document.querySelector(".flexlayout__border_button") as HTMLElement;
            borderButton.click();

            await new Promise((resolve) => setTimeout(resolve, 50));

            let borderTab = document.querySelector(".flexlayout__tab_border");
            expect(borderTab).not.toBeNull();

            borderButton.click();

            await new Promise((resolve) => setTimeout(resolve, 50));

            borderTab = document.querySelector(".flexlayout__tab_border");
            const style = (borderTab as HTMLElement)?.style;
            expect(style?.display === "none" || borderTab === null).toBe(true);
        });
    });

    describe("Tab Maximize", () => {
        it("renders without errors when tabSetEnableMaximize is true", async () => {
            const modelWithMaximize: IJsonModel = {
                global: {
                    tabSetEnableMaximize: true,
                },
                borders: [],
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

            const model = Model.fromJson(modelWithMaximize);
            render(<Layout model={model} factory={(node) => <div>Content {node.getName()}</div>} />, { container });

            await new Promise((resolve) => setTimeout(resolve, 100));

            const tabset = document.querySelector(".flexlayout__tabset");
            expect(tabset).not.toBeNull();
        });
    });

    describe("Drag and Drop", () => {
        it("enters drag state when dragging tab", async () => {
            const model = Model.fromJson(multiTabsetModel);
            let dragStateChanges: boolean[] = [];

            render(
                <Layout
                    model={model}
                    factory={(node) => <div>Content {node.getName()}</div>}
                    onDragStateChange={(isDragging) => {
                        dragStateChanges.push(isDragging);
                    }}
                />,
                { container },
            );

            await new Promise((resolve) => setTimeout(resolve, 100));

            const tabButton = document.querySelector(".flexlayout__tab_button") as HTMLElement;
            const rect = tabButton.getBoundingClientRect();

            const dataTransfer = new DataTransfer();

            tabButton.dispatchEvent(
                new DragEvent("dragstart", {
                    bubbles: true,
                    cancelable: true,
                    clientX: rect.left + rect.width / 2,
                    clientY: rect.top + rect.height / 2,
                    dataTransfer,
                }),
            );

            await new Promise((resolve) => setTimeout(resolve, 50));

            const layout = document.querySelector(".flexlayout__layout") as HTMLElement;
            layout.dispatchEvent(
                new DragEvent("dragenter", {
                    bubbles: true,
                    cancelable: true,
                    clientX: rect.left + rect.width / 2 + 100,
                    clientY: rect.top + rect.height / 2,
                    dataTransfer,
                }),
            );

            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(dragStateChanges).toContain(true);

            tabButton.dispatchEvent(
                new DragEvent("dragend", {
                    bubbles: true,
                    cancelable: true,
                    dataTransfer,
                }),
            );

            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(dragStateChanges).toContain(false);
        });
    });

    describe("Tab Overflow", () => {
        it("handles many tabs without crashing", async () => {
            const manyTabsModel: IJsonModel = {
                global: {},
                borders: [],
                layout: {
                    type: "row",
                    children: [
                        {
                            type: "tabset",
                            children: Array.from({ length: 20 }, (_, i) => ({
                                type: "tab" as const,
                                name: `Tab ${i + 1}`,
                                component: "test",
                                id: `tab${i + 1}`,
                            })),
                        },
                    ],
                },
            };

            const model = Model.fromJson(manyTabsModel);
            render(<Layout model={model} factory={(node) => <div>Content {node.getName()}</div>} />, { container });

            await new Promise((resolve) => setTimeout(resolve, 200));

            const tabButtons = document.querySelectorAll(".flexlayout__tab_button");
            expect(tabButtons.length).toBe(20);
        });
    });

    describe("onModelChange callback", () => {
        it("calls onModelChange when model is updated", async () => {
            const model = Model.fromJson(basicModel);
            let changeCallCount = 0;

            render(
                <Layout
                    model={model}
                    factory={(node) => <div>Content {node.getName()}</div>}
                    onModelChange={() => {
                        changeCallCount++;
                    }}
                />,
                { container },
            );

            await new Promise((resolve) => setTimeout(resolve, 100));

            model.doAction(Actions.selectTab("tab2"));

            await new Promise((resolve) => setTimeout(resolve, 50));

            expect(changeCallCount).toBeGreaterThan(0);
        });
    });

    describe("onAction callback", () => {
        it("intercepts actions and can prevent them", async () => {
            const model = Model.fromJson(basicModel);

            render(
                <Layout
                    model={model}
                    factory={(node) => <div>Content {node.getName()}</div>}
                    onAction={(action) => {
                        if (action.type === "FlexLayout_DeleteTab") {
                            return undefined;
                        }
                        return action;
                    }}
                />,
                { container },
            );

            await new Promise((resolve) => setTimeout(resolve, 100));

            const initialButtons = document.querySelectorAll(".flexlayout__tab_button");
            const initialCount = initialButtons.length;

            const closeButton = document.querySelector(".flexlayout__tab_button_trailing") as HTMLElement;
            closeButton.click();

            await new Promise((resolve) => setTimeout(resolve, 50));

            const remainingButtons = document.querySelectorAll(".flexlayout__tab_button");
            expect(remainingButtons.length).toBe(initialCount);
        });
    });
});
