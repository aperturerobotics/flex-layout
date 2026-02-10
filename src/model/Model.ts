import { Attribute, AttributeValue } from "../Attribute";
import { AttributeDefinitions, AttributeRecord, JsonInput } from "../AttributeDefinitions";
import { DockLocation } from "../DockLocation";
import { DropInfo } from "../DropInfo";
import { Action } from "./Action";
import { Actions } from "./Actions";
import { BorderNode } from "./BorderNode";
import { BorderSet } from "./BorderSet";
import { IDraggable } from "./IDraggable";
import { IDropTarget } from "./IDropTarget";
import { IJsonModel, ITabSetAttributes } from "./IJsonModel";
import { Node } from "./Node";
import { RowNode } from "./RowNode";
import { TabNode } from "./TabNode";
import { TabSetNode } from "./TabSetNode";
import { randomUUID } from "./Utils";
import { LayoutInternal } from "../view/Layout";

/** @internal */
export const DefaultMin = 0;
/** @internal */
export const DefaultMax = 99999;

/**
 * Class containing the Tree of Nodes used by the FlexLayout component
 */
export class Model {
    static MAIN_WINDOW_ID = "__main_window_id__";

    /** @internal */
    private static attributeDefinitions: AttributeDefinitions = Model.createAttributeDefinitions();

    /** @internal */
    private attributes: AttributeRecord;
    /** @internal */
    private idMap: Map<string, Node>;
    /** @internal */
    private changeListeners: ((action: Action) => void)[];
    /** @internal */
    private borders: BorderSet;
    /** @internal */
    private onAllowDrop?: (dragNode: Node, dropInfo: DropInfo) => boolean;
    /** @internal */
    private onCreateTabSet?: (tabNode?: TabNode) => ITabSetAttributes;
    /** @internal */
    private _root: RowNode | undefined;
    /** @internal */
    private _maximizedTabSet: TabSetNode | undefined;
    /** @internal */
    private _activeTabSet: TabSetNode | undefined;
    /** @internal */
    private _layout: LayoutInternal | undefined;

    /**
     * 'private' constructor. Use the static method Model.fromJson(json) to create a model
     *  @internal
     */
    protected constructor() {
        this.attributes = {};
        this.idMap = new Map();
        this.borders = new BorderSet(this);
        this.changeListeners = [];
    }

