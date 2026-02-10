import { memo, ReactNode } from "react";
import { Rect } from "../Rect";

export interface ISizeTrackerProps {
    rect: Rect;
    selected: boolean;
    forceRevision: number;
    tabsRevision: number;
    children: ReactNode;
}
// only render if size changed or forceRevision changed or tabsRevision changed
export const SizeTracker = memo(
    ({ children }: ISizeTrackerProps) => {
        return <>{children}</>;
    },
    (prevProps, nextProps) => {
        return (
            prevProps.rect.equalSize(nextProps.rect) &&
            prevProps.selected === nextProps.selected &&
            prevProps.forceRevision === nextProps.forceRevision &&
            prevProps.tabsRevision === nextProps.tabsRevision
        );
    },
);

SizeTracker.displayName = "SizeTracker";
