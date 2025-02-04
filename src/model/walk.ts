import { IJsonModel, IJsonBorderNode, IJsonRowNode, IJsonTabSetNode, IJsonTabNode } from "./IJsonModel";

/** Union type representing all possible node types in the JSON model */
export type JsonNode = IJsonBorderNode | IJsonRowNode | IJsonTabSetNode | IJsonTabNode;
export interface VisitorResult {
    /** If true, do not process any children of the current node */
    skipChildren?: boolean;
    /** If true, remove the current node from its parent's children array */
    delete?: boolean;
}

/**
 * Function type for visiting nodes in the model tree
 * @param node The current node being visited
 * @param parent The parent of the current node, or null for top-level nodes
 * @returns
 * - void/true to continue normally
 * - false to stop traversal completely
 * - VisitorResult to control traversal or delete nodes
 */
export type ModelVisitor = (node: JsonNode, parent: JsonNode | null) => void | boolean | VisitorResult;

/**
 * Finds a node by its ID in the model tree
 * @param model The model to search
 * @param id The ID to find
 * @returns The found node or undefined if not found
 */
export function findJsonNodeById(model: IJsonModel, id: string): JsonNode | undefined {
    let result: JsonNode | undefined;

    walkJsonModel(model, (node) => {
        if ("id" in node && node.id === id) {
            result = node;
            return { skipChildren: true }; // found it, no need to check children
        }
        return true;
    });

    return result;
}

/**
 * Walks an IJsonModel tree using a stack-based approach, calling visitor for each node.
 * The walk processes borders first, then traverses the main layout in a depth-first manner.
 * @param model The model to traverse
 * @param visitor Callback called for each node in the tree. The visitor can:
 *               - Return false to stop the traversal completely
 *               - Return {skipChildren: true} to skip processing children
 *               - Return {delete: true} to remove the current node from its parent
 *               - Return nothing or true to continue normally
 *               The visitor receives the current node and its parent (null for top-level nodes).
 */
export function walkJsonModel(model: IJsonModel | JsonNode, visitor: ModelVisitor): void {
    // Stack of nodes to visit and their parents
    const stack: Array<[JsonNode, JsonNode | null]> = [];

    if ('layout' in model) {
        // Model is IJsonModel
        // Add borders if they exist
        if (model.borders) {
            for (const border of model.borders) {
                stack.push([border, null]);
            }
        }

        // Add root layout
        stack.push([model.layout, null]);
    } else {
        // Model is JsonNode
        stack.push([model, null]);
    }

    // Process stack
    while (stack.length > 0) {
        const [node, parent] = stack.pop()!;

        // Visit current node
        const result = visitor(node, parent);

        // Handle different return types
        if (result === false) {
            break;
        }

        const visitorResult = typeof result === "object" ? result : undefined;

        // Handle deletion if requested
        if (visitorResult?.delete && parent && "children" in parent) {
            const index = parent.children.findIndex((child) => child === node);
            if (index !== -1) {
                parent.children.splice(index, 1);
                continue;
            }
        }

        // Skip children if requested or process them
        if (!visitorResult?.skipChildren && "children" in node) {
            // Add children to stack in reverse order so they're processed in forward order
            for (let i = node.children.length - 1; i >= 0; i--) {
                stack.push([node.children[i], node]);
            }
        }
    }
}
