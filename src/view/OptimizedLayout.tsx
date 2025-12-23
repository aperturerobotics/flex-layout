import * as React from "react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Rect } from "../Rect";
import { Action } from "../model/Action";
import { Actions } from "../model/Actions";
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
 *
 * Unlike the standard Tab component, TabRef must explicitly call node.setVisible()
 * to trigger visibility events, since the Tab component (which normally does this)
 * is not rendered in OptimizedLayout.
 */
function TabRef({
    node,
    selected,
    onTabMount,
    onRectChange,
    onVisibilityChange,
}: {
    node: TabNode;
    selected: boolean;
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

        return () => {
            node.removeEventListener("resize");
            node.removeEventListener("visibility");
            // Clear visibility on unmount (like Tab.tsx does)
            node.setVisible(false);
        };
    }, [node, onTabMount, onRectChange, onVisibilityChange]);

    // Update visibility when selection changes.
    // This mirrors what Tab.tsx does in its useLayoutEffect.
    // Must be in a separate effect so it runs on every selection change.
    useEffect(() => {
        node.setVisible(selected);
    }, [node, selected]);

    // TabRef renders nothing - it's just a bridge to the real tab content
    return null;
}

/**
 * TabPanel - Memoized wrapper for individual tab content.
 * This prevents tab content from re-rendering when TabContainer re-renders
 * due to drag state changes or other props that don't affect the tab content.
 */
const TabPanel = memo(function TabPanel({
    nodeId,
    node,
    rect,
    visible,
    isDragging,
    contentClassName,
    className,
    renderTab,
    onPointerDown,
    isMaximized,
    hasMaximizedTabset,
}: {
    nodeId: string;
    node: TabNode;
    rect: Rect;
    visible: boolean;
    isDragging: boolean;
    contentClassName: string | undefined;
    className: string;
    renderTab: (node: TabNode) => React.ReactNode;
    onPointerDown: () => void;
    isMaximized: boolean;
    hasMaximizedTabset: boolean;
}) {
    // Use percentage-based sizing as fallback when dimensions are 0 (initial state).
    // This ensures tab content is clickable before resize events fire.
    const hasValidDimensions = rect.width > 0 && rect.height > 0;

    // Memoize the rendered content to prevent re-renders when only positioning changes
    const content = useMemo(() => renderTab(node), [renderTab, node]);

    // Determine visibility and zIndex based on selection and maximize state.
    //
    // Normal state (no maximize):
    //   - Show tab if it's selected in its tabset (visible = true)
    //
    // Maximized state:
    //   - Tab in maximized tabset AND selected: visible with zIndex: 11
    //   - Tab in maximized tabset but NOT selected: hidden
    //   - Tab NOT in maximized tabset: hidden
    //
    // We use visibility: hidden (not display: none) to keep components mounted
    // and avoid unmount/remount cycles when maximizing/restoring.
    let isHidden = !visible;
    let zIndex: number | undefined;

    if (hasMaximizedTabset) {
        if (isMaximized && visible) {
            // Selected tab in maximized tabset - show with higher z-index
            zIndex = 11;
            isHidden = false;
        } else {
            // Either not in maximized tabset, or not selected - hide it
            isHidden = true;
        }
    }

    return (
        <div
            role="tabpanel"
            data-tab-id={nodeId}
            className={className + (contentClassName ? " " + contentClassName : "")}
            style={{
                position: "absolute",
                visibility: isHidden ? "hidden" : "visible",
                left: hasValidDimensions ? rect.x : 0,
                top: hasValidDimensions ? rect.y : 0,
                width: hasValidDimensions ? rect.width : "100%",
                height: hasValidDimensions ? rect.height : "100%",
                overflow: "auto",
                zIndex,
                // Tab panels receive pointer events when visible and not dragging
                pointerEvents: !isHidden && !isDragging ? "auto" : "none",
            }}
            onPointerDown={onPointerDown}
        >
            {content}
        </div>
    );
});

/**
 * TabContainer - Renders all tab content with absolute positioning.
 * This is a sibling to the Layout component, not inside FlexLayout's DOM.
 */
