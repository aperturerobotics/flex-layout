import * as React from "react";
import { createPortal } from "react-dom";
import { createRoot } from "react-dom/client";
import { DockLocation } from "../DockLocation";
import { DropInfo } from "../DropInfo";
import { I18nLabel } from "../I18nLabel";
import { Orientation } from "../Orientation";
import { Rect } from "../Rect";
import { CLASSES } from "../Types";
import { Action } from "../model/Action";
import { Actions } from "../model/Actions";
import { BorderNode } from "../model/BorderNode";
import { IDraggable } from "../model/IDraggable";
import { IJsonTabNode } from "../model/IJsonModel";
import { Model } from "../model/Model";
import { Node } from "../model/Node";
import { TabNode } from "../model/TabNode";
import { TabSetNode } from "../model/TabSetNode";
import { BorderTab } from "./BorderTab";
import { BorderTabSet } from "./BorderTabSet";
import { DragContainer } from "./DragContainer";
import { ErrorBoundary } from "./ErrorBoundary";
import { AsterickIcon, CloseIcon, EdgeIcon, MaximizeIcon, OverflowIcon, RestoreIcon } from "./Icons";
import { Overlay } from "./Overlay";
import { Row } from "./Row";
import { Tab } from "./Tab";
import { enablePointerOnIFrames, isSafari } from "./Utils";
import { TabButtonStamp } from "./TabButtonStamp";
import { SizeTracker } from "./SizeTracker";

export interface ILayoutProps {
    /** the model for this layout */
    model: Model;
    /** factory function for creating the tab components */
    factory: (node: TabNode) => React.ReactNode;
    /** object mapping keys among close, maximize, restore, more to React nodes to use in place of the default icons, can alternatively return functions for creating the React nodes */
    icons?: IIcons;
    /** function called whenever the layout generates an action to update the model (allows for intercepting actions before they are dispatched to the model, for example, asking the user to confirm a tab close.) Returning undefined from the function will halt the action, otherwise return the action to continue */
    onAction?: (action: Action) => Action | undefined;
    /** function called when rendering a tab, allows leading (icon), content section, buttons and name used in overflow menu to be customized */
    onRenderTab?: (
        node: TabNode,
        renderValues: ITabRenderValues, // change the values in this object as required
    ) => void;
    /** function called when rendering a tabset, allows header and buttons to be customized */
    onRenderTabSet?: (
        tabSetNode: TabSetNode | BorderNode,
        renderValues: ITabSetRenderValues, // change the values in this object as required
    ) => void;
    /** function called when model has changed */
    onModelChange?: (model: Model, action: Action) => void;
    /** function called when an external object (not a tab) gets dragged onto the layout, with a single dragenter argument. Should return either undefined to reject the drag/drop or an object with keys dragText, jsonDrop, to create a tab via drag (similar to a call to addTabToTabSet). Function onDropis passed the added tabNodeand thedrop DragEvent`, unless the drag was canceled. */
    onExternalDrag?: (event: React.DragEvent<HTMLElement>) =>
        | undefined
        | {
              json: IJsonTabNode;
              onDrop?: (node?: Node, event?: React.DragEvent<HTMLElement>) => void;
          };
    /** function called with default css class name, return value is class name that will be used. Mainly for use with css modules. */
    classNameMapper?: (defaultClassName: string) => string;
    /** function called for each I18nLabel to allow user translation, currently used for tab and tabset move messages, return undefined to use default values */
    i18nMapper?: (id: I18nLabel, param?: string) => string | undefined;
    /** boolean value, defaults to false, resize tabs as splitters are dragged. Warning: this can cause resizing to become choppy when tabs are slow to draw */
    realtimeResize?: boolean | undefined;
    /** callback for rendering the drag rectangles */
    onRenderDragRect?: DragRectRenderCallback;
    /** callback for handling context actions on tabs and tabsets */
    onContextMenu?: NodeMouseEvent;
    /** callback for handling mouse clicks on tabs and tabsets with alt, meta, shift keys, also handles center mouse clicks */
    onAuxMouseClick?: NodeMouseEvent;
    /** callback for handling the display of the tab overflow menu */
    onShowOverflowMenu?: ShowOverflowMenuCallback;
    /** callback for rendering a placeholder when a tabset is empty */
    onTabSetPlaceHolder?: TabSetPlaceHolderCallback;
    /** callback for when drag state changes, useful for OptimizedLayout to set pointer-events: none on external tab container during drag */
    onDragStateChange?: (isDragging: boolean) => void;
}

/**
 * A React component that hosts a multi-tabbed layout
 */
export class Layout extends React.Component<ILayoutProps> {
    /** @internal */
    private selfRef: React.RefObject<LayoutInternal | null>;
    /** @internal */
    private revision: number; // so LayoutInternal knows this is a parent render (used for optimization)

    /** @internal */
    constructor(props: ILayoutProps) {
        super(props);
        this.selfRef = React.createRef<LayoutInternal>();
        this.revision = 0;
    }

    /** re-render the layout */
    redraw() {
        this.selfRef.current!.redraw("parent " + this.revision);
    }

