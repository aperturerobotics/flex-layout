import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import "../style/underline.css"; // Import the CSS file for styling in tests
import { Layout } from "./view/Layout.js";
import { Model, TabNode, IJsonModel } from "./index.js";

// Basic factory function for tab content, making content text unique
const factory = (node: TabNode) => {
    const component = node.getComponent();
    if (component === "text") {
        return <div>Content for {node.getName()}</div>;
    }
    return null;
};

// Basic JSON model with one tabset and three tabs
const jsonModel: IJsonModel = {
    global: {},
    layout: {
        type: "row",
        weight: 100,
        children: [
            {
                type: "tabset",
                weight: 100,
                children: [
                    {
                        type: "tab",
                        name: "Tab 1",
                        component: "text",
                    },
                    {
                        type: "tab",
                        name: "Tab 2",
                        component: "text",
                    },
                    {
                        type: "tab",
                        name: "Tab 3",
                        component: "text",
                    },
                ],
            },
        ],
    },
};

describe("Layout Component", () => {
    it("should render three tabs correctly", () => {
        // Create a model instance from the JSON
        const model = Model.fromJson(jsonModel);

        // Render the Layout component
        render(<Layout model={model} factory={factory} />);

        // Check if the tab buttons are rendered using role query
        expect(screen.getByRole("button", { name: "Tab 1" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Tab 2" })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: "Tab 3" })).toBeInTheDocument();

        // Check if the content of the initially selected tab (Tab 1) is rendered
        expect(screen.getByText("Content for Tab 1")).toBeInTheDocument();

        // Check that the content of the other tabs is not initially visible (due to render on demand)
        expect(screen.queryByText("Content for Tab 2")).toBeNull();
        expect(screen.queryByText("Content for Tab 3")).toBeNull();
    });
});
