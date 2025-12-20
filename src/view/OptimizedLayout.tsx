import * as React from "react";
import { useCallback, useEffect, useState } from "react";
import { Rect } from "../Rect";
import { Action } from "../model/Action";
import { BorderNode } from "../model/BorderNode";
import { Model } from "../model/Model";
import { ResizeEventParams, VisibilityEventParams } from "../model/Node";
import { TabNode } from "../model/TabNode";
import { TabSetNode } from "../model/TabSetNode";
import { ILayoutProps, Layout } from "./Layout";

/**
 * Props for OptimizedLayout - similar to Layout but with `renderTab` instead of `factory`
 */
export interface IOptimizedLayoutProps extends Omit<ILayoutProps, "factory"> {
    /** Function to render tab content - receives TabNode, returns React element */
    renderTab: (node: TabNode) => React.ReactNode;
}

/**
 * Information about a tab's position and visibility for the TabContainer
 */
interface TabInfo {
    node: TabNode;
    rect: Rect;
    visible: boolean;
}

/**
 * Creates initial TabInfo for a new tab node
 */
function createTabInfo(node: TabNode): TabInfo {
    const parent = node.getParent() as TabSetNode | BorderNode | undefined;
    const contentRect = parent?.getContentRect() ?? Rect.empty();
    return {
        node,
        rect: contentRect,
        visible: node.isSelected(),
    };
}

/**
 * TabRef - A placeholder component rendered inside FlexLayout.
 * It listens to TabNode events (resize, visibility) and updates the parent OptimizedLayout
 * so that the actual tab content in TabContainer can be positioned correctly.
 */
function TabRef({
    node,
    onTabMount,
    onRectChange,
    onVisibilityChange,
}: {
    node: TabNode;
    onTabMount: (node: TabNode) => void;
    onRectChange: (nodeId: string, rect: Rect) => void;
    onVisibilityChange: (nodeId: string, visible: boolean) => void;
}) {
    useEffect(() => {
        // Ensure the tab exists in the tabs Map when TabRef mounts.
        // This handles dynamically added tabs that weren't in the initial model.
        onTabMount(node);

        // Set up event listeners on the TabNode
        const handleResize = (params: ResizeEventParams) => {
            onRectChange(node.getId(), params.rect);
        };

        const handleVisibility = (params: VisibilityEventParams) => {
            onVisibilityChange(node.getId(), params.visible);
        };

        node.setEventListener("resize", handleResize);
        node.setEventListener("visibility", handleVisibility);

        // Get initial rect from parent's content rect
        const parent = node.getParent() as TabSetNode | BorderNode | undefined;
        if (parent) {
            const contentRect = parent.getContentRect();
            if (contentRect && contentRect.width > 0 && contentRect.height > 0) {
                onRectChange(node.getId(), contentRect);
            }
        }

        // Set initial visibility based on selection
        onVisibilityChange(node.getId(), node.isSelected());

        return () => {
            node.removeEventListener("resize");
            node.removeEventListener("visibility");
        };
    }, [node, onTabMount, onRectChange, onVisibilityChange]);

    // TabRef renders nothing - it's just a bridge to the real tab content
    return null;
}

/**
 * TabContainer - Renders all tab content with absolute positioning.
 * This is a sibling to the Layout component, not inside FlexLayout's DOM.
 */
function TabContainer({
    tabs,
    renderTab,
    isDragging,
    classNameMapper,
}: {
    tabs: Map<string, TabInfo>;
    renderTab: (node: TabNode) => React.ReactNode;
    isDragging: boolean;
    classNameMapper?: (defaultClassName: string) => string;
}) {
    const getClassName = useCallback(
        (defaultClassName: string) => {
            return classNameMapper ? classNameMapper(defaultClassName) : defaultClassName;
        },
        [classNameMapper],
    );

    return (
        <div
            style={{
                position: "absolute",
                inset: 0,
                // CRITICAL: The container itself always has pointer-events: none
                // so it doesn't block clicks on elements beneath it (like FlexLayout's tab bar).
                // Individual tab panels have pointer-events: auto to receive clicks.
                // During drag, we also disable pointer events on the children to prevent
                // dragleave events on the Layout element.
                pointerEvents: "none",
                // Ensure tab container doesn't block FlexLayout's tab bar interactions
                zIndex: 0,
            }}
            data-layout-path="/tab-container"
        >
            {Array.from(tabs.entries()).map(([nodeId, tabInfo]) => {
                const { node, rect, visible } = tabInfo;
                const contentClassName = node.getContentClassName();
                // Use percentage-based sizing as fallback when dimensions are 0 (initial state).
                // This ensures tab content is clickable before resize events fire.
                const hasValidDimensions = rect.width > 0 && rect.height > 0;

                return (
                    <div
                        key={nodeId}
                        role="tabpanel"
                        data-tab-id={nodeId}
                        className={getClassName("flexlayout__tab") + (contentClassName ? " " + contentClassName : "")}
                        style={{
                            position: "absolute",
                            display: visible ? "flex" : "none",
                            left: hasValidDimensions ? rect.x : 0,
                            top: hasValidDimensions ? rect.y : 0,
                            width: hasValidDimensions ? rect.width : "100%",
                            height: hasValidDimensions ? rect.height : "100%",
                            overflow: "auto",
                            // Tab panels receive pointer events when visible and not dragging
                            pointerEvents: visible && !isDragging ? "auto" : "none",
                        }}
                    >
                        {renderTab(node)}
                    </div>
                );
            })}
        </div>
    );
}

