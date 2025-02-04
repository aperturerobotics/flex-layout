import { describe, test, expect } from "vitest";
import { Model } from "./Model";
import { diffModels } from "./DiffModel";
import { Actions } from "./Actions";
import { Action } from "./Action";
import { IJsonModel } from "./IJsonModel";
import { DockLocation } from "../DockLocation";

/**
 * DiffModel is developed iteratively using Test Driven Development (TDD).
 *
 * For each new test case:
 * 1. Define the initial model state using setupActions
 * 2. Define the expected transformation using testActions
 * 3. Verify diffModels generates equivalent (or better) action sequence
 * 4. Refactor diffModels if needed to generate more efficient sequences
 *
 * This approach helps ensure diffModels:
 * - Handles all valid model transformations
 * - Generates minimal action sequences
 * - Maintains model consistency
 * - Has good test coverage of edge cases
 */

/**
 * Base model used as the starting point for test cases.
 * Contains a minimal layout with a single empty tabset.
 */
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

/**
 * Defines the structure of a test case for diffModel testing
 */
interface TestCase {
    /** Descriptive name of the test case */
    name: string;
    /** Actions to apply to BASE_MODEL to create the "before" state */
    setupActions: Action[];
    /** Actions to apply to create the "after" state - these should match what diffModels generates */
    testActions: Action[];
}

/**
 * Test cases for diffModels function.
 * Each test case:
 * 1. Starts with BASE_MODEL
 * 2. Applies setupActions to create "before" state
 * 3. Applies testActions to create "after" state
 * 4. Verifies diffModels generates equivalent actions to testActions
 */
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
    {
        name: "tab name changes",
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
            Actions.renameTab("tab1", "New Tab Name"),
        ],
    },
    {
        name: "tab config changes",
        setupActions: [
            Actions.addNode(
                {
                    type: "tab",
                    id: "tab1",
                    name: "Tab 1",
                    component: "grid",
                    config: { foo: "bar" },
                },
                "tabset1",
                DockLocation.CENTER,
                0,
            ),
        ],
        testActions: [
            Actions.updateNodeAttributes("tab1", { config: { foo: "baz" } }),
        ],
    },
    {
        name: "tabset selected changes",
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
        testActions: [
            Actions.updateNodeAttributes("tabset1", { selected: 1 }),
        ],
    },
    {
        name: "tabset maximized changes",
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
            Actions.maximizeToggle("tabset1"),
        ],
    },
    {
        name: "tabset active changes",
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
            Actions.setActiveTabset("tabset1"),
        ],
    },
];

describe("DiffModel", () => {
    testCases.forEach((testCase) => {
        test(testCase.name, () => {
            // Create the "before" state by applying setup actions to base model
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
