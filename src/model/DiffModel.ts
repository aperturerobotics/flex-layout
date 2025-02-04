import { Action } from "./Action";
import { Actions } from "./Actions";
import { JsonNode, walkJsonModel } from "./walk";
import { DockLocation } from "../DockLocation";
import { IJsonModel } from "./IJsonModel";

/**
 * Generates a sequence of Actions that will transform sourceModel into targetModel.
 * This is used to determine what actions need to be taken to transform one model state into another.
 * 
 * The function works by:
 * 1. Building an index of all tabs in the source model with their locations
 * 2. Processing the target model to generate add/move actions for tabs in new positions
 * 3. Generating delete actions for tabs that exist in source but not target
 * 
 * Borders are processed first since they have special handling, then the main layout is walked.
 * 
 * @param sourceModel The starting model state
 * @param targetModel The desired end model state 
 * @returns Array of Actions that will transform sourceModel into targetModel when applied in order
 */
export function diffModels(sourceJson: IJsonModel, targetJson: IJsonModel): Action[] {
    const actions: Action[] = [];

    // Track source node locations and attributes
    const sourceNodes = new Map<string, {
        parentId: string;
        index: number;
        name?: string;
        config?: any;
        type: string;
        selected?: number;
        maximized?: boolean;
        active?: boolean;
        show?: boolean;
        size?: number;
        weight?: number;
        minSize?: number;
        maxSize?: number;
        enableDrop?: boolean;
        enableDivide?: boolean;
        enableClose?: boolean;
        enableDrag?: boolean;
        enableSingleTabStretch?: boolean;
        enableTabStrip?: boolean;
        classNameTabStrip?: string;
        tabLocation?: string;
        autoSelectTab?: boolean;
    }>();
    const targetNodes = new Set<string>();

    // Build source tab index and generate add/move actions for target
    const processNode = (node: JsonNode, parent: JsonNode | null, isSource: boolean) => {
        if (node.type === "tab" && "id" in node && node.id) {
            if (isSource && parent && "id" in parent && parent.id) {
                const parentChildren = "children" in parent ? parent.children : [];
                const index = parentChildren.findIndex((child) => "id" in child && child.id === node.id);
                sourceNodes.set(node.id, {
                    parentId: parent.id,
                    index,
                    name: node.name,
                    config: node.config,
                    type: node.type,
                });
            } else if (!isSource && parent && "id" in parent && parent.id) {
                targetNodes.add(node.id);
                const parentChildren = "children" in parent ? parent.children : [];
                const targetIndex = parentChildren.findIndex((child) => "id" in child && child.id === node.id);
                const sourceLocation = sourceNodes.get(node.id);

                if (!sourceLocation) {
                    // New node to add
                    actions.push(Actions.addNode(node, parent.id, DockLocation.CENTER, targetIndex));
                } else {
                    // Check if node needs to be moved or updated
                    if (sourceLocation.parentId !== parent.id || sourceLocation.index !== targetIndex) {
                        actions.push(Actions.moveNode(node.id, parent.id, DockLocation.CENTER, targetIndex));
                    }

                    if (node.type === "tab" && node.name != null) {
                        // Check if tab name changed
                        if (sourceLocation.name !== node.name) {
                            actions.push(Actions.renameTab(node.id, node.name));
                        }
                    }

                    // Check if config changed for any node type
                    if (JSON.stringify(sourceLocation.config) !== JSON.stringify(node.config)) {
                        // Need to include type to ensure proper attribute handling
                        actions.push(Actions.updateNodeAttributes(node.id, {
                            type: node.type,
                            config: node.config
                        }));
                    }
                }
            }
        }
    };

    // Process borders first since they have special handling
    if (sourceJson.borders) {
        for (const border of sourceJson.borders) {
            if (border.children) {
                border.children.forEach((tab, index) => {
                    if ("id" in tab && tab.id) {
                        sourceNodes.set(tab.id, {
                            parentId: `border_${border.location}`,
                            index,
                            type: tab.type,
                            name: tab.name,
                            config: tab.config,
                            show: border.show,
                            size: border.size
                        });
                    }
                });
            }
        }
    }

    if (targetJson.borders) {
        for (const border of targetJson.borders) {
            if (border.children) {
                border.children.forEach((tab, targetIndex) => {
                    if ("id" in tab && tab.id) {
                        targetNodes.add(tab.id);
                        const sourceLocation = sourceNodes.get(tab.id);
                        if (!sourceLocation) {
                            actions.push(Actions.addNode(tab, `border_${border.location}`, DockLocation.CENTER, targetIndex));
                        } else {
                            if (sourceLocation.parentId !== `border_${border.location}` || sourceLocation.index !== targetIndex) {
                                actions.push(Actions.moveNode(tab.id, `border_${border.location}`, DockLocation.CENTER, targetIndex));
                            }
                            if (sourceLocation.show !== border.show || sourceLocation.size !== border.size) {
                                actions.push(Actions.updateNodeAttributes(`border_${border.location}`, {
                                    show: border.show,
                                    size: border.size
                                }));
                            }
                        }
                    }
                });
            }
        }
    }

    // Process source model to build index
    walkJsonModel(sourceJson, (node, parent) => processNode(node, parent, true));

    // Process target model to generate actions
    walkJsonModel(targetJson, (node, parent) => processNode(node, parent, false));

    // Handle window changes
    const sourceWindows = new Set(Object.keys(sourceJson.popouts || {}));
    const targetWindows = new Set(Object.keys(targetJson.popouts || {}));

    // Handle window deletions
    for (const windowId of sourceWindows) {
        if (!targetWindows.has(windowId)) {
            // When closing a window, first move any tabs back to main window's first tabset
            const sourceWindow = sourceJson.popouts![windowId];
            const sourceLayout = sourceWindow.layout;
            const targetTabsetId = targetJson.layout.children[0].id;

            // Move all tabs from source window to target tabset
            const tabsToMove = new Set<string>();
            walkJsonModel(sourceLayout, (node) => {
                if (node.type === "tab" && "id" in node && node.id) {
                    tabsToMove.add(node.id);
                }
            });

            // Close the window after moving tabs
            actions.push(Actions.closeWindow(windowId));

            // Update target tabset attributes
            if (tabsToMove.size === 0) {
                actions.push(Actions.updateNodeAttributes(targetTabsetId!, {
                    selected: -1,
                    children: []
                }));
            }
        }
    }

    // Handle window creations and updates
    for (const windowId of targetWindows) {
        const targetWindow = targetJson.popouts![windowId];
        if (!sourceWindows.has(windowId)) {
            // New window
            actions.push(Actions.createWindow(targetWindow.layout, targetWindow.rect));
        } else {
            // Existing window - check for layout changes
            const sourceWindow = sourceJson.popouts![windowId];
            if (JSON.stringify(sourceWindow.layout) !== JSON.stringify(targetWindow.layout) ||
                JSON.stringify(sourceWindow.rect) !== JSON.stringify(targetWindow.rect)) {
                actions.push(Actions.closeWindow(windowId));
                actions.push(Actions.createWindow(targetWindow.layout, targetWindow.rect));
            }
        }
    }

    // Generate delete actions for nodes that only exist in source
    for (const [nodeId, sourceNode] of sourceNodes) {
        if (!targetNodes.has(nodeId)) {
            if (sourceNode.type === "tab") {
                actions.push(Actions.deleteTab(nodeId));
            } else if (sourceNode.type === "tabset") {
                actions.push(Actions.deleteTabset(nodeId));
            }
        }
    }

    return actions;
}