function TabContainer({
    tabs,
    renderTab,
    isDragging,
    classNameMapper,
    model,
}: {
    tabs: Map<string, TabInfo>;
    renderTab: (node: TabNode) => React.ReactNode;
    isDragging: boolean;
    classNameMapper?: (defaultClassName: string) => string;
    model: Model;
}) {
    const className = classNameMapper ? classNameMapper("flexlayout__tab") : "flexlayout__tab";

    // Check if there's a maximized tabset in the model
    const maximizedTabset = model.getMaximizedTabset(Model.MAIN_WINDOW_ID);
    const hasMaximizedTabset = maximizedTabset !== undefined;

    // Handle pointer down on tab content to activate the parent tabset
    const handlePointerDown = useCallback(
        (node: TabNode) => {
            const parent = node.getParent();
            if (parent instanceof TabSetNode) {
                if (!parent.isActive()) {
                    // Use the model's doAction to set the active tabset
                    model.doAction(Actions.setActiveTabset(parent.getId(), Model.MAIN_WINDOW_ID));
                }
            }
        },
        [model],
    );

    return (
        <div className="flexlayout__optimized_layout_tab_container" data-layout-path="/tab-container">
            {Array.from(tabs.entries()).map(([nodeId, tabInfo]) => {
                // Check if this tab's parent tabset is the maximized one
                const parent = tabInfo.node.getParent();
                const isMaximized = parent instanceof TabSetNode && parent.isMaximized();

                return (
                    <TabPanel
                        key={nodeId}
                        nodeId={nodeId}
                        node={tabInfo.node}
                        rect={tabInfo.rect}
                        visible={tabInfo.visible}
                        isDragging={isDragging}
                        contentClassName={tabInfo.node.getContentClassName()}
                        className={className}
                        renderTab={renderTab}
                        onPointerDown={() => handlePointerDown(tabInfo.node)}
                        isMaximized={isMaximized}
                        hasMaximizedTabset={hasMaximizedTabset}
                    />
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
            // Sync tabs with the updated model and update visibility based on selection state.
            // This is critical because TabRef components may not be rendered yet (when contentRect.height is 0),
            // so we can't rely solely on TabRef's visibility events. We must update visibility here
            // based on each tab's isSelected() state.
            setTabs((prevTabs) => {
                const synced = syncTabsWithModel(prevTabs);

                // Update visibility for all tabs based on current selection state
                let hasVisibilityChange = false;
                const updated = new Map<string, TabInfo>();

                for (const [nodeId, tabInfo] of synced) {
                    const shouldBeVisible = tabInfo.node.isSelected();
                    if (tabInfo.visible !== shouldBeVisible) {
                        hasVisibilityChange = true;
                        updated.set(nodeId, { ...tabInfo, visible: shouldBeVisible });
                    } else {
                        updated.set(nodeId, tabInfo);
                    }
                }

                return hasVisibilityChange ? updated : synced;
            });
            userOnModelChange?.(changedModel, action);
        },
        [syncTabsWithModel, userOnModelChange],
    );

    // Factory function that returns TabRef placeholders
    const factory = useCallback(
        (node: TabNode) => {
            return <TabRef key={node.getId()} node={node} selected={node.isSelected()} onTabMount={handleTabMount} onRectChange={handleRectChange} onVisibilityChange={handleVisibilityChange} />;
        },
        [handleTabMount, handleRectChange, handleVisibilityChange],
    );

    // Wrap Layout and TabContainer in a container that fills its parent.
    // Uses position: absolute with inset: 0 to fill, which works regardless of whether
    // the parent is a flex container. Layout also uses position: absolute with inset: 0,
    // so this wrapper provides a positioning context for both Layout and TabContainer.
    // The "flexlayout__optimized_layout" class allows CSS to target this wrapper.
    // Positioning is done via CSS class (not inline styles) to allow customization.
    return (
        <div className="flexlayout__optimized_layout">
            <Layout model={model} factory={factory} classNameMapper={classNameMapper} onDragStateChange={handleDragStateChange} onModelChange={handleModelChange} {...layoutProps} />
            <TabContainer tabs={tabs} renderTab={renderTab} isDragging={isDragging} classNameMapper={classNameMapper} model={model} />
        </div>
    );
}