    /**
     * Adds a new tab to the given tabset
     * @param tabsetId the id of the tabset where the new tab will be added
     * @param json the json for the new tab node
     * @returns the added tab node or undefined
     */
    addTabToTabSet(tabsetId: string, json: IJsonTabNode): TabNode | undefined {
        return this.selfRef.current!.addTabToTabSet(tabsetId, json);
    }

    /**
     * Adds a new tab by dragging an item to the drop location, must be called from within an HTML
     * drag start handler. You can use the setDragComponent() method to set the drag image before calling this
     * method.
     * @param event the drag start event
     * @param json the json for the new tab node
     * @param onDrop a callback to call when the drag is complete
     */
    addTabWithDragAndDrop(event: DragEvent, json: IJsonTabNode, onDrop?: (node?: Node, event?: React.DragEvent<HTMLElement>) => void) {
        this.selfRef.current!.addTabWithDragAndDrop(event, json, onDrop);
    }

    /**
     * Move a tab/tabset using drag and drop, must be called from within an HTML
     * drag start handler
     * @param event the drag start event
     * @param node the tab or tabset to drag
     */
    moveTabWithDragAndDrop(event: DragEvent, node: TabNode | TabSetNode) {
        this.selfRef.current!.moveTabWithDragAndDrop(event, node);
    }

    /**
     * Adds a new tab to the active tabset (if there is one)
     * @param json the json for the new tab node
     * @returns the added tab node or undefined
     */
    addTabToActiveTabSet(json: IJsonTabNode): TabNode | undefined {
        return this.selfRef.current!.addTabToActiveTabSet(json);
    }

    /**
     * Sets the drag image from a react component for a drag event
     * @param event the drag event
     * @param component the react component to be used for the drag image
     * @param x the x position of the drag cursor on the image
     * @param y the x position of the drag cursor on the image
     */
    setDragComponent(event: DragEvent, component: React.ReactNode, x: number, y: number) {
        this.selfRef.current!.setDragComponent(event, component, x, y);
    }

    /** Get the root div element of the layout */
    getRootDiv() {
        return this.selfRef.current!.getRootDiv();
    }

    /** @internal */
    render() {
        return <LayoutInternal ref={this.selfRef} {...this.props} renderRevision={this.revision++} />;
    }
}

/** @internal */
interface ILayoutInternalProps extends ILayoutProps {
    renderRevision: number;
}

/** @internal */
interface ILayoutInternalState {
    rect: Rect;
    editingTab?: TabNode;
    portal?: React.ReactPortal;
    showEdges: boolean;
    showOverlay: boolean;
    calculatedBorderBarSize: number;
    layoutRevision: number;
    forceRevision: number;
    showHiddenBorder: DockLocation;
}

/** @internal */
export class LayoutInternal extends React.Component<ILayoutInternalProps, ILayoutInternalState> {
    public static dragState: DragState | undefined = undefined;

    private selfRef: React.RefObject<HTMLDivElement | null>;
    private moveablesRef: React.RefObject<HTMLDivElement | null>;
    private findBorderBarSizeRef: React.RefObject<HTMLDivElement | null>;
    private mainRef: React.RefObject<HTMLDivElement | null>;
    private previousModel?: Model;
    private orderedIds: string[];
    private moveableElementMap = new Map<string, HTMLElement>();
    private dropInfo: DropInfo | undefined;
    private outlineDiv?: HTMLElement;
    private currentDocument?: Document;
    private icons: IIcons;
    private resizeObserver?: ResizeObserver;

    private dragEnterCount: number = 0;
    private dragging: boolean = false;
    // private renderCount: any;

    constructor(props: ILayoutInternalProps) {
        super(props);

        this.orderedIds = [];
        this.selfRef = React.createRef<HTMLDivElement>();
        this.moveablesRef = React.createRef<HTMLDivElement>();
        this.mainRef = React.createRef<HTMLDivElement>();
        this.findBorderBarSizeRef = React.createRef<HTMLDivElement>();

        this.icons = { ...defaultIcons, ...props.icons };
        // this.renderCount = 0;

        this.state = {
            rect: Rect.empty(),
            editingTab: undefined,
            showEdges: false,
            showOverlay: false,
            calculatedBorderBarSize: 29,
            layoutRevision: 0,
            forceRevision: 0,
            showHiddenBorder: DockLocation.CENTER,
        };
    }

    componentDidMount() {
        this.updateRect();

        this.currentDocument = (this.selfRef.current as HTMLElement).ownerDocument;

        this.props.model.layout = this;

        this.resizeObserver = new ResizeObserver((_entries) => {
            requestAnimationFrame(() => {
                this.updateRect();
            });
        });
        if (this.selfRef.current) {
            this.resizeObserver.observe(this.selfRef.current);
        }

        this.props.model.addChangeListener(this.onModelChange);
        this.updateLayoutMetrics();

        // allow tabs to overlay when hidden
        document.addEventListener("visibilitychange", () => {
            this.redraw("visibility change");
        });
    }

    componentDidUpdate() {
        this.currentDocument = (this.selfRef.current as HTMLElement).ownerDocument;

        if (this.props.model !== this.previousModel) {
            if (this.previousModel !== undefined) {
                this.previousModel.removeChangeListener(this.onModelChange); // stop listening to old model
            }
            this.props.model.layout = this;
            this.props.model.addChangeListener(this.onModelChange);
            this.previousModel = this.props.model;
            this.tidyMoveablesMap();
        }

        this.updateLayoutMetrics();
    }

