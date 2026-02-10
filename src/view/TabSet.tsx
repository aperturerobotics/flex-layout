import { DragEvent, MouseEvent, PointerEvent, ReactNode, useEffect, useRef } from "react";
import { I18nLabel } from "../I18nLabel";
import { Actions } from "../model/Actions";
import { TabNode } from "../model/TabNode";
import { TabSetNode } from "../model/TabSetNode";
import { showPopup } from "./PopupMenu";
import { LayoutInternal, ITabSetRenderValues } from "./Layout";
import { TabButton } from "./TabButton";
import { useTabOverflow } from "./TabOverflowHook";
import { Orientation } from "../Orientation";
import { CLASSES } from "../Types";
import { isAuxMouseEvent } from "./Utils";
import { createPortal } from "react-dom";
import { Rect } from "../Rect";

/** @internal */
export interface ITabSetProps {
    layout: LayoutInternal;
    node: TabSetNode;
}

/** @internal */
export const TabSet = (props: ITabSetProps) => {
    const { node, layout } = props;

    const tabStripRef = useRef<HTMLDivElement | null>(null);
    const tabStripInnerRef = useRef<HTMLDivElement | null>(null);
    const contentRef = useRef<HTMLDivElement | null>(null);
    const buttonBarRef = useRef<HTMLDivElement | null>(null);
    const overflowbuttonRef = useRef<HTMLButtonElement | null>(null);
    const stickyButtonsRef = useRef<HTMLDivElement | null>(null);

    const icons = layout.getIcons();

    // Track if this is the first render to avoid redraw loops
    const isFirstRender = useRef(true);

    // Measure DOM elements and update node rects
    // Use useEffect (rather than useLayoutEffect) otherwise contentrect not set correctly (has height 0 when changing theme in demo)
    useEffect(() => {
        node.setRect(layout.getBoundingClientRect(selfRef.current!));

        if (tabStripRef.current) {
            node.setTabStripRect(layout.getBoundingClientRect(tabStripRef.current));
        }

        const newContentRect = Rect.getContentRect(contentRef.current!).relativeTo(layout.getDomRect());
        const oldContentRect = node.getContentRect();
        if (!oldContentRect.equals(newContentRect)) {
            node.setContentRect(newContentRect);
            // Trigger redraw when content rect changes, UNLESS it's first render AND old rect already had valid dimensions.
            // On first render, we need to redraw if contentRect went from (0,0,0,0) to valid dimensions,
            // otherwise tabs won't be rendered (their factory won't be called).
            const oldWasEmpty = oldContentRect.width === 0 && oldContentRect.height === 0;
            const shouldRedraw = !isFirstRender.current || oldWasEmpty;
            if (shouldRedraw) {
                layout.redrawInternal("tabset content rect " + newContentRect.toString());
            }
        }
        isFirstRender.current = false;
    });

    // this must be after the useEffect, so the node rect is already set
    const { selfRef, position, userControlledLeft, hiddenTabs, onMouseWheel, tabsTruncated } = useTabOverflow(node, Orientation.HORZ, buttonBarRef, stickyButtonsRef);

    const onOverflowClick = (event: MouseEvent<HTMLElement>) => {
        const callback = layout.getShowOverflowMenu();
        if (callback !== undefined) {
            callback(node, event, hiddenTabs, onOverflowItemSelect);
        } else {
            const element = overflowbuttonRef.current!;
            showPopup(element, hiddenTabs, onOverflowItemSelect, layout);
        }
        event.stopPropagation();
    };

    const onOverflowItemSelect = (item: { node: TabNode; index: number }) => {
        layout.doAction(Actions.selectTab(item.node.getId()));
        userControlledLeft.current = false;
    };

    const onDragStart = (event: DragEvent<HTMLElement>) => {
        if (!layout.getEditingTab()) {
            if (node.isEnableDrag()) {
                event.stopPropagation();
                layout.setDragNode(event.nativeEvent, node);
            } else {
                event.preventDefault();
            }
        } else {
            event.preventDefault();
        }
    };

    const onPointerDown = (event: PointerEvent<HTMLElement>) => {
        if (!isAuxMouseEvent(event)) {
            layout.doAction(Actions.setActiveTabset(node.getId(), layout.getWindowId()));
        }
    };

    const onAuxMouseClick = (event: MouseEvent<HTMLElement>) => {
        if (isAuxMouseEvent(event)) {
            layout.auxMouseClick(node, event);
        }
    };

    const onContextMenu = (event: MouseEvent<HTMLElement>) => {
        layout.showContextMenu(node, event);
    };

    const onInterceptPointerDown = (event: PointerEvent) => {
        event.stopPropagation();
    };

    const onMaximizeToggle = (event: MouseEvent<HTMLElement>) => {
        if (node.canMaximize()) {
            layout.maximize(node);
        }
        event.stopPropagation();
    };

    const onClose = (event: MouseEvent<HTMLElement>) => {
        layout.doAction(Actions.deleteTabset(node.getId()));
        event.stopPropagation();
    };

    const onCloseTab = (event: MouseEvent<HTMLElement>) => {
        layout.doAction(Actions.deleteTab(node.getChildren()[0].getId()));
        event.stopPropagation();
    };

    const onDoubleClick = (_event: MouseEvent<HTMLElement>) => {
        if (node.canMaximize()) {
            layout.maximize(node);
        }
    };

    // Start Render

    const cm = layout.getClassName;

    // tabbar inner can get shifted left via tab rename, this resets scrollleft to 0
    if (tabStripInnerRef.current !== null && tabStripInnerRef.current.scrollLeft !== 0) {
        tabStripInnerRef.current.scrollLeft = 0;
    }

    const path = node.getPath();

    const tabs = [];
    if (node.isEnableTabStrip()) {
        for (let i = 0; i < node.getChildren().length; i++) {
            const child = node.getChildren()[i] as TabNode;
            const isSelected = node.getSelected() === i;
            tabs.push(<TabButton layout={layout} node={child} path={path + "/tb" + i} key={child.getId()} selected={isSelected} />);
            if (i < node.getChildren().length - 1) {
                tabs.push(<div key={"divider" + i} className={cm(CLASSES.FLEXLAYOUT__TABSET_TAB_DIVIDER)}></div>);
            }
        }
    }

    let stickyButtons: ReactNode[] = [];
    let buttons: ReactNode[] = [];

    // allow customization of header contents and buttons
    const renderState: ITabSetRenderValues = { stickyButtons, buttons, overflowPosition: undefined };
    layout.customizeTabSet(node, renderState);
    stickyButtons = renderState.stickyButtons;
    buttons = renderState.buttons;

    const isTabStretch = node.isEnableSingleTabStretch() && node.getChildren().length === 1;
    const showClose = (isTabStretch && (node.getChildren()[0] as TabNode).isEnableClose()) || node.isEnableClose();

    if (renderState.overflowPosition === undefined) {
        renderState.overflowPosition = stickyButtons.length;
    }

    if (stickyButtons.length > 0) {
        if (!node.isEnableTabWrap() && (tabsTruncated || isTabStretch)) {
            buttons = [...stickyButtons, ...buttons];
        } else {
            tabs.push(
                <div
                    ref={stickyButtonsRef}
                    key="sticky_buttons_container"
                    onPointerDown={onInterceptPointerDown}
                    onDragStart={(e) => {
                        e.preventDefault();
                    }}
                    className={cm(CLASSES.FLEXLAYOUT__TAB_TOOLBAR_STICKY_BUTTONS_CONTAINER)}
                >
                    {stickyButtons}
                </div>,
            );
        }
    }

    if (!node.isEnableTabWrap()) {
        if (hiddenTabs.length > 0) {
            const overflowTitle = layout.i18nName(I18nLabel.Overflow_Menu_Tooltip);
            let overflowContent;
            if (typeof icons.more === "function") {
                overflowContent = icons.more(node, hiddenTabs);
            } else {
                overflowContent = (
                    <>
                        {icons.more}
                        <div className={cm(CLASSES.FLEXLAYOUT__TAB_BUTTON_OVERFLOW_COUNT)}>{hiddenTabs.length}</div>
                    </>
                );
            }
            void buttons.splice(
                Math.min(renderState.overflowPosition, buttons.length),
                0,
                <button
                    key="overflowbutton"
                    data-layout-path={path + "/button/overflow"}
                    ref={overflowbuttonRef}
                    className={cm(CLASSES.FLEXLAYOUT__TAB_TOOLBAR_BUTTON) + " " + cm(CLASSES.FLEXLAYOUT__TAB_BUTTON_OVERFLOW)}
                    title={overflowTitle}
                    onClick={onOverflowClick}
                    onPointerDown={onInterceptPointerDown}
                >
                    {overflowContent}
                </button>,
            );
        }
    }

    if (node.canMaximize()) {
        const minTitle = layout.i18nName(I18nLabel.Restore);
        const maxTitle = layout.i18nName(I18nLabel.Maximize);
        buttons.push(
            <button
                key="max"
                data-layout-path={path + "/button/max"}
                title={node.isMaximized() ? minTitle : maxTitle}
                className={cm(CLASSES.FLEXLAYOUT__TAB_TOOLBAR_BUTTON) + " " + cm(CLASSES.FLEXLAYOUT__TAB_TOOLBAR_BUTTON_ + (node.isMaximized() ? "max" : "min"))}
                onClick={onMaximizeToggle}
                onPointerDown={onInterceptPointerDown}
            >
                {node.isMaximized() ?
                    typeof icons.restore === "function" ?
                        icons.restore(node)
                    :   icons.restore
                : typeof icons.maximize === "function" ?
                    icons.maximize(node)
                :   icons.maximize}
            </button>,
        );
    }

    if (!node.isMaximized() && showClose) {
        const title = isTabStretch ? layout.i18nName(I18nLabel.Close_Tab) : layout.i18nName(I18nLabel.Close_Tabset);
        buttons.push(
            <button
                key="close"
                data-layout-path={path + "/button/close"}
                title={title}
                className={cm(CLASSES.FLEXLAYOUT__TAB_TOOLBAR_BUTTON) + " " + cm(CLASSES.FLEXLAYOUT__TAB_TOOLBAR_BUTTON_CLOSE)}
                onClick={isTabStretch ? onCloseTab : onClose}
                onPointerDown={onInterceptPointerDown}
            >
                {typeof icons.closeTabset === "function" ? icons.closeTabset(node) : icons.closeTabset}
            </button>,
        );
    }

    if (node.isActive() && node.isEnableActiveIcon()) {
        const title = layout.i18nName(I18nLabel.Active_Tabset);
        buttons.push(
            <div key="active" data-layout-path={path + "/button/active"} title={title} className={cm(CLASSES.FLEXLAYOUT__TAB_TOOLBAR_ICON)}>
                {typeof icons.activeTabset === "function" ? icons.activeTabset(node) : icons.activeTabset}
            </div>,
        );
    }

    const buttonbar = (
        <div
            key="buttonbar"
            ref={buttonBarRef}
            className={cm(CLASSES.FLEXLAYOUT__TAB_TOOLBAR)}
            onPointerDown={onInterceptPointerDown}
            onDragStart={(e) => {
                e.preventDefault();
            }}
        >
            {buttons}
        </div>
    );

    let tabStrip;

    let tabStripClasses = cm(CLASSES.FLEXLAYOUT__TABSET_TABBAR_OUTER);
    if (node.getClassNameTabStrip() !== undefined) {
        tabStripClasses += " " + node.getClassNameTabStrip();
    }
    tabStripClasses += " " + CLASSES.FLEXLAYOUT__TABSET_TABBAR_OUTER_ + node.getTabLocation();

    if (node.isActive()) {
        tabStripClasses += " " + cm(CLASSES.FLEXLAYOUT__TABSET_SELECTED);
    }

    if (node.isMaximized()) {
        tabStripClasses += " " + cm(CLASSES.FLEXLAYOUT__TABSET_MAXIMIZED);
    }

    if (isTabStretch) {
        const tabNode = node.getChildren()[0] as TabNode;
        if (tabNode.getTabSetClassName() !== undefined) {
            tabStripClasses += " " + tabNode.getTabSetClassName();
        }
    }

    if (node.isEnableTabWrap()) {
        if (node.isEnableTabStrip()) {
            tabStrip = (
                <div
                    className={tabStripClasses}
                    style={{ flexWrap: "wrap", gap: "1px", marginTop: "2px" }}
                    ref={tabStripRef}
                    data-layout-path={path + "/tabstrip"}
                    onPointerDown={onPointerDown}
                    onDoubleClick={onDoubleClick}
                    onContextMenu={onContextMenu}
                    onClick={onAuxMouseClick}
                    onAuxClick={onAuxMouseClick}
                    draggable={true}
                    onDragStart={onDragStart}
                >
                    {tabs}
                    <div style={{ flexGrow: 1 }} />
                    {buttonbar}
                </div>
            );
        }
    } else {
        if (node.isEnableTabStrip()) {
            tabStrip = (
                <div
                    className={tabStripClasses}
                    ref={tabStripRef}
                    data-layout-path={path + "/tabstrip"}
                    onPointerDown={onPointerDown}
                    onDoubleClick={onDoubleClick}
                    onContextMenu={onContextMenu}
                    onClick={onAuxMouseClick}
                    onAuxClick={onAuxMouseClick}
                    draggable={true}
                    onWheel={onMouseWheel}
                    onDragStart={onDragStart}
                >
                    <div ref={tabStripInnerRef} className={cm(CLASSES.FLEXLAYOUT__TABSET_TABBAR_INNER) + " " + cm(CLASSES.FLEXLAYOUT__TABSET_TABBAR_INNER_ + node.getTabLocation())}>
                        <div
                            style={{ left: position, width: isTabStretch ? "100%" : "10000px" }}
                            className={cm(CLASSES.FLEXLAYOUT__TABSET_TABBAR_INNER_TAB_CONTAINER) + " " + cm(CLASSES.FLEXLAYOUT__TABSET_TABBAR_INNER_TAB_CONTAINER_ + node.getTabLocation())}
                        >
                            {tabs}
                        </div>
                    </div>
                    {buttonbar}
                </div>
            );
        }
    }

    let emptyTabset: ReactNode;
    if (node.getChildren().length === 0) {
        const placeHolderCallback = layout.getTabSetPlaceHolderCallback();
        if (placeHolderCallback) {
            emptyTabset = placeHolderCallback(node);
        }
    }

    let content = (
        <div ref={contentRef} className={cm(CLASSES.FLEXLAYOUT__TABSET_CONTENT)}>
            {emptyTabset}
        </div>
    );

    if (node.getTabLocation() === "top") {
        content = (
            <>
                {tabStrip}
                {content}
            </>
        );
    } else {
        content = (
            <>
                {content}
                {tabStrip}
            </>
        );
    }

    const style: Record<string, string | number> = {
        flexGrow: Math.max(1, node.getWeight() * 1000),
        minWidth: node.getMinWidth(),
        minHeight: node.getMinHeight(),
        maxWidth: node.getMaxWidth(),
        maxHeight: node.getMaxHeight(),
    };

    if (node.getModel().getMaximizedTabset(layout.getWindowId()) !== undefined && !node.isMaximized()) {
        style.display = "none";
    }

    // note: tabset container is needed to allow flexbox to size without border/padding/margin
    // then inner tabset can have border/padding/margin for styling
    const tabset = (
        <div ref={selfRef} className={cm(CLASSES.FLEXLAYOUT__TABSET_CONTAINER)} style={style}>
            <div className={cm(CLASSES.FLEXLAYOUT__TABSET)} data-layout-path={path}>
                {content}
            </div>
        </div>
    );

    if (node.isMaximized()) {
        if (layout.getMainElement()) {
            return createPortal(
                <div
                    style={{
                        position: "absolute",
                        display: "flex",
                        top: 0,
                        left: 0,
                        bottom: 0,
                        right: 0,
                    }}
                >
                    {tabset}
                </div>,
                layout.getMainElement()!,
            );
        } else {
            return tabset;
        }
    } else {
        return tabset;
    }
};
