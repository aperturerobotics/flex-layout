import { Action } from "./Action";
import { Actions } from "./Actions";
import { walkJsonModel } from "./walk";
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

    // Track existing tabs in source model
    const sourceTabs = new Map<string, { parentId: string; index: number }>();

    // First process borders
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

    // Process source model layout to track existing tabs
    walkJsonModel(sourceJson, (node, parent) => {
        if (node.type === "tab" && "id" in node && node.id && parent && "id" in parent && parent.id) {
            const parentChildren = "children" in parent ? parent.children : [];
            const index = parentChildren.findIndex((child) => "id" in child && child.id === node.id);
            sourceTabs.set(node.id, { parentId: parent.id, index });
        }
    });

    // Process target model borders
    if (targetJson.borders) {
        for (const border of targetJson.borders) {
            if (border.children) {
                border.children.forEach((tab, targetIndex) => {
                    if ("id" in tab && tab.id) {
                        const sourceLocation = sourceTabs.get(tab.id);
                        if (!sourceLocation) {
                            // New tab to add
                            actions.push(Actions.addNode(tab, `border_${border.location}`, DockLocation.CENTER, targetIndex));
                        } else if (sourceLocation.parentId !== `border_${border.location}` || sourceLocation.index !== targetIndex) {
                            // Tab moved
                            actions.push(Actions.moveNode(tab.id, `border_${border.location}`, DockLocation.CENTER, targetIndex));
                        }
                        sourceTabs.delete(tab.id);
                    }
                });
            }
        }
    }

    // Process target model layout
    walkJsonModel(targetJson, (node, parent) => {
        if (node.type === "tab" && "id" in node && node.id && parent && "id" in parent && parent.id) {
            const sourceLocation = sourceTabs.get(node.id);
            const parentChildren = "children" in parent ? parent.children : [];
            const targetIndex = parentChildren.findIndex((child) => "id" in child && child.id === node.id);

            if (!sourceLocation) {
                const tabJson = { ...node };
                actions.push(Actions.addNode(tabJson, parent.id, DockLocation.CENTER, targetIndex));
            } else if (sourceLocation.parentId !== parent.id || sourceLocation.index !== targetIndex) {
                // Move if parent changed or index changed
                actions.push(Actions.moveNode(node.id, parent.id, DockLocation.CENTER, targetIndex));
            }
            sourceTabs.delete(node.id);
        }
    });

    // Process remaining tabs in sourceTabs - these need to be deleted
    for (const [tabId] of sourceTabs.entries()) {
        actions.push(Actions.deleteTab(tabId));
    }

    return actions;
}
