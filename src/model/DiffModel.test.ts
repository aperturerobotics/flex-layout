import { describe, test, expect } from "vitest";
import { Model } from "./Model";
import { diffModels } from "./DiffModel";
import { Actions } from "./Actions";
import { Action } from "./Action";
import { IJsonModel } from "./IJsonModel";
import { DockLocation } from "../DockLocation";

const BASE_MODEL: IJsonModel = {
    global: {},
    layout: {
        type: "row",
        id: "row1",
        children: [
            {
                type: "tabset",
                id: "tabset1",
                children: [],
            },
        ],
    },
};

interface TestCase {
    name: string;
    setupActions: Action[];
    testActions: Action[];
}

const testCases: TestCase[] = [
    {
        name: "identical models generate no actions",
        setupActions: [],
        testActions: [],
    },
    {
        name: "adding a new tab",
        setupActions: [],
        testActions: [
            Actions.addNode(
                {
                    type: "tab",
                    id: "tab1",
                    name: "Tab 1",
                    component: "grid",
                },
                "tabset1",
                DockLocation.CENTER,
                0,
            ),
        ],
    },
    {
        name: "removing a tab",
        setupActions: [
            Actions.addNode(
                {
                    type: "tab",
                    id: "tab1",
                    name: "Tab 1",
                    component: "grid",
                },
                "tabset1",
                DockLocation.CENTER,
                0,
            ),
        ],
        testActions: [Actions.deleteTab("tab1")],
    },
    {
        name: "multiple tab additions",
        setupActions: [],
        testActions: [
            Actions.addNode(
                {
                    type: "tab",
                    id: "tab1",
                    name: "Tab 1",
                    component: "grid",
                },
                "tabset1",
                DockLocation.CENTER,
                0,
            ),
            Actions.addNode(
                {
                    type: "tab",
                    id: "tab2",
                    name: "Tab 2",
                    component: "grid",
                },
                "tabset1",
                DockLocation.CENTER,
                1,
            ),
        ],
    },
    {
        name: "multiple tab deletions",
        setupActions: [
            Actions.addNode(
                {
                    type: "tab",
                    id: "tab1",
                    name: "Tab 1",
                    component: "grid",
                },
                "tabset1",
                DockLocation.CENTER,
                0,
            ),
            Actions.addNode(
                {
                    type: "tab",
                    id: "tab2",
                    name: "Tab 2",
                    component: "grid",
                },
                "tabset1",
                DockLocation.CENTER,
                1,
            ),
        ],
        testActions: [Actions.deleteTab("tab1"), Actions.deleteTab("tab2")],
    },
    {
        name: "mixed additions and deletions",
        setupActions: [
            Actions.addNode(
                {
                    type: "tab",
                    id: "tab1",
                    name: "Tab 1",
                    component: "grid",
                },
                "tabset1",
                DockLocation.CENTER,
                0,
            ),
        ],
        testActions: [
            Actions.deleteTab("tab1"),
            Actions.addNode(
                {
                    type: "tab",
                    id: "tab2",
                    name: "Tab 2",
                    component: "grid",
                },
                "tabset1",
                DockLocation.CENTER,
                0,
            ),
        ],
    },
];

describe("DiffModel", () => {
    testCases.forEach((testCase) => {
        test(testCase.name, () => {
            // Create models and apply actions to get before/after states
            const beforeModel = Model.fromJson(BASE_MODEL);
            testCase.setupActions.forEach((action) => beforeModel.doAction(action));

            // beforeJson is our starting state
            const beforeJson = beforeModel.toJson();

            // build a model from beforeJson
            const afterModel = Model.fromJson(beforeJson);

            // apply the actions to afterModel
            testCase.testActions.forEach((action) => afterModel.doAction(action));

            // get the afterJson
            const afterJson = afterModel.toJson();

            // Generate diff actions with the json representations
            const diffActions = diffModels(beforeJson, afterJson);

            // Apply the actions to diffModel.
            const diffModel = Model.fromJson(beforeJson);
            diffActions.forEach((action) => diffModel.doAction(action));

            // Compare the resulting IJsonModel to the expected
            const finalJson = diffModel.toJson();
            expect(finalJson).toStrictEqual(afterJson);
        });
    });
});