    componentWillUnmount() {
        if (this.selfRef.current) {
            this.resizeObserver?.unobserve(this.selfRef.current);
        }
    }

    render() {
        // first render will be used to find the size (via selfRef)
        if (!this.selfRef.current) {
            return (
                <div ref={this.selfRef} className={this.getClassName(CLASSES.FLEXLAYOUT__LAYOUT)}>
                    <div ref={this.moveablesRef} key="__moveables__" className={this.getClassName(CLASSES.FLEXLAYOUT__LAYOUT_MOVEABLES)}></div>
                    {this.renderMetricsElements()}
                </div>
            );
        }

        const model = this.props.model;
        model.getRoot().calcMinMaxSize();
        model.getRoot().setPaths("");
        model.getBorderSet().setPaths();

        const inner = this.renderLayout();
        const outer = this.renderBorders(inner);

        const tabs = this.renderTabs();
        const reorderedTabs = this.reorderComponents(tabs, this.orderedIds);

        const metricElements = this.renderMetricsElements();
        const tabMoveables = this.renderTabMoveables();
        const tabStamps = (
            <div key="__tabStamps__" className={this.getClassName(CLASSES.FLEXLAYOUT__LAYOUT_TAB_STAMPS)}>
                {this.renderTabStamps()}
            </div>
        );

        return (
            <div
                ref={this.selfRef}
                className={this.getClassName(CLASSES.FLEXLAYOUT__LAYOUT)}
                onDragEnter={this.onDragEnterRaw}
                onDragLeave={this.onDragLeaveRaw}
                onDragOver={this.onDragOver}
                onDrop={this.onDrop}
            >
                <div ref={this.moveablesRef} key="__moveables__" className={this.getClassName(CLASSES.FLEXLAYOUT__LAYOUT_MOVEABLES)}></div>
                {metricElements}
                <Overlay key="__overlay__" layout={this} show={this.state.showOverlay} />
                {outer}
                {reorderedTabs}
                {tabMoveables}
                {tabStamps}
                {this.state.portal}
            </div>
        );
    }

    renderBorders(inner: React.ReactNode) {
        const classMain = this.getClassName(CLASSES.FLEXLAYOUT__LAYOUT_MAIN);
        const borders = this.props.model.getBorderSet().getBorderMap();
        if (borders.size > 0) {
            inner = (
                <div className={classMain} ref={this.mainRef}>
                    {inner}
                </div>
            );
            const borderSetComponents = new Map<DockLocation, React.ReactNode>();
            const borderSetContentComponents = new Map<DockLocation, React.ReactNode>();
            for (const [_, location] of DockLocation.values) {
                const border = borders.get(location);
                const showBorder = border && (!border.isAutoHide() || (border.isAutoHide() && (border.getChildren().length > 0 || this.state.showHiddenBorder === location)));
                if (showBorder) {
                    borderSetComponents.set(location, <BorderTabSet layout={this} border={border} size={this.state.calculatedBorderBarSize} />);
                    borderSetContentComponents.set(location, <BorderTab layout={this} border={border} show={border.getSelected() !== -1} />);
                }
            }

            const classBorderOuter = this.getClassName(CLASSES.FLEXLAYOUT__LAYOUT_BORDER_CONTAINER);
            const classBorderInner = this.getClassName(CLASSES.FLEXLAYOUT__LAYOUT_BORDER_CONTAINER_INNER);

            if (this.props.model.getBorderSet().getLayoutHorizontal()) {
                const innerWithBorderTabs = (
                    <div className={classBorderInner} style={{ flexDirection: "column" }}>
                        {borderSetContentComponents.get(DockLocation.TOP)}
                        <div className={classBorderInner} style={{ flexDirection: "row" }}>
                            {borderSetContentComponents.get(DockLocation.LEFT)}
                            {inner}
                            {borderSetContentComponents.get(DockLocation.RIGHT)}
                        </div>
                        {borderSetContentComponents.get(DockLocation.BOTTOM)}
                    </div>
                );
                return (
                    <div className={classBorderOuter} style={{ flexDirection: "column" }}>
                        {borderSetComponents.get(DockLocation.TOP)}
                        <div className={classBorderInner} style={{ flexDirection: "row" }}>
                            {borderSetComponents.get(DockLocation.LEFT)}
                            {innerWithBorderTabs}
                            {borderSetComponents.get(DockLocation.RIGHT)}
                        </div>
                        {borderSetComponents.get(DockLocation.BOTTOM)}
                    </div>
                );
            }
            const innerWithBorderTabs = (
                <div className={classBorderInner} style={{ flexDirection: "row" }}>
                    {borderSetContentComponents.get(DockLocation.LEFT)}
                    <div className={classBorderInner} style={{ flexDirection: "column" }}>
                        {borderSetContentComponents.get(DockLocation.TOP)}
                        {inner}
                        {borderSetContentComponents.get(DockLocation.BOTTOM)}
                    </div>
                    {borderSetContentComponents.get(DockLocation.RIGHT)}
                </div>
            );

            return (
                <div className={classBorderOuter} style={{ flexDirection: "row" }}>
                    {borderSetComponents.get(DockLocation.LEFT)}
                    <div className={classBorderInner} style={{ flexDirection: "column" }}>
                        {borderSetComponents.get(DockLocation.TOP)}
                        {innerWithBorderTabs}
                        {borderSetComponents.get(DockLocation.BOTTOM)}
                    </div>
                    {borderSetComponents.get(DockLocation.RIGHT)}
                </div>
            );
        }
        // no borders
        return (
            <div className={classMain} ref={this.mainRef} style={{ position: "absolute", top: 0, left: 0, bottom: 0, right: 0, display: "flex" }}>
                {inner}
            </div>
        );
    }

