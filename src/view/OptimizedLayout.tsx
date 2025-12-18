import * as React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Rect } from "../Rect";
import { BorderNode } from "../model/BorderNode";
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
 * TabRef - A placeholder component rendered inside FlexLayout.
 * It listens to TabNode events (resize, visibility) and updates the parent OptimizedLayout
 * so that the actual tab content in TabContainer can be positioned correctly.
 */
function TabRef({ node, onRectChange, onVisibilityChange }: { node: TabNode; onRectChange: (nodeId: string, rect: Rect) => void; onVisibilityChange: (nodeId: string, visible: boolean) => void }) {
    useEffect(() => {
        // Set up event listeners on the TabNode
        const handleResize = (params: { rect: Rect }) => {
            onRectChange(node.getId(), params.rect);
        };

        const handleVisibility = (params: { visible: boolean }) => {
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
    }, [node, onRectChange, onVisibilityChange]);

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
                // CRITICAL: Disable pointer events during drag to prevent drag overlay from disappearing
                // When tabs are rendered outside FlexLayout's DOM, dragging over them triggers dragleave
                // on the Layout element, causing dragEnterCount to drop to 0 and clearing the drag UI.
                pointerEvents: isDragging ? "none" : "auto",
                // Ensure tab container doesn't block FlexLayout's tab bar interactions when not dragging
                zIndex: 0,
            }}
            data-layout-path="/tab-container"
        >
            {Array.from(tabs.entries()).map(([nodeId, tabInfo]) => {
                const { node, rect, visible } = tabInfo;
                const contentClassName = node.getContentClassName();

                return (
                    <div
                        key={nodeId}
                        role="tabpanel"
                        data-tab-id={nodeId}
                        className={getClassName("flexlayout__tab") + (contentClassName ? " " + contentClassName : "")}
                        style={{
                            position: "absolute",
                            display: visible ? "flex" : "none",
                            left: rect.x,
                            top: rect.y,
                            width: rect.width,
                            height: rect.height,
                            overflow: "auto",
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
export function OptimizedLayout({ model, renderTab, classNameMapper, onDragStateChange, ...layoutProps }: IOptimizedLayoutProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [tabs, setTabs] = useState<Map<string, TabInfo>>(() => new Map());

    // Track which tabs exist in the model
    const tabNodesRef = useRef<Map<string, TabNode>>(new Map());

    // Sync tabs with model on mount and when model changes
    useEffect(() => {
        const newTabNodes = new Map<string, TabNode>();

        model.visitNodes((node) => {
            if (node instanceof TabNode) {
                newTabNodes.set(node.getId(), node);
            }
        });

        // Update ref
        tabNodesRef.current = newTabNodes;

        // Initialize tabs map for new tabs, preserve existing ones
        setTabs((prevTabs) => {
            const nextTabs = new Map<string, TabInfo>();

            for (const [nodeId, node] of newTabNodes) {
                const existing = prevTabs.get(nodeId);
                if (existing) {
                    // Preserve existing tab info (may have different node reference but same id)
                    nextTabs.set(nodeId, { ...existing, node });
                } else {
                    // New tab - initialize with empty rect, will be updated by TabRef events
                    const parent = node.getParent() as TabSetNode | BorderNode | undefined;
                    const contentRect = parent?.getContentRect() ?? Rect.empty();
                    nextTabs.set(nodeId, {
                        node,
                        rect: contentRect,
                        visible: node.isSelected(),
                    });
                }
            }

            return nextTabs;
        });
    }, [model]);

    // Handle rect changes from TabRef
    const handleRectChange = useCallback((nodeId: string, rect: Rect) => {
        setTabs((prevTabs) => {
            const existing = prevTabs.get(nodeId);
            if (!existing || existing.rect.equals(rect)) {
                return prevTabs; // No change
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
                return prevTabs; // No change
            }

            const nextTabs = new Map(prevTabs);
            nextTabs.set(nodeId, { ...existing, visible });
            return nextTabs;
        });
    }, []);

    // Handle drag state changes
    const handleDragStateChange = useCallback(
        (dragging: boolean) => {
            setIsDragging(dragging);
            // Also call the user's callback if provided
            onDragStateChange?.(dragging);
        },
        [onDragStateChange],
    );

    // Factory function that returns TabRef placeholders
    const factory = useCallback(
        (node: TabNode) => {
            return <TabRef key={node.getId()} node={node} onRectChange={handleRectChange} onVisibilityChange={handleVisibilityChange} />;
        },
        [handleRectChange, handleVisibilityChange],
    );

    // Memoize the tabs array to avoid unnecessary re-renders
    const tabsForContainer = useMemo(() => tabs, [tabs]);

    return (
        <div style={{ position: "relative", width: "100%", height: "100%" }}>
            <Layout model={model} factory={factory} classNameMapper={classNameMapper} onDragStateChange={handleDragStateChange} {...layoutProps} />
            <TabContainer tabs={tabsForContainer} renderTab={renderTab} isDragging={isDragging} classNameMapper={classNameMapper} />
        </div>
    );
}
