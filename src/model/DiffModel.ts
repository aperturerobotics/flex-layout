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

    // Track source tab locations and attributes
    const sourceTabs = new Map<string, { 
        parentId: string; 
        index: number;
        name?: string;
        config?: any;
    }>();
    const targetTabs = new Set<string>();

    // Build source tab index and generate add/move actions for target
    const processNode = (node: JsonNode, parent: JsonNode | null, isSource: boolean) => {
        if (node.type === "tab" && "id" in node && node.id) {
            if (isSource && parent && "id" in parent && parent.id) {
                const parentChildren = "children" in parent ? parent.children : [];
                const index = parentChildren.findIndex((child) => "id" in child && child.id === node.id);
                sourceTabs.set(node.id, { 
                    parentId: parent.id, 
                    index,
                    name: node.name,
                    config: node.config
                });
            } else if (!isSource && parent && "id" in parent && parent.id) {
                targetTabs.add(node.id);
                const parentChildren = "children" in parent ? parent.children : [];
                const targetIndex = parentChildren.findIndex((child) => "id" in child && child.id === node.id);
                const sourceLocation = sourceTabs.get(node.id);

                if (!sourceLocation) {
                    // New tab to add 
                    actions.push(Actions.addNode(node, parent.id, DockLocation.CENTER, targetIndex));
                } else {
                    // Check if tab needs to be moved or updated
                    if (sourceLocation.parentId !== parent.id || sourceLocation.index !== targetIndex) {
                        actions.push(Actions.moveNode(node.id, parent.id, DockLocation.CENTER, targetIndex));
                    }
                    
                    // Check if name changed
                    if (sourceLocation.name !== node.name) {
                        actions.push(Actions.renameTab(node.id, node.name));
                    }

                    // Check if config changed
                    if (JSON.stringify(sourceLocation.config) !== JSON.stringify(node.config)) {
                        actions.push(Actions.updateNodeAttributes(node.id, {config: node.config}));
                    }
                }
            }
        }
    };

    // Process borders first
    if (sourceJson.borders) {
        for (const border of sourceJson.borders) {
            if (border.children) {
                border.children.forEach((tab, index) => {
                    if ("id" in tab && tab.id) {
                        sourceTabs.set(tab.id, {
                            parentId: `border_${border.location}`,
                            index,
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
                        targetTabs.add(tab.id);
                        const sourceLocation = sourceTabs.get(tab.id);
                        if (!sourceLocation) {
                            actions.push(Actions.addNode(tab, `border_${border.location}`, DockLocation.CENTER, targetIndex));
                        } else if (sourceLocation.parentId !== `border_${border.location}` || sourceLocation.index !== targetIndex) {
                            actions.push(Actions.moveNode(tab.id, `border_${border.location}`, DockLocation.CENTER, targetIndex));
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

    // Generate delete actions for tabs that only exist in source
    for (const [tabId] of sourceTabs) {
        if (!targetTabs.has(tabId)) {
            actions.push(Actions.deleteTab(tabId));
        }
    }

    return actions;
}
