import * as React from "react";
import { I18nLabel } from "../I18nLabel";
import { Actions } from "../model/Actions";
import { TabNode } from "../model/TabNode";
import { TabSetNode } from "../model/TabSetNode";
import { LayoutInternal } from "./Layout";
import { CLASSES } from "../Types";
import { getRenderStateEx, isAuxMouseEvent, isTabClosable } from "./Utils";

/** @internal */
export interface ITabButtonProps {
    layout: LayoutInternal;
    node: TabNode;
    selected: boolean;
    path: string;
}

/** @internal */
export const TabButton = (props: ITabButtonProps) => {
    const { layout, node, selected, path } = props;
    const selfRef = React.useRef<HTMLDivElement | null>(null);
    const contentRef = React.useRef<HTMLInputElement | null>(null);
    const icons = layout.getIcons();

    // Measure and set tab rect after each render, and focus input if editing
    React.useLayoutEffect(() => {
        node.setTabRect(layout.getBoundingClientRect(selfRef.current!));
        if (layout.getEditingTab() === node) {
            (contentRef.current! as HTMLInputElement).select();
        }
    });

    const onDragStart = (event: React.DragEvent<HTMLElement>) => {
        if (node.isEnableDrag()) {
            event.stopPropagation(); // prevent starting a tabset drag as well
            layout.setDragNode(event.nativeEvent, node as TabNode);
        } else {
            event.preventDefault();
        }
    };

    const onDragEnd = (event: React.DragEvent<HTMLElement>) => {
        layout.clearDragMain();
    };

    const onAuxMouseClick = (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
        if (isAuxMouseEvent(event)) {
            layout.auxMouseClick(node, event);
        }
    };

    const onContextMenu = (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
        layout.showContextMenu(node, event);
    };

    const onClick = () => {
        layout.doAction(Actions.selectTab(node.getId()));
    };

    const onDoubleClick = (event: React.MouseEvent<HTMLElement>) => {
        if (node.isEnableRename()) {
            onRename();
            event.stopPropagation();
        }
    };

    const onRename = () => {
        layout.setEditingTab(node);
        layout.getCurrentDocument()!.body.addEventListener("pointerdown", onEndEdit);
    };

    const onEndEdit = (event: Event) => {
        if (event.target !== contentRef.current!) {
            layout.getCurrentDocument()!.body.removeEventListener("pointerdown", onEndEdit);
            layout.setEditingTab(undefined);
        }
    };

    const onClose = (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        if (isTabClosable(node, selected)) {
            layout.doAction(Actions.deleteTab(node.getId()));
        } else {
            onClick();
        }
    };

    const onClosePointerDown = (event: React.PointerEvent<HTMLElement>) => {
        event.stopPropagation();
    };

    const onCloseKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
        event.stopPropagation();
    };

    const onTextBoxPointerDown = (event: React.PointerEvent<HTMLInputElement>) => {
        event.stopPropagation();
    };

    const onTextBoxKeyPress = (event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.code === "Escape") {
            // esc
            layout.setEditingTab(undefined);
        } else if (event.code === "Enter") {
            // enter
            layout.setEditingTab(undefined);
            layout.doAction(Actions.renameTab(node.getId(), (event.target as HTMLInputElement).value));
        }
    };

    const cm = layout.getClassName;
    const parentNode = node.getParent() as TabSetNode;

    const isStretch = parentNode.isEnableSingleTabStretch() && parentNode.getChildren().length === 1;
    const baseClassName = isStretch ? CLASSES.FLEXLAYOUT__TAB_BUTTON_STRETCH : CLASSES.FLEXLAYOUT__TAB_BUTTON;
    let classNames = cm(baseClassName);
    classNames += " " + cm(baseClassName + "_" + parentNode.getTabLocation());

    if (!isStretch) {
        if (selected) {
            classNames += " " + cm(baseClassName + "--selected");
        } else {
            classNames += " " + cm(baseClassName + "--unselected");
        }
    }

    if (node.getClassName() !== undefined) {
        classNames += " " + node.getClassName();
    }

    const renderState = getRenderStateEx(layout, node);

    let content = renderState.content ? <div className={cm(CLASSES.FLEXLAYOUT__TAB_BUTTON_CONTENT)}>{renderState.content}</div> : null;

    const leading = renderState.leading ? <div className={cm(CLASSES.FLEXLAYOUT__TAB_BUTTON_LEADING)}>{renderState.leading}</div> : null;

    if (layout.getEditingTab() === node) {
        content = (
            <input
                ref={contentRef}
                className={cm(CLASSES.FLEXLAYOUT__TAB_BUTTON_TEXTBOX)}
                data-layout-path={path + "/textbox"}
                type="text"
                autoFocus={true}
                defaultValue={node.getName()}
                onKeyDown={onTextBoxKeyPress}
                onPointerDown={onTextBoxPointerDown}
            />
        );
    }

    if (node.isEnableClose() && !isStretch) {
        const closeTitle = layout.i18nName(I18nLabel.Close_Tab);
        renderState.buttons.push(
            <button
                key="close"
                data-layout-path={path + "/button/close"}
                title={closeTitle}
                className={cm(CLASSES.FLEXLAYOUT__TAB_BUTTON_TRAILING)}
                onPointerDown={onClosePointerDown}
                onClick={onClose}
                onKeyDown={onCloseKeyDown}
            >
                {typeof icons.close === "function" ? icons.close(node) : icons.close}
            </button>,
        );
    }

    const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onClick();
        }
    };

    return (
        <div
            ref={selfRef}
            role="button"
            tabIndex={0}
            aria-pressed={selected}
            data-layout-path={path}
            className={classNames}
            onClick={onClick}
            onKeyDown={onKeyDown}
            onAuxClick={onAuxMouseClick}
            onContextMenu={onContextMenu}
            title={node.getHelpText()}
            draggable={true}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDoubleClick={onDoubleClick}
        >
            {leading}
            {content}
            {renderState.buttons}
        </div>
    );
};