/**
 * OptimizedLayout - A wrapper around FlexLayout that renders tab content outside of
 * FlexLayout's DOM structure for better performance.
 *
 * Key benefits:
 * 1. Tab components are NOT re-rendered when Model changes
 * 2. Tab state (scroll position, form inputs, etc.) is preserved across layout mutations
 * 3. Only CSS properties change when layout changes - no React re-renders
 *
 * The component works by:
 * 1. Rendering FlexLayout with TabRef placeholders instead of actual tab content
 * 2. TabRef components listen to resize/visibility events from TabNodes
 * 3. A sibling TabContainer renders the actual tab content with absolute positioning
 * 4. During drag operations, TabContainer uses pointer-events: none to prevent
 *    interfering with FlexLayout's drag overlay
 *
 * @see https://github.com/caplin/FlexLayout/issues/456
 */
export function OptimizedLayout({ model, renderTab, classNameMapper, onDragStateChange, onModelChange: userOnModelChange, ...layoutProps }: IOptimizedLayoutProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [tabs, setTabs] = useState<Map<string, TabInfo>>(() => new Map());

    // Sync tabs with model - collects all TabNodes and updates the tabs Map
    const syncTabsWithModel = useCallback(
        (prevTabs: Map<string, TabInfo>): Map<string, TabInfo> => {
            const modelTabNodes = new Map<string, TabNode>();
            model.visitNodes((node) => {
                if (node instanceof TabNode) {
                    modelTabNodes.set(node.getId(), node);
                }
            });

            const nextTabs = new Map<string, TabInfo>();
            let changed = false;

            // Add/update tabs that exist in the model
            for (const [nodeId, node] of modelTabNodes) {
                const existing = prevTabs.get(nodeId);
                if (existing) {
                    // Preserve existing tab info (may have different node reference but same id)
                    nextTabs.set(nodeId, { ...existing, node });
                } else {
                    nextTabs.set(nodeId, createTabInfo(node));
                    changed = true;
                }
            }

            // Check if any tabs were removed
            for (const nodeId of prevTabs.keys()) {
                if (!modelTabNodes.has(nodeId)) {
                    changed = true;
                }
            }

            // Only return new map if something changed
            if (!changed && nextTabs.size === prevTabs.size) {
                return prevTabs;
            }

            return nextTabs;
        },
        [model],
    );

    // Sync tabs with model on mount and when model instance changes
    useEffect(() => {
        setTabs((prevTabs) => syncTabsWithModel(prevTabs));
    }, [syncTabsWithModel]);

    // Handle rect changes from TabRef
    const handleRectChange = useCallback((nodeId: string, rect: Rect) => {
        setTabs((prevTabs) => {
            const existing = prevTabs.get(nodeId);
            if (!existing || existing.rect.equals(rect)) {
                return prevTabs;
            }

            const nextTabs = new Map(prevTabs);
            nextTabs.set(nodeId, { ...existing, rect });
            return nextTabs;
        });
    }, []);

    // Handle visibility changes from TabRef
    const handleVisibilityChange = useCallback((nodeId: string, visible: boolean) => {
        setTabs((prevTabs) => {
            const existing = prevTabs.get(nodeId);
            if (!existing || existing.visible === visible) {
                return prevTabs;
            }

            const nextTabs = new Map(prevTabs);
            nextTabs.set(nodeId, { ...existing, visible });
            return nextTabs;
        });
    }, []);

    // Handle tab mount - ensures the tab exists in the tabs Map
    // This is called when TabRef mounts, which happens when Layout renders a new tab
    const handleTabMount = useCallback((node: TabNode) => {
        setTabs((prevTabs) => {
            if (prevTabs.has(node.getId())) {
                return prevTabs;
            }

            const nextTabs = new Map(prevTabs);
            nextTabs.set(node.getId(), createTabInfo(node));
            return nextTabs;
        });
    }, []);

    // Handle drag state changes
    const handleDragStateChange = useCallback(
        (dragging: boolean) => {
            setIsDragging(dragging);
            onDragStateChange?.(dragging);
        },
        [onDragStateChange],
    );

    // Handle model changes (called when model.doAction() modifies the model)
    const handleModelChange = useCallback(
        (changedModel: Model, action: Action) => {
            // Sync tabs with the updated model
            setTabs((prevTabs) => syncTabsWithModel(prevTabs));
            userOnModelChange?.(changedModel, action);
        },
        [syncTabsWithModel, userOnModelChange],
    );

    // Factory function that returns TabRef placeholders
    const factory = useCallback(
        (node: TabNode) => {
            return <TabRef key={node.getId()} node={node} onTabMount={handleTabMount} onRectChange={handleRectChange} onVisibilityChange={handleVisibilityChange} />;
        },
        [handleTabMount, handleRectChange, handleVisibilityChange],
    );

    return (
        <>
            <Layout model={model} factory={factory} classNameMapper={classNameMapper} onDragStateChange={handleDragStateChange} onModelChange={handleModelChange} {...layoutProps} />
            <TabContainer tabs={tabs} renderTab={renderTab} isDragging={isDragging} classNameMapper={classNameMapper} />
        </>
    );
}