    renderLayout() {
        return (
            <>
                <Row key="__row__" layout={this} node={this.props.model.getRoot()} />
                {this.renderEdgeIndicators()}
            </>
        );
    }

    renderEdgeIndicators() {
        const edges: React.ReactNode[] = [];
        const arrowIcon = this.icons.edgeArrow;
        if (this.state.showEdges) {
            const r = this.props.model.getRoot().getRect();
            const length = edgeRectLength;
            const width = edgeRectWidth;
            const offset = edgeRectLength / 2;
            const className = this.getClassName(CLASSES.FLEXLAYOUT__EDGE_RECT);
            const radius = 50;
            edges.push(
                <div
                    key="North"
                    style={{ top: 0, left: r.width / 2 - offset, width: length, height: width, borderBottomLeftRadius: radius, borderBottomRightRadius: radius }}
                    className={className + " " + this.getClassName(CLASSES.FLEXLAYOUT__EDGE_RECT_TOP)}
                >
                    <div style={{ transform: "rotate(180deg)" }}>{arrowIcon}</div>
                </div>,
            );
            edges.push(
                <div
                    key="West"
                    style={{ top: r.height / 2 - offset, left: 0, width: width, height: length, borderTopRightRadius: radius, borderBottomRightRadius: radius }}
                    className={className + " " + this.getClassName(CLASSES.FLEXLAYOUT__EDGE_RECT_LEFT)}
                >
                    <div style={{ transform: "rotate(90deg)" }}>{arrowIcon}</div>
                </div>,
            );
            edges.push(
                <div
                    key="South"
                    style={{ top: r.height - width, left: r.width / 2 - offset, width: length, height: width, borderTopLeftRadius: radius, borderTopRightRadius: radius }}
                    className={className + " " + this.getClassName(CLASSES.FLEXLAYOUT__EDGE_RECT_BOTTOM)}
                >
                    <div>{arrowIcon}</div>
                </div>,
            );
            edges.push(
                <div
                    key="East"
                    style={{ top: r.height / 2 - offset, left: r.width - width, width: width, height: length, borderTopLeftRadius: radius, borderBottomLeftRadius: radius }}
                    className={className + " " + this.getClassName(CLASSES.FLEXLAYOUT__EDGE_RECT_RIGHT)}
                >
                    <div style={{ transform: "rotate(-90deg)" }}>{arrowIcon}</div>
                </div>,
            );
        }

        return edges;
    }

    renderTabMoveables() {
        const tabMoveables: React.ReactNode[] = [];

        this.props.model.visitNodes((node) => {
            if (node instanceof TabNode) {
                const child = node;
                const element = this.getMoveableElement(child.getId());
                child.setMoveableElement(element);
                const selected = child.isSelected();
                const rect = (child.getParent() as BorderNode | TabSetNode).getContentRect();

                // only render first time if size >0
                const renderTab = child.isRendered() || ((selected || !child.isEnableRenderOnDemand()) && rect.width > 0 && rect.height > 0);

                if (renderTab) {
                    const key = child.getId();
                    tabMoveables.push(
                        createPortal(
                            <SizeTracker rect={rect} selected={child.isSelected()} forceRevision={this.state.forceRevision} tabsRevision={this.props.renderRevision} key={key}>
                                <ErrorBoundary message={this.i18nName(I18nLabel.Error_rendering_component)}>{this.props.factory(child)}</ErrorBoundary>
                            </SizeTracker>,
                            element,
                            key,
                        ),
                    );

                    child.setRendered(renderTab);
                }
            }
        });

        return tabMoveables;
    }

    renderTabStamps() {
        const tabStamps: React.ReactNode[] = [];

        this.props.model.visitNodes((node) => {
            if (node instanceof TabNode) {
                const child = node;

                // what the tab should look like when dragged (since images need to have been loaded before drag image can be taken)
                tabStamps.push(<DragContainer key={child.getId()} layout={this} node={child} />);
            }
        });

        return tabStamps;
    }

    renderTabs() {
        const tabs = new Map<string, React.ReactNode>();
        this.props.model.visitNodes((node) => {
            if (node instanceof TabNode) {
                const child = node;
                const selected = child.isSelected();
                const path = child.getPath();

                const renderTab = child.isRendered() || selected || !child.isEnableRenderOnDemand();

                if (renderTab) {
                    tabs.set(child.getId(), <Tab key={child.getId()} layout={this} path={path} node={child} selected={selected} />);
                }
            }
        });
        return tabs;
    }

    renderMetricsElements() {
        return (
            <div key="findBorderBarSize" ref={this.findBorderBarSizeRef} className={this.getClassName(CLASSES.FLEXLAYOUT__BORDER_SIZER)}>
                FindBorderBarSize
            </div>
        );
    }

