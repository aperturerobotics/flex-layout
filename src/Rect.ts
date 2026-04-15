import { IJsonRect } from "./model/IJsonModel";
import { Orientation } from "./Orientation";

export class Rect {
    static empty() {
        return new Rect(0, 0, 0, 0);
    }

    static fromJson(json: IJsonRect): Rect {
        return new Rect(json.x, json.y, json.width, json.height);
    }

    x: number;
    y: number;
    width: number;
    height: number;

    constructor(x: number, y: number, width: number, height: number) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
    }

    toJson() {
        return { x: this.x, y: this.y, width: this.width, height: this.height };
    }

    snap(round: number) {
        this.x = Math.round(this.x / round) * round;
        this.y = Math.round(this.y / round) * round;
        this.width = Math.round(this.width / round) * round;
        this.height = Math.round(this.height / round) * round;
    }

    static getBoundingClientRect(element: Element) {
        const { x, y, width, height } = element.getBoundingClientRect();
        return new Rect(x, y, width, height);
    }

    static getRelativeOffsetRect(element: HTMLElement, relativeTo: HTMLElement) {
        let x = relativeTo.clientLeft - relativeTo.scrollLeft;
        let y = relativeTo.clientTop - relativeTo.scrollTop;
        let current: HTMLElement | null = element;

        while (current && current !== relativeTo) {
            x += current.offsetLeft;
            y += current.offsetTop;

            const offsetParent: Element | null = current.offsetParent;
            if (offsetParent instanceof HTMLElement) {
                if (offsetParent !== relativeTo) {
                    x += offsetParent.clientLeft;
                    y += offsetParent.clientTop;
                }
                x -= offsetParent.scrollLeft;
                y -= offsetParent.scrollTop;
            }

            current = offsetParent instanceof HTMLElement ? offsetParent : null;
        }

        if (current !== relativeTo) {
            return Rect.getBoundingClientRect(element).relativeTo(relativeTo.getBoundingClientRect());
        }

        return new Rect(x, y, element.offsetWidth, element.offsetHeight);
    }

    static getContentRect(element: HTMLElement) {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);

        const paddingLeft = parseFloat(style.paddingLeft);
        const paddingRight = parseFloat(style.paddingRight);
        const paddingTop = parseFloat(style.paddingTop);
        const paddingBottom = parseFloat(style.paddingBottom);
        const borderLeftWidth = parseFloat(style.borderLeftWidth);
        const borderRightWidth = parseFloat(style.borderRightWidth);
        const borderTopWidth = parseFloat(style.borderTopWidth);
        const borderBottomWidth = parseFloat(style.borderBottomWidth);

        const contentWidth = rect.width - borderLeftWidth - paddingLeft - paddingRight - borderRightWidth;
        const contentHeight = rect.height - borderTopWidth - paddingTop - paddingBottom - borderBottomWidth;

        return new Rect(rect.left + borderLeftWidth + paddingLeft, rect.top + borderTopWidth + paddingTop, contentWidth, contentHeight);
    }

    static getRelativeContentRect(element: HTMLElement, relativeTo: HTMLElement) {
        const rect = Rect.getRelativeOffsetRect(element, relativeTo);
        const style = window.getComputedStyle(element);

        const paddingLeft = parseFloat(style.paddingLeft);
        const paddingRight = parseFloat(style.paddingRight);
        const paddingTop = parseFloat(style.paddingTop);
        const paddingBottom = parseFloat(style.paddingBottom);

        const contentWidth = Math.max(0, element.clientWidth - paddingLeft - paddingRight);
        const contentHeight = Math.max(0, element.clientHeight - paddingTop - paddingBottom);

        return new Rect(
            rect.x + element.clientLeft + paddingLeft,
            rect.y + element.clientTop + paddingTop,
            contentWidth,
            contentHeight,
        );
    }

    static fromDomRect(domRect: DOMRect) {
        return new Rect(domRect.x, domRect.y, domRect.width, domRect.height);
    }

    relativeTo(r: Rect | DOMRect) {
        return new Rect(this.x - r.x, this.y - r.y, this.width, this.height);
    }

    clone() {
        return new Rect(this.x, this.y, this.width, this.height);
    }

    equals(rect: Rect | null | undefined) {
        return this.x === rect?.x && this.y === rect?.y && this.width === rect?.width && this.height === rect?.height;
    }

    equalSize(rect: Rect | null | undefined) {
        return this.width === rect?.width && this.height === rect?.height;
    }

    getBottom() {
        return this.y + this.height;
    }

    getRight() {
        return this.x + this.width;
    }

    getCenter() {
        return { x: this.x + this.width / 2, y: this.y + this.height / 2 };
    }

    positionElement(element: HTMLElement, position?: string) {
        this.styleWithPosition(element.style, position);
    }

    styleWithPosition(style: CSSStyleDeclaration | Record<string, string | number>, position: string = "absolute") {
        style.left = this.x + "px";
        style.top = this.y + "px";
        style.width = Math.max(0, this.width) + "px"; // need Math.max to prevent -ve, cause error in IE
        style.height = Math.max(0, this.height) + "px";
        style.position = position;
        return style;
    }

    contains(x: number, y: number) {
        if (this.x <= x && x <= this.getRight() && this.y <= y && y <= this.getBottom()) {
            return true;
        } else {
            return false;
        }
    }

    removeInsets(insets: { top: number; left: number; bottom: number; right: number }) {
        return new Rect(this.x + insets.left, this.y + insets.top, Math.max(0, this.width - insets.left - insets.right), Math.max(0, this.height - insets.top - insets.bottom));
    }

    centerInRect(outerRect: Rect) {
        this.x = (outerRect.width - this.width) / 2;
        this.y = (outerRect.height - this.height) / 2;
    }

    /** @internal */
    _getSize(orientation: Orientation) {
        let prefSize = this.width;
        if (orientation === Orientation.VERT) {
            prefSize = this.height;
        }
        return prefSize;
    }

    toString() {
        return "(Rect: x=" + this.x + ", y=" + this.y + ", width=" + this.width + ", height=" + this.height + ")";
    }
}