    /**
     * Update the node tree by performing the given action,
     * Actions should be generated via static methods on the Actions class
     * @param action the action to perform
     * @returns added Node for Actions.addNode
     */
    doAction(action: Action): Node | string | undefined {
        let returnVal = undefined;
        switch (action.type) {
            case Actions.ADD_NODE: {
                const newNode = new TabNode(this, action.data.json, true);
                const toNode = this.idMap.get(action.data.toNode) as Node & IDraggable;
                if (toNode instanceof TabSetNode || toNode instanceof BorderNode || toNode instanceof RowNode) {
                    toNode.drop(newNode, DockLocation.getByName(action.data.location), action.data.index, action.data.select);
                    returnVal = newNode;
                }
                break;
            }
            case Actions.MOVE_NODE: {
                const fromNode = this.idMap.get(action.data.fromNode) as Node & IDraggable;

                if (fromNode instanceof TabNode || fromNode instanceof TabSetNode || fromNode instanceof RowNode) {
                    if (fromNode === this.getMaximizedTabset()) {
                        this._maximizedTabSet = undefined;
                    }
                    const toNode = this.idMap.get(action.data.toNode) as Node & IDropTarget;
                    if (toNode instanceof TabSetNode || toNode instanceof BorderNode || toNode instanceof RowNode) {
                        toNode.drop(fromNode, DockLocation.getByName(action.data.location), action.data.index, action.data.select);
                    }
                }
                break;
            }
            case Actions.DELETE_TAB: {
                const node = this.idMap.get(action.data.node);
                if (node instanceof TabNode) {
                    node.delete();
                }
                break;
            }
            case Actions.DELETE_TABSET: {
                const node = this.idMap.get(action.data.node);

                if (node instanceof TabSetNode) {
                    // first delete all child tabs that are closeable
                    const children = [...node.getChildren()];
                    for (let i = 0; i < children.length; i++) {
                        const child = children[i];
                        if ((child as TabNode).isEnableClose()) {
                            (child as TabNode).delete();
                        }
                    }

                    if (node.getChildren().length === 0) {
                        node.delete();
                    }
                    this.tidy();
                }
                break;
            }
            case Actions.RENAME_TAB: {
                const node = this.idMap.get(action.data.node);
                if (node instanceof TabNode) {
                    node.setName(action.data.text);
                }
                break;
            }
            case Actions.SELECT_TAB: {
                const tabNode = this.idMap.get(action.data.tabNode);
                if (tabNode instanceof TabNode) {
                    const parent = tabNode.getParent() as Node;
                    const pos = parent.getChildren().indexOf(tabNode);

                    if (parent instanceof BorderNode) {
                        if (parent.getSelected() === pos) {
                            parent.setSelected(-1);
                        } else {
                            parent.setSelected(pos);
                        }
                    } else if (parent instanceof TabSetNode) {
                        if (parent.getSelected() !== pos) {
                            parent.setSelected(pos);
                        }
                        this._activeTabSet = parent;
                    }
                }
                break;
            }
            case Actions.SET_ACTIVE_TABSET: {
                if (action.data.tabsetNode === undefined) {
                    this._activeTabSet = undefined;
                } else {
                    const tabsetNode = this.idMap.get(action.data.tabsetNode);
                    if (tabsetNode instanceof TabSetNode) {
                        this._activeTabSet = tabsetNode;
                    }
                }
                break;
            }
            case Actions.ADJUST_WEIGHTS: {
                const row = this.idMap.get(action.data.nodeId) as RowNode;
                const c = row.getChildren();
                for (let i = 0; i < c.length; i++) {
                    const n = c[i] as TabSetNode | RowNode;
                    n.setWeight(action.data.weights[i]);
                }
                break;
            }
            case Actions.ADJUST_BORDER_SPLIT: {
                const node = this.idMap.get(action.data.node);
                if (node instanceof BorderNode) {
                    node.setSize(action.data.pos);
                }
                break;
            }
            case Actions.MAXIMIZE_TOGGLE: {
                const node = this.idMap.get(action.data.node);
                if (node instanceof TabSetNode) {
                    if (node === this._maximizedTabSet) {
                        this._maximizedTabSet = undefined;
                    } else {
                        this._maximizedTabSet = node;
                        this._activeTabSet = node;
                    }
                }

                break;
            }
            case Actions.UPDATE_MODEL_ATTRIBUTES: {
                this.updateAttrs(action.data.json);
                break;
            }

            case Actions.UPDATE_NODE_ATTRIBUTES: {
                const node = this.idMap.get(action.data.node)!;
                node.updateAttrs(action.data.json);
                break;
            }
            default:
                break;
        }

        this.updateIdMap();

        for (const listener of this.changeListeners) {
            listener(action);
        }

        return returnVal;
    }

    /**
     * Get the currently active tabset node
     */
    getActiveTabset(_windowId?: string) {
        if (this._activeTabSet && this.getNodeById(this._activeTabSet.getId())) {
            return this._activeTabSet;
        }
        return undefined;
    }

    /**
     * Get the currently maximized tabset node
     */
    getMaximizedTabset(_windowId?: string) {
        return this._maximizedTabSet;
    }

    /**
     * Gets the root RowNode of the model
     * @returns {RowNode}
     */
    getRoot(_windowId?: string) {
        return this._root!;
    }

    isRootOrientationVertical() {
        return this.attributes.rootOrientationVertical as boolean;
    }

    isEnableRotateBorderIcons() {
        return this.attributes.enableRotateBorderIcons as boolean;
    }

