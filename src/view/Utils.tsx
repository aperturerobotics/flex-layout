import * as React from "react";
import { TabNode } from "../model/TabNode";
import { LayoutInternal } from "./Layout";
import { ICloseType } from "../model/ICloseType";

/** @internal */
export function isDesktop() {
    const desktop = typeof window !== "undefined" && window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    return desktop;
}
/** @internal */
export function getRenderStateEx(layout: LayoutInternal, node: TabNode, iconAngle?: number) {
    let leadingContent = undefined;
    const titleContent: React.ReactNode = node.getName();
    const name = node.getName();
    if (iconAngle === undefined) {
        iconAngle = 0;
    }

    if (leadingContent === undefined && node.getIcon() !== undefined) {
        if (iconAngle !== 0) {
            leadingContent = <img style={{ width: "1em", height: "1em", transform: "rotate(" + iconAngle + "deg)" }} src={node.getIcon()} alt="leadingContent" />;
        } else {
            leadingContent = <img style={{ width: "1em", height: "1em" }} src={node.getIcon()} alt="leadingContent" />;
        }
    }

    const buttons: React.ReactNode[] = [];

    // allow customization of leading contents (icon) and contents
    const renderState = { leading: leadingContent, content: titleContent, name, buttons };
    layout.customizeTab(node, renderState);

    node.setRenderedName(renderState.name);

    return renderState;
}

/** @internal */
export function isAuxMouseEvent(event: React.MouseEvent<HTMLElement, MouseEvent> | React.TouchEvent<HTMLElement>) {
    let auxEvent = false;
    if (event.nativeEvent instanceof MouseEvent) {
        if (event.nativeEvent.button !== 0 || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
            auxEvent = true;
        }
    }
    return auxEvent;
}

export function enablePointerOnIFrames(enable: boolean, currentDocument: Document) {
    const iframes = [...getElementsByTagName("iframe", currentDocument), ...getElementsByTagName("webview", currentDocument)];

    for (const iframe of iframes) {
        (iframe as HTMLElement).style.pointerEvents = enable ? "auto" : "none";
    }
}

export function getElementsByTagName(tag: string, currentDocument: Document): Element[] {
    return [...currentDocument.getElementsByTagName(tag)];
}

export function startDrag(doc: Document, event: React.PointerEvent<HTMLElement>, drag: (x: number, y: number) => void, dragEnd: () => void, dragCancel: () => void) {
    event.preventDefault();

    const pointerMove = (ev: PointerEvent) => {
        ev.preventDefault();
        drag(ev.clientX, ev.clientY);
    };

    const pointerCancel = (ev: PointerEvent) => {
        ev.preventDefault();
        dragCancel();
    };
    const pointerUp = () => {
        doc.removeEventListener("pointermove", pointerMove);
        doc.removeEventListener("pointerup", pointerUp);
        doc.removeEventListener("pointercancel", pointerCancel);
        dragEnd();
    };

    doc.addEventListener("pointermove", pointerMove);
    doc.addEventListener("pointerup", pointerUp);
    doc.addEventListener("pointercancel", pointerCancel);
}

export function isSafari() {
    const userAgent = navigator.userAgent;
    return userAgent.includes("Safari") && !userAgent.includes("Chrome") && !userAgent.includes("Chromium");
}

/**
 * Determines if a tab can be closed based on its closeType and selection state.
 * Used by TabButton and BorderButton to determine if the close button should be functional.
 * @internal
 */
export function isTabClosable(node: TabNode, selected: boolean): boolean {
    const closeType = node.getCloseType();
    if (selected || closeType === ICloseType.Always) {
        return true;
    }
    if (closeType === ICloseType.Visible) {
        // not selected but x should be visible due to hover
        if (window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches) {
            return true;
        }
    }
    return false;
}
