import { Action } from "./Action";
import { Actions } from "./Actions";
import { JsonNode, walkJsonModel } from "./walk";
import { DockLocation } from "../DockLocation";
import { IJsonModel } from "./IJsonModel";

/**
 * Generates a sequence of Actions that will transform sourceModel into targetModel
 * @param sourceModel The starting model
 * @param targetModel The desired end model
 * @returns Array of Actions that will transform sourceModel into targetModel
 */
export function diffModels(sourceJson: IJsonModel, targetJson: IJsonModel): Action[] {
    const actions: Action[] = [];

    // Track source tab locations and process target model in a single pass
    const sourceTabs = new Map<string, { parentId: string; index: number }>();
    const targetTabs = new Set<string>();

    // Build source tab index and generate add/move actions for target
    const processNode = (node: JsonNode, parent: JsonNode | null, isSource: boolean) => {
        if (node.type === "tab" && "id" in node && node.id) {
            if (isSource && parent && "id" in parent && parent.id) {
                const parentChildren = "children" in parent ? parent.children : [];
                const index = parentChildren.findIndex((child) => "id" in child && child.id === node.id);
                sourceTabs.set(node.id, { parentId: parent.id, index });
            } else if (!isSource && parent && "id" in parent && parent.id) {
                targetTabs.add(node.id);
                const parentChildren = "children" in parent ? parent.children : [];
                const targetIndex = parentChildren.findIndex((child) => "id" in child && child.id === node.id);
                const sourceLocation = sourceTabs.get(node.id);

                if (!sourceLocation) {
                    // New tab to add
                    actions.push(Actions.addNode(node, parent.id, DockLocation.CENTER, targetIndex));
                } else if (sourceLocation.parentId !== parent.id || sourceLocation.index !== targetIndex) {
                    // Tab moved
                    actions.push(Actions.moveNode(node.id, parent.id, DockLocation.CENTER, targetIndex));
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