    /**
     * Gets the
     * @returns {BorderSet|*}
     */
    getBorderSet() {
        return this.borders;
    }

    /** @internal */
    get layout(): LayoutInternal | undefined {
        return this._layout;
    }

    /** @internal */
    set layout(value: LayoutInternal | undefined) {
        this._layout = value;
    }

    /**
     * Visits all the nodes in the model and calls the given function for each
     * @param fn a function that takes visited node and a integer level as parameters
     */
    visitNodes(fn: (node: Node, level: number) => void) {
        this.borders.forEachNode(fn);
        this._root!.forEachNode(fn, 0);
    }

    /**
     * Gets a node by its id
     * @param id the id to find
     */
    getNodeById(id: string): Node | undefined {
        return this.idMap.get(id);
    }

    /**
     * Finds the first/top left tab set of the given node.
     * @param node The top node you want to begin searching from, deafults to the root node
     * @returns The first Tab Set
     */
    getFirstTabSet(node = this._root as Node): TabSetNode {
        const child = node.getChildren()[0];
        if (child instanceof TabSetNode) {
            return child;
        }
        return this.getFirstTabSet(child);
    }

    /**
     * Loads the model from the given json object
     * @param json the json model to load
     * @returns {Model} a new Model object
     */
    static fromJson(json: IJsonModel) {
        const model = new Model();
        Model.attributeDefinitions.fromJson((json.global ?? {}) as JsonInput, model.attributes);

        if (json.borders) {
            model.borders = BorderSet.fromJson(json.borders, model);
        }

        model._root = RowNode.fromJson(json.layout, model);
        model.tidy(); // initial tidy of node tree
        return model;
    }

    /**
     * Converts the model to a json object
     * @returns {IJsonModel} json object that represents this model
     */
    toJson(): IJsonModel {
        const global: Record<string, unknown> = {};
        Model.attributeDefinitions.toJson(global as AttributeRecord, this.attributes);

        // save state of nodes
        this.visitNodes((node) => {
            node.fireEvent("save", {});
        });

        return {
            global,
            borders: this.borders.toJson(),
            layout: this._root!.toJson(),
        };
    }

    getSplitterSize() {
        return this.attributes.splitterSize as number;
    }

    getSplitterExtra() {
        return this.attributes.splitterExtra as number;
    }

    isEnableEdgeDock() {
        return this.attributes.enableEdgeDock as boolean;
    }

    isSplitterEnableHandle() {
        return this.attributes.splitterEnableHandle as boolean;
    }

    /**
     * Sets a function to allow/deny dropping a node
     * @param onAllowDrop function that takes the drag node and DropInfo and returns true if the drop is allowed
     */
    setOnAllowDrop(onAllowDrop: (dragNode: Node, dropInfo: DropInfo) => boolean) {
        this.onAllowDrop = onAllowDrop;
    }

    /**
     * set callback called when a new TabSet is created.
     * The tabNode can be undefined if it's the auto created first tabset in the root row (when the last
     * tab is deleted, the root tabset can be recreated)
     * @param onCreateTabSet
     */
    setOnCreateTabSet(onCreateTabSet: (tabNode?: TabNode) => ITabSetAttributes) {
        this.onCreateTabSet = onCreateTabSet;
    }

    addChangeListener(listener: (action: Action) => void) {
        this.changeListeners.push(listener);
    }

    removeChangeListener(listener: (action: Action) => void) {
        const pos = this.changeListeners.findIndex((l) => l === listener);
        if (pos !== -1) {
            this.changeListeners.splice(pos, 1);
        }
    }

    toString() {
        return JSON.stringify(this.toJson());
    }

    /***********************internal ********************************/

    /** @internal */
    setActiveTabset(tabsetNode: TabSetNode | undefined) {
        this._activeTabSet = tabsetNode;
    }

    /** @internal */
    setMaximizedTabset(tabsetNode: TabSetNode | undefined) {
        this._maximizedTabSet = tabsetNode;
    }