    checkForBorderToShow(x: number, y: number) {
        const r = this.getBoundingClientRect(this.mainRef.current!);
        const c = r.getCenter();
        const margin = edgeRectWidth;
        const offset = edgeRectLength / 2;

        let overEdge = false;
        if (this.props.model.isEnableEdgeDock() && this.state.showHiddenBorder === DockLocation.CENTER) {
            if ((y > c.y - offset && y < c.y + offset) || (x > c.x - offset && x < c.x + offset)) {
                overEdge = true;
            }
        }

        let location = DockLocation.CENTER;
        if (!overEdge) {
            if (x <= r.x + margin) {
                location = DockLocation.LEFT;
            } else if (x >= r.getRight() - margin) {
                location = DockLocation.RIGHT;
            } else if (y <= r.y + margin) {
                location = DockLocation.TOP;
            } else if (y >= r.getBottom() - margin) {
                location = DockLocation.BOTTOM;
            }
        }

        if (location !== this.state.showHiddenBorder) {
            this.setState({ showHiddenBorder: location });
        }
    }

    updateLayoutMetrics = () => {
        if (this.findBorderBarSizeRef.current) {
            const borderBarSize = this.findBorderBarSizeRef.current.getBoundingClientRect().height;
            if (borderBarSize !== this.state.calculatedBorderBarSize) {
                this.setState({ calculatedBorderBarSize: borderBarSize });
            }
        }
    };

    tidyMoveablesMap() {
        const tabs = new Map<string, TabNode>();
        this.props.model.visitNodes((node, _) => {
            if (node instanceof TabNode) {
                tabs.set(node.getId(), node);
            }
        });

        for (const [nodeId, element] of this.moveableElementMap) {
            if (!tabs.has(nodeId)) {
                element.remove(); // remove from dom
                this.moveableElementMap.delete(nodeId); // remove map entry
            }
        }
    }

    reorderComponents(components: Map<string, React.ReactNode>, ids: string[]) {
        const nextIds: string[] = [];
        const nextIdsSet = new Set<string>();

        // Keep any previous tabs in the same DOM order as before, removing any that have been deleted
        for (const id of ids) {
            if (components.get(id)) {
                nextIds.push(id);
                nextIdsSet.add(id);
            }
        }
        ids.splice(0, ids.length, ...nextIds);

        // Add tabs that have been added to the DOM
        for (const [id, _] of components) {
            if (!nextIdsSet.has(id)) {
                ids.push(id);
            }
        }

        const reordered = ids.map((id) => {
            return components.get(id);
        });

        return reordered;
    }

    onModelChange = (action: Action) => {
        this.redrawInternal("model change");
        if (this.props.onModelChange) {
            this.props.onModelChange(this.props.model, action);
        }
    };

    redraw(_type?: string) {
        this.setState((state, _props) => {
            return { forceRevision: state.forceRevision + 1 };
        });
    }

    redrawInternal(_type: string) {
        this.setState((state, _props) => {
            return { layoutRevision: state.layoutRevision + 1 };
        });
    }

    doAction(action: Action): Node | string | undefined {
        if (this.props.onAction !== undefined) {
            const outcome = this.props.onAction(action);
            if (outcome !== undefined) {
                return this.props.model.doAction(outcome);
            }
            return undefined;
        }
        return this.props.model.doAction(action);
    }

    updateRect = () => {
        const rect = this.getDomRect();
        if (!rect.equals(this.state.rect) && rect.width !== 0 && rect.height !== 0) {
            this.setState({ rect });
        }
    };

    getBoundingClientRect(div: HTMLElement): Rect {
        const layoutRect = this.getDomRect();
        if (layoutRect) {
            return Rect.getBoundingClientRect(div).relativeTo(layoutRect);
        }
        return Rect.empty();
    }

    getMoveableContainer() {
        return this.moveablesRef.current;
    }

    getMoveableElement(id: string) {
        let moveableElement = this.moveableElementMap.get(id);
        if (moveableElement === undefined) {
            moveableElement = document.createElement("div");
            this.moveablesRef.current!.appendChild(moveableElement);
            moveableElement.className = CLASSES.FLEXLAYOUT__TAB_MOVEABLE;
            this.moveableElementMap.set(id, moveableElement);
        }
        return moveableElement;
    }

    getMainLayout() {
        return this;
    }

    getClassName = (defaultClassName: string) => {
        if (this.props.classNameMapper === undefined) {
            return defaultClassName;
        }
        return this.props.classNameMapper(defaultClassName);
    };

    getCurrentDocument() {
        return this.currentDocument;
    }

    getDomRect() {
        if (this.selfRef.current) {
            return Rect.fromDomRect(this.selfRef.current.getBoundingClientRect());
        }
        return Rect.empty();
    }

    getWindowId() {
        return Model.MAIN_WINDOW_ID;
    }

    getRootDiv() {
        return this.selfRef.current;
    }

    getMainElement() {
        return this.mainRef.current;
    }

    getFactory() {
        return this.props.factory;
    }

    isRealtimeResize() {
        return this.props.realtimeResize ?? false;
    }

    setEditingTab(tabNode?: TabNode) {
        this.setState({ editingTab: tabNode });
    }

    getEditingTab() {
        return this.state.editingTab;
    }

