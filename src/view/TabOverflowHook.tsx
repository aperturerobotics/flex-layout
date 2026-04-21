import { RefObject, useEffect, useLayoutEffect, useRef, useState, WheelEvent } from "react";
import { TabNode } from "../model/TabNode";
import { Rect } from "../Rect";
import { TabSetNode } from "../model/TabSetNode";
import { BorderNode } from "../model/BorderNode";
import { Orientation } from "../Orientation";

/** @internal */
export const useTabOverflow = (node: TabSetNode | BorderNode, orientation: Orientation, toolbarRef: RefObject<HTMLElement | null>, stickyButtonsRef: RefObject<HTMLElement | null>) => {
    const firstRender = useRef<boolean>(true);
    const tabsTruncated = useRef<boolean>(false);
    const lastRect = useRef<Rect>(Rect.empty());
    const selfRef = useRef<HTMLDivElement | null>(null);

    const [position, setPosition] = useState<number>(0);
    const userControlledLeft = useRef<boolean>(false);
    const [hiddenTabs, setHiddenTabs] = useState<{ node: TabNode; index: number }[]>([]);
    const lastHiddenCount = useRef<number>(0);

    // if selected node or tabset/border rectangle change then unset usercontrolled (so selected tab will be kept in view)
    useLayoutEffect(() => {
        userControlledLeft.current = false;
    }, [node.getSelectedNode(), node.getRect().width, node.getRect().height]);

    const nodeRect = node instanceof TabSetNode ? node.getRect() : node.getTabHeaderRect();
    useLayoutEffect(() => {
        if (nodeRect.width > 0 && nodeRect.height > 0) {
            updateVisibleTabs();
        }
    }, [nodeRect.width, nodeRect.height]);

    const instance = toolbarRef.current;
    useEffect(() => {
        if (!instance) {
            return;
        }
        instance.addEventListener("wheel", onWheel, { passive: false });
        return () => {
            instance.removeEventListener("wheel", onWheel);
        };
    }, [instance]);

    // needed to prevent default mouse wheel over tabset/border (cannot do with react event?)
    const onWheel = (event: Event) => {
        event.preventDefault();
    };

    const getNear = (rect: Rect) => {
        if (orientation === Orientation.HORZ) {
            return rect.x;
        } else {
            return rect.y;
        }
    };

    const getFar = (rect: Rect) => {
        if (orientation === Orientation.HORZ) {
            return rect.getRight();
        } else {
            return rect.getBottom();
        }
    };

    const getSize = (rect: DOMRect | Rect) => {
        if (orientation === Orientation.HORZ) {
            return rect.width;
        } else {
            return rect.height;
        }
    };

    const getOverflowMetrics = () => {
        const tabMargin = 2;
        const nodeRect = node instanceof TabSetNode ? node.getRect() : node.getTabHeaderRect();
        const lastChild = node.getChildren()[node.getChildren().length - 1] as TabNode | undefined;
        if (!lastChild) {
            return undefined;
        }
        const stickyButtonsSize = stickyButtonsRef.current === null ? 0 : getSize(stickyButtonsRef.current.getBoundingClientRect());
        let endPos = getFar(nodeRect) - stickyButtonsSize;
        if (toolbarRef.current !== null) {
            endPos -= getSize(toolbarRef.current.getBoundingClientRect());
        }
        return { endPos, lastChild, nodeRect, tabMargin };
    };

    const clampPosition = (nextPosition: number, endPos: number, lastChild: TabNode, tabMargin: number) => {
        const minPosition = Math.min(0, endPos - (getFar(lastChild.getTabRect()) + tabMargin));
        return Math.min(0, Math.max(minPosition, nextPosition));
    };

    const getHiddenTabs = (nodeRect: Rect, endPos: number, nextPosition: number) => {
        const diff = nextPosition - position;
        const hidden: { node: TabNode; index: number }[] = [];
        for (let i = 0; i < node.getChildren().length; i++) {
            const child = node.getChildren()[i] as TabNode;
            if (getNear(child.getTabRect()) + diff < getNear(nodeRect) || getFar(child.getTabRect()) + diff > endPos) {
                hidden.push({ node: child, index: i });
            }
        }
        return hidden;
    };

    const updateVisibleTabs = () => {
        if (firstRender.current === true) {
            tabsTruncated.current = false;
        }
        const metrics = getOverflowMetrics();
        if (!metrics) {
            return;
        }
        const { endPos, lastChild, nodeRect, tabMargin } = metrics;

        if (
            firstRender.current === true ||
            (lastHiddenCount.current === 0 && hiddenTabs.length !== 0) ||
            nodeRect.width !== lastRect.current.width || // incase rect changed between first render and second
            nodeRect.height !== lastRect.current.height
        ) {
            lastHiddenCount.current = hiddenTabs.length;
            lastRect.current = nodeRect;
            const enabled = node instanceof TabSetNode ? node.isEnableTabStrip() === true : true;
            if (enabled && node.getChildren().length > 0) {
                if (hiddenTabs.length === 0 && position === 0 && getFar(lastChild.getTabRect()) + tabMargin < endPos) {
                    return; // nothing to do all tabs are shown in available space
                }

                let shiftPos = 0;

                const selectedTab = node.getSelectedNode() as TabNode;
                if (selectedTab && !userControlledLeft.current) {
                    const selectedRect = selectedTab.getTabRect();
                    const selectedStart = getNear(selectedRect) - tabMargin;
                    const selectedEnd = getFar(selectedRect) + tabMargin;

                    // when selected tab is larger than available space then align left
                    if (getSize(selectedRect) + 2 * tabMargin >= endPos - getNear(nodeRect)) {
                        shiftPos = getNear(nodeRect) - selectedStart;
                    } else {
                        if (selectedEnd > endPos || selectedStart < getNear(nodeRect)) {
                            if (selectedStart < getNear(nodeRect)) {
                                shiftPos = getNear(nodeRect) - selectedStart;
                            }
                            // use second if statement to prevent tab moving back then forwards if not enough space for single tab
                            if (selectedEnd + shiftPos > endPos) {
                                shiftPos = endPos - selectedEnd;
                            }
                        }
                    }
                }

                const extraSpace = Math.max(0, endPos - (getFar(lastChild.getTabRect()) + tabMargin + shiftPos));
                const newPosition = clampPosition(position + shiftPos + extraSpace, endPos, lastChild, tabMargin);
                const hidden = getHiddenTabs(nodeRect, endPos, newPosition);

                tabsTruncated.current = hidden.length > 0;

                firstRender.current = false; // need to do a second render
                setHiddenTabs(hidden);
                setPosition(newPosition);
            }
        } else {
            firstRender.current = true;
        }
    };

    const onMouseWheel = (event: WheelEvent<HTMLElement>) => {
        const metrics = getOverflowMetrics();
        if (!metrics) {
            return;
        }
        let delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? -event.deltaX : -event.deltaY;
        if (event.deltaMode === 1) {
            // DOM_DELTA_LINE	0x01	The delta values are specified in lines.
            delta *= 40;
        }
        const nextPosition = clampPosition(position + delta, metrics.endPos, metrics.lastChild, metrics.tabMargin);
        const hidden = getHiddenTabs(metrics.nodeRect, metrics.endPos, nextPosition);
        tabsTruncated.current = hidden.length > 0;
        firstRender.current = false;
        lastHiddenCount.current = hidden.length;
        setHiddenTabs(hidden);
        setPosition(nextPosition);
        userControlledLeft.current = true;
        event.stopPropagation();
    };

    return { selfRef, position, userControlledLeft, hiddenTabs, onMouseWheel, tabsTruncated: tabsTruncated.current };
};