    /** @internal */
    updateIdMap() {
        // regenerate idMap to stop it building up
        this.idMap.clear();
        this.visitNodes((node) => {
            this.idMap.set(node.getId(), node);
        });
    }

    /** @internal */
    addNode(node: Node) {
        const id = node.getId();
        if (this.idMap.has(id)) {
            throw new Error(`Error: each node must have a unique id, duplicate id:${node.getId()}`);
        }

        this.idMap.set(id, node);
    }

    /** @internal */
    findDropTargetNode(_windowId: string, dragNode: Node & IDraggable, x: number, y: number) {
        const node = (this._root as RowNode).findDropTargetNode(_windowId, dragNode, x, y) ?? this.borders.findDropTargetNode(dragNode, x, y);
        return node;
    }

    /** @internal */
    tidy() {
        this._root!.tidy();
    }

    /** @internal */
    updateAttrs(json: JsonInput) {
        Model.attributeDefinitions.update(json, this.attributes);
    }

    /** @internal */
    nextUniqueId() {
        return "#" + randomUUID();
    }

    /** @internal */
    getAttribute(name: string): AttributeValue {
        return this.attributes[name];
    }

    /** @internal */
    getOnAllowDrop() {
        return this.onAllowDrop;
    }

    /** @internal */
    getOnCreateTabSet() {
        return this.onCreateTabSet;
    }

    static toTypescriptInterfaces() {
        Model.attributeDefinitions.pairAttributes("RowNode", RowNode.getAttributeDefinitions());
        Model.attributeDefinitions.pairAttributes("TabSetNode", TabSetNode.getAttributeDefinitions());
        Model.attributeDefinitions.pairAttributes("TabNode", TabNode.getAttributeDefinitions());
        Model.attributeDefinitions.pairAttributes("BorderNode", BorderNode.getAttributeDefinitions());

        const sb = [];
        sb.push(Model.attributeDefinitions.toTypescriptInterface("Global", undefined));
        sb.push(RowNode.getAttributeDefinitions().toTypescriptInterface("Row", Model.attributeDefinitions));
        sb.push(TabSetNode.getAttributeDefinitions().toTypescriptInterface("TabSet", Model.attributeDefinitions));
        sb.push(TabNode.getAttributeDefinitions().toTypescriptInterface("Tab", Model.attributeDefinitions));
        sb.push(BorderNode.getAttributeDefinitions().toTypescriptInterface("Border", Model.attributeDefinitions));
        console.log(sb.join("\n"));
    }