    getModel() {
        return this.props.model;
    }

    addTabToTabSet(tabsetId: string, json: IJsonTabNode): TabNode | undefined {
        const tabsetNode = this.props.model.getNodeById(tabsetId);
        if (tabsetNode !== undefined) {
            const node = this.doAction(Actions.addNode(json, tabsetId, DockLocation.CENTER, -1));
            return node as TabNode;
        }
        return undefined;
    }

    addTabToActiveTabSet(json: IJsonTabNode): TabNode | undefined {
        const tabsetNode = this.props.model.getActiveTabset();
        if (tabsetNode !== undefined) {
            const node = this.doAction(Actions.addNode(json, tabsetNode.getId(), DockLocation.CENTER, -1));
            return node as TabNode;
        }
        return undefined;
    }

    showControlInPortal = (control: React.ReactNode, element: HTMLElement) => {
        const portal = createPortal(control, element);
        this.setState({ portal });
    };

    hideControlInPortal = () => {
        this.setState({ portal: undefined });
    };

    getIcons = () => {
        return this.icons;
    };

    maximize(tabsetNode: TabSetNode) {
        this.doAction(Actions.maximizeToggle(tabsetNode.getId(), this.getWindowId()));
    }

    customizeTab(tabNode: TabNode, renderValues: ITabRenderValues) {
        if (this.props.onRenderTab) {
            this.props.onRenderTab(tabNode, renderValues);
        }
    }

    customizeTabSet(tabSetNode: TabSetNode | BorderNode, renderValues: ITabSetRenderValues) {
        if (this.props.onRenderTabSet) {
            this.props.onRenderTabSet(tabSetNode, renderValues);
        }
    }

    i18nName(id: I18nLabel, param?: string) {
        let message;
        if (this.props.i18nMapper) {
            message = this.props.i18nMapper(id, param);
        }
        if (message === undefined) {
            message = id + (param === undefined ? "" : param);
        }
        return message;
    }

    getShowOverflowMenu() {
        return this.props.onShowOverflowMenu;
    }

    getTabSetPlaceHolderCallback() {
        return this.props.onTabSetPlaceHolder;
    }

    showContextMenu(node: TabNode | TabSetNode | BorderNode, event: React.MouseEvent<HTMLElement, MouseEvent>) {
        if (this.props.onContextMenu) {
            this.props.onContextMenu(node, event);
        }
    }

    auxMouseClick(node: TabNode | TabSetNode | BorderNode, event: React.MouseEvent<HTMLElement, MouseEvent>) {
        if (this.props.onAuxMouseClick) {
            this.props.onAuxMouseClick(node, event);
        }
    }

    public showOverlay(show: boolean) {
        this.setState({ showOverlay: show });
        enablePointerOnIFrames(!show, this.currentDocument!);
    }

    // *************************** Start Drag Drop *************************************

    addTabWithDragAndDrop(_event: DragEvent, json: IJsonTabNode, onDrop?: (node?: Node, event?: React.DragEvent<HTMLElement>) => void) {
        const tempNode = TabNode.fromJson(json, this.props.model, false);
        LayoutInternal.dragState = new DragState(this, DragSource.Add, tempNode, json, onDrop);
    }

    moveTabWithDragAndDrop(event: DragEvent, node: TabNode | TabSetNode) {
        this.setDragNode(event, node);
    }

    public setDragNode = (event: DragEvent, node: Node & IDraggable) => {
        LayoutInternal.dragState = new DragState(this, DragSource.Internal, node, undefined, undefined);
        // Note: can only set (very) limited types on android! so cannot set json
        // Note: must set text/plain for android to allow drag,
        //  so just set a simple message indicating its a flexlayout drag (this is not used anywhere else)
        event.dataTransfer!.setData("text/plain", "--flexlayout--");
        event.dataTransfer!.effectAllowed = "copyMove";
        event.dataTransfer!.dropEffect = "move";

        this.dragEnterCount = 0;

        if (node instanceof TabSetNode) {
            let rendered = false;
            let content = this.i18nName(I18nLabel.Move_Tabset);
            if (node.getChildren().length > 0) {
                content = this.i18nName(I18nLabel.Move_Tabs).replace("?", String(node.getChildren().length));
            }
            if (this.props.onRenderDragRect) {
                const dragComponent = this.props.onRenderDragRect(content, node, undefined);
                if (dragComponent) {
                    this.setDragComponent(event, dragComponent, 10, 10);
                    rendered = true;
                }
            }
            if (!rendered) {
                this.setDragComponent(event, content, 10, 10);
            }
        } else {
            const element = event.target as HTMLElement;
            const rect = element.getBoundingClientRect();
            const offsetX = event.clientX - rect.left;
            const offsetY = event.clientY - rect.top;
            const parentNode = node?.getParent();
            const isInVerticalBorder = parentNode instanceof BorderNode && parentNode.getOrientation() === Orientation.HORZ;
            const x = isInVerticalBorder ? 10 : offsetX;
            const y = isInVerticalBorder ? 10 : offsetY;

            let rendered = false;
            if (this.props.onRenderDragRect) {
                const content = <TabButtonStamp key={node.getId()} layout={this} node={node as TabNode} />;
                const dragComponent = this.props.onRenderDragRect(content, node, undefined);
                if (dragComponent) {
                    this.setDragComponent(event, dragComponent, x, y);
                    rendered = true;
                }
            }
            if (!rendered) {
                if (isSafari()) {
                    // safari doesnt render the offscreen tabstamps
                    this.setDragComponent(event, <TabButtonStamp node={node as TabNode} layout={this} />, x, y);
                } else {
                    event.dataTransfer!.setDragImage((node as TabNode).getTabStamp()!, x, y);
                }
            }
        }
    };

