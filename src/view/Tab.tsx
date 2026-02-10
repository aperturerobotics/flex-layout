import * as React from "react";
import { TabNode } from "../model/TabNode";
import { TabSetNode } from "../model/TabSetNode";
import { CLASSES } from "../Types";
import { LayoutInternal } from "./Layout";
import { BorderNode } from "../model/BorderNode";
import { Actions } from "../model/Actions";

/** @internal */
export interface ITabProps {
    layout: LayoutInternal;
    node: TabNode;
    selected: boolean;
    path: string;
}

/** @internal */
export const Tab = (props: ITabProps) => {
    const { layout, selected, node, path } = props;
    const selfRef = React.useRef<HTMLDivElement | null>(null);
    const firstSelect = React.useRef<boolean>(true);

    const parentNode = node.getParent() as TabSetNode | BorderNode;
    const rect = parentNode.getContentRect();

    React.useLayoutEffect(() => {
        const element = node.getMoveableElement()!;
        selfRef.current!.appendChild(element);
        node.setMoveableElement(element);

        const handleScroll = () => {
            node.saveScrollPosition();
        };

        // keep scroll position
        element.addEventListener("scroll", handleScroll);

        // listen for clicks to change active tabset
        selfRef.current!.addEventListener("pointerdown", onPointerDown);

        return () => {
            element.removeEventListener("scroll", handleScroll);
            if (selfRef.current) {
                selfRef.current.removeEventListener("pointerdown", onPointerDown);
            }
            node.setVisible(false);
        };
    }, []);

    React.useEffect(() => {
        if (node.isSelected()) {
            if (firstSelect.current) {
                node.restoreScrollPosition();
                firstSelect.current = false;
            }
        }
    }, [selected]);

    React.useLayoutEffect(() => {
        node.setRect(rect);
    }, [rect, node]);

    React.useLayoutEffect(() => {
        node.setVisible(selected);
    }, [selected, node]);

    const onPointerDown = () => {
        const parent = node.getParent()!; // cannot use parentNode here since will be out of date
        if (parent instanceof TabSetNode) {
            if (!parent.isActive()) {
                layout.doAction(Actions.setActiveTabset(parent.getId(), layout.getWindowId()));
            }
        }
    };

    const cm = layout.getClassName;
    const style: Record<string, string | number> = {};

    rect.styleWithPosition(style);

    if (!selected) {
        style.display = "none";
    }

    if (parentNode instanceof TabSetNode) {
        if (node.getModel().getMaximizedTabset(layout.getWindowId()) !== undefined) {
            if (parentNode.isMaximized()) {
                style.zIndex = 10;
            } else {
                style.display = "none";
            }
        }
    }

    let className = cm(CLASSES.FLEXLAYOUT__TAB);
    if (parentNode instanceof BorderNode) {
        className += " " + cm(CLASSES.FLEXLAYOUT__TAB_BORDER);
        className += " " + cm(CLASSES.FLEXLAYOUT__TAB_BORDER_ + parentNode.getLocation().getName());
    }

    if (node.getContentClassName() !== undefined) {
        className += " " + node.getContentClassName();
    }

    return <div ref={selfRef} style={style} className={className} data-layout-path={path} />;
};