    /** @internal */
    private static createAttributeDefinitions(): AttributeDefinitions {
        const attributeDefinitions = new AttributeDefinitions();

        attributeDefinitions.add("enableEdgeDock", true).setType(Attribute.BOOLEAN).setDescription(`enable docking to the edges of the layout, this will show the edge indicators`);
        attributeDefinitions
            .add("rootOrientationVertical", false)
            .setType(Attribute.BOOLEAN)
            .setDescription(`the top level 'row' will layout horizontally by default, set this option true to make it layout vertically`);
        attributeDefinitions
            .add("enableRotateBorderIcons", true)
            .setType(Attribute.BOOLEAN)
            .setDescription(`boolean indicating if tab icons should rotate with the text in the left and right borders`);

        // splitter
        attributeDefinitions.add("splitterSize", 8).setType(Attribute.NUMBER).setDescription(`width in pixels of all splitters between tabsets/borders`);
        attributeDefinitions.add("splitterExtra", 0).setType(Attribute.NUMBER).setDescription(`additional width in pixels of the splitter hit test area`);
        attributeDefinitions.add("splitterEnableHandle", false).setType(Attribute.BOOLEAN).setDescription(`enable a small centralized handle on all splitters`);

        // tab
        attributeDefinitions.add("tabEnableClose", true).setType(Attribute.BOOLEAN);
        attributeDefinitions.add("tabCloseType", 1).setType("ICloseType");
        attributeDefinitions.add("tabEnableDrag", true).setType(Attribute.BOOLEAN);
        attributeDefinitions.add("tabEnableRename", true).setType(Attribute.BOOLEAN);
        attributeDefinitions.add("tabContentClassName", undefined).setType(Attribute.STRING);
        attributeDefinitions.add("tabClassName", undefined).setType(Attribute.STRING);
        attributeDefinitions.add("tabIcon", undefined).setType(Attribute.STRING);
        attributeDefinitions.add("tabEnableRenderOnDemand", true).setType(Attribute.BOOLEAN);
        attributeDefinitions.add("tabDragSpeed", 0.3).setType(Attribute.NUMBER);
        attributeDefinitions.add("tabBorderWidth", -1).setType(Attribute.NUMBER);
        attributeDefinitions.add("tabBorderHeight", -1).setType(Attribute.NUMBER);

        // tabset
        attributeDefinitions.add("tabSetEnableDeleteWhenEmpty", true).setType(Attribute.BOOLEAN);
        attributeDefinitions.add("tabSetEnableDrop", true).setType(Attribute.BOOLEAN);
        attributeDefinitions.add("tabSetEnableDrag", true).setType(Attribute.BOOLEAN);
        attributeDefinitions.add("tabSetEnableDivide", true).setType(Attribute.BOOLEAN);
        attributeDefinitions.add("tabSetEnableMaximize", true).setType(Attribute.BOOLEAN);
        attributeDefinitions.add("tabSetEnableClose", false).setType(Attribute.BOOLEAN);
        attributeDefinitions.add("tabSetEnableSingleTabStretch", false).setType(Attribute.BOOLEAN);
        attributeDefinitions.add("tabSetAutoSelectTab", true).setType(Attribute.BOOLEAN);
        attributeDefinitions.add("tabSetEnableActiveIcon", false).setType(Attribute.BOOLEAN);
        attributeDefinitions.add("tabSetClassNameTabStrip", undefined).setType(Attribute.STRING);
        attributeDefinitions.add("tabSetEnableTabStrip", true).setType(Attribute.BOOLEAN);
        attributeDefinitions.add("tabSetEnableTabWrap", false).setType(Attribute.BOOLEAN);
        attributeDefinitions.add("tabSetTabLocation", "top").setType("ITabLocation");
        attributeDefinitions.add("tabMinWidth", DefaultMin).setType(Attribute.NUMBER);
        attributeDefinitions.add("tabMinHeight", DefaultMin).setType(Attribute.NUMBER);
        attributeDefinitions.add("tabSetMinWidth", DefaultMin).setType(Attribute.NUMBER);
        attributeDefinitions.add("tabSetMinHeight", DefaultMin).setType(Attribute.NUMBER);
        attributeDefinitions.add("tabMaxWidth", DefaultMax).setType(Attribute.NUMBER);
        attributeDefinitions.add("tabMaxHeight", DefaultMax).setType(Attribute.NUMBER);
        attributeDefinitions.add("tabSetMaxWidth", DefaultMax).setType(Attribute.NUMBER);
        attributeDefinitions.add("tabSetMaxHeight", DefaultMax).setType(Attribute.NUMBER);

        // border
        attributeDefinitions.add("borderSize", 200).setType(Attribute.NUMBER);
        attributeDefinitions.add("borderMinSize", DefaultMin).setType(Attribute.NUMBER);
        attributeDefinitions.add("borderMaxSize", DefaultMax).setType(Attribute.NUMBER);
        attributeDefinitions.add("borderEnableDrop", true).setType(Attribute.BOOLEAN);
        attributeDefinitions.add("borderAutoSelectTabWhenOpen", true).setType(Attribute.BOOLEAN);
        attributeDefinitions.add("borderAutoSelectTabWhenClosed", false).setType(Attribute.BOOLEAN);
        attributeDefinitions.add("borderClassName", undefined).setType(Attribute.STRING);
        attributeDefinitions.add("borderEnableAutoHide", false).setType(Attribute.BOOLEAN);

        return attributeDefinitions;
    }
}