    public setDragComponent(event: DragEvent, component: React.ReactNode, x: number, y: number) {
        const dragElement: React.ReactNode = (
            <div style={{ position: "unset" }} className={this.getClassName(CLASSES.FLEXLAYOUT__LAYOUT) + " " + this.getClassName(CLASSES.FLEXLAYOUT__DRAG_RECT)}>
                {component}
            </div>
        );

        const tempDiv = this.currentDocument!.createElement("div");
        tempDiv.setAttribute("data-layout-path", "/drag-rectangle");
        tempDiv.style.position = "absolute";
        tempDiv.style.left = "-10000px";
        tempDiv.style.top = "-10000px";
        this.currentDocument!.body.appendChild(tempDiv);
        createRoot(tempDiv).render(dragElement);

        event.dataTransfer!.setDragImage(tempDiv, x, y);
        setTimeout(() => {
            this.currentDocument!.body.removeChild(tempDiv);
        }, 0);
    }

    onDragEnterRaw = (event: React.DragEvent<HTMLElement>) => {
        this.dragEnterCount++;
        if (this.dragEnterCount === 1) {
            this.onDragEnter(event);
        }
    };

    onDragLeaveRaw = (event: React.DragEvent<HTMLElement>) => {
        this.dragEnterCount--;
        if (this.dragEnterCount === 0) {
            // Check if we're leaving to an element still inside this layout or its
            // sibling TabContainer (used by OptimizedLayout).
            // This handles nested FlexLayout instances and OptimizedLayout's architecture
            // where tab content is rendered as a sibling to the layout.
            const relatedTarget = event.relatedTarget as Element | null;
            if (relatedTarget) {
                // Check if inside this layout
                if (this.selfRef.current?.contains(relatedTarget)) {
                    this.dragEnterCount = 1;
                    return;
                }
                // Check if inside sibling TabContainer (OptimizedLayout architecture)
                // TabContainer is a sibling with data-layout-path="/tab-container"
                const tabContainer = relatedTarget.closest('[data-layout-path="/tab-container"]');
                if (tabContainer && this.selfRef.current?.parentElement?.contains(tabContainer)) {
                    this.dragEnterCount = 1;
                    return;
                }
            }
            this.onDragLeave(event);
        }
    };

    clearDragMain() {
        LayoutInternal.dragState = undefined;
        this.clearDragLocal();
    }

    clearDragLocal() {
        this.setState({ showEdges: false });
        this.showOverlay(false);
        this.dragEnterCount = 0;
        this.dragging = false;
        this.props.onDragStateChange?.(false);
        if (this.outlineDiv) {
            this.selfRef.current!.removeChild(this.outlineDiv);
            this.outlineDiv = undefined;
        }
    }

    onDragEnter = (event: React.DragEvent<HTMLElement>) => {
        if (!LayoutInternal.dragState && this.props.onExternalDrag) {
            // not internal dragging
            const externalDrag = this.props.onExternalDrag(event);
            if (externalDrag) {
                const tempNode = TabNode.fromJson(externalDrag.json, this.props.model, false);
                LayoutInternal.dragState = new DragState(this, DragSource.External, tempNode, externalDrag.json, externalDrag.onDrop);
            }
        }

        if (LayoutInternal.dragState) {
            if (LayoutInternal.dragState.mainLayout !== this) {
                return; // drag not by this layout
            }

            event.preventDefault();

            this.dropInfo = undefined;
            const rootdiv = this.selfRef.current;
            this.outlineDiv = this.currentDocument!.createElement("div");
            this.outlineDiv.className = this.getClassName(CLASSES.FLEXLAYOUT__OUTLINE_RECT);
            this.outlineDiv.style.visibility = "hidden";
            const speed = this.props.model.getAttribute("tabDragSpeed") as number;
            this.outlineDiv.style.transition = `top ${speed}s, left ${speed}s, width ${speed}s, height ${speed}s`;

            rootdiv!.appendChild(this.outlineDiv);

            this.dragging = true;
            this.showOverlay(true);
            this.props.onDragStateChange?.(true);
            // add edge indicators
            if (this.props.model.getMaximizedTabset() === undefined) {
                this.setState({ showEdges: this.props.model.isEnableEdgeDock() });
            }

            const clientRect = this.selfRef.current!.getBoundingClientRect();
            const r = new Rect(event.clientX - clientRect.left, event.clientY - clientRect.top, 1, 1);
            r.positionElement(this.outlineDiv);
        }
    };

