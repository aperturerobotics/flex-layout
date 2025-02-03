import * as React from "react";
import { Rect } from "../Rect";

export interface ISizeTrackerProps {
    rect: Rect;
    selected: boolean;
    children: React.ReactNode;
}
// only render if size changed
export const SizeTracker = React.memo(
    ({ children }: ISizeTrackerProps) => {
        return <>{children}</>;
    },
    (prevProps, nextProps) => {
        return prevProps.rect.equalSize(nextProps.rect) && prevProps.selected === nextProps.selected;
    },
);