    onDragOver = (event: React.DragEvent<HTMLElement>) => {
        if (this.dragging) {
            event.preventDefault();
            const clientRect = this.selfRef.current?.getBoundingClientRect();
            const pos = {
                x: event.clientX - (clientRect?.left ?? 0),
                y: event.clientY - (clientRect?.top ?? 0),
            };

            this.checkForBorderToShow(pos.x, pos.y);

            const dropInfo = this.props.model.findDropTargetNode(Model.MAIN_WINDOW_ID, LayoutInternal.dragState!.dragNode!, pos.x, pos.y);
            if (dropInfo) {
                this.dropInfo = dropInfo;
                if (this.outlineDiv) {
                    this.outlineDiv.className = this.getClassName(dropInfo.className);
                    dropInfo.rect.positionElement(this.outlineDiv);
                    this.outlineDiv.style.visibility = "visible";
                }
            }
        }
    };

    onDragLeave = (_event: React.DragEvent<HTMLElement>) => {
        if (this.dragging) {
            this.clearDragLocal();
        }
    };

    onDrop = (event: React.DragEvent<HTMLElement>) => {
        if (this.dragging) {
            event.preventDefault();

            const dragState = LayoutInternal.dragState!;
            if (this.dropInfo) {
                if (dragState.dragJson !== undefined) {
                    const newNode = this.doAction(Actions.addNode(dragState.dragJson, this.dropInfo.node.getId(), this.dropInfo.location, this.dropInfo.index)) as Node | undefined;

                    if (dragState.fnNewNodeDropped !== undefined) {
                        dragState.fnNewNodeDropped(newNode, event);
                    }
                } else if (dragState.dragNode !== undefined) {
                    this.doAction(Actions.moveNode(dragState.dragNode.getId(), this.dropInfo.node.getId(), this.dropInfo.location, this.dropInfo.index));
                }
            }

            this.clearDragMain();
        }
        this.dragEnterCount = 0; // must set to zero here ref sublayouts
    };

    // *************************** End Drag Drop *************************************
}

export const FlexLayoutVersion = "0.8.1";

export type DragRectRenderCallback = (content: React.ReactNode | undefined, node?: Node, json?: IJsonTabNode) => React.ReactNode | undefined;

export type NodeMouseEvent = (node: TabNode | TabSetNode | BorderNode, event: React.MouseEvent<HTMLElement, MouseEvent>) => void;

export type ShowOverflowMenuCallback = (
    node: TabSetNode | BorderNode,
    mouseEvent: React.MouseEvent<HTMLElement, MouseEvent>,
    items: { index: number; node: TabNode }[],
    onSelect: (item: { index: number; node: TabNode }) => void,
) => void;

export type TabSetPlaceHolderCallback = (node: TabSetNode) => React.ReactNode;

export interface ITabSetRenderValues {
    /** components that will be added after the tabs */
    stickyButtons: React.ReactNode[];
    /** components that will be added at the end of the tabset */
    buttons: React.ReactNode[];
    /** position to insert overflow button within [...stickyButtons, ...buttons]
     * if left undefined position will be after the sticky buttons (if any)
     */
    overflowPosition: number | undefined;
}

export interface ITabRenderValues {
    /** the icon or other leading component */
    leading: React.ReactNode;
    /** the main tab text/component */
    content: React.ReactNode;
    /** a set of react components to add to the tab after the content */
    buttons: React.ReactNode[];
}

export interface IIcons {
    close?: React.ReactNode | ((tabNode: TabNode) => React.ReactNode);
    closeTabset?: React.ReactNode | ((tabSetNode: TabSetNode) => React.ReactNode);
    maximize?: React.ReactNode | ((tabSetNode: TabSetNode) => React.ReactNode);
    restore?: React.ReactNode | ((tabSetNode: TabSetNode) => React.ReactNode);
    more?: React.ReactNode | ((tabSetNode: TabSetNode | BorderNode, hiddenTabs: { node: TabNode; index: number }[]) => React.ReactNode);
    edgeArrow?: React.ReactNode;
    activeTabset?: React.ReactNode | ((tabSetNode: TabSetNode) => React.ReactNode);
}

const defaultIcons = {
    close: <CloseIcon />,
    closeTabset: <CloseIcon />,
    maximize: <MaximizeIcon />,
    restore: <RestoreIcon />,
    more: <OverflowIcon />,
    edgeArrow: <EdgeIcon />,
    activeTabset: <AsterickIcon />,
};

enum DragSource {
    Internal = "internal",
    External = "external",
    Add = "add",
}

/** @internal */
const edgeRectLength = 100;
/** @internal */
const edgeRectWidth = 10;

// global layout drag state
class DragState {
    public readonly mainLayout: LayoutInternal;
    public readonly dragSource: DragSource;
    public readonly dragNode: (Node & IDraggable) | undefined;
    public readonly dragJson: IJsonTabNode | undefined;
    public readonly fnNewNodeDropped: ((node?: Node, event?: React.DragEvent<HTMLElement>) => void) | undefined;

    public constructor(
        mainLayout: LayoutInternal,
        dragSource: DragSource,
        dragNode: (Node & IDraggable) | undefined,
        dragJson: IJsonTabNode | undefined,
        fnNewNodeDropped: ((node?: Node, event?: React.DragEvent<HTMLElement>) => void) | undefined,
    ) {
        this.mainLayout = mainLayout;
        this.dragSource = dragSource;
        this.dragNode = dragNode;
        this.dragJson = dragJson;
        this.fnNewNodeDropped = fnNewNodeDropped;
    }
}
