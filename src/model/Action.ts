import { IJsonTabNode, IGlobalAttributes, ITabAttributes, ITabSetAttributes, IRowAttributes, IBorderAttributes } from "./IJsonModel";

/** Action type constants */
export const ActionType = {
    ADD_NODE: "FlexLayout_AddNode",
    MOVE_NODE: "FlexLayout_MoveNode",
    DELETE_TAB: "FlexLayout_DeleteTab",
    DELETE_TABSET: "FlexLayout_DeleteTabset",
    RENAME_TAB: "FlexLayout_RenameTab",
    SELECT_TAB: "FlexLayout_SelectTab",
    SET_ACTIVE_TABSET: "FlexLayout_SetActiveTabset",
    ADJUST_WEIGHTS: "FlexLayout_AdjustWeights",
    ADJUST_BORDER_SPLIT: "FlexLayout_AdjustBorderSplit",
    MAXIMIZE_TOGGLE: "FlexLayout_MaximizeToggle",
    UPDATE_MODEL_ATTRIBUTES: "FlexLayout_UpdateModelAttributes",
    UPDATE_NODE_ATTRIBUTES: "FlexLayout_UpdateNodeAttributes",
} as const;

export type ActionTypeValue = (typeof ActionType)[keyof typeof ActionType];

/** Data types for each action */
export interface AddNodeData {
    json: IJsonTabNode;
    toNode: string;
    location: string;
    index: number;
    select?: boolean;
}

export interface MoveNodeData {
    fromNode: string;
    toNode: string;
    location: string;
    index: number;
    select?: boolean;
}

export interface DeleteTabData {
    node: string;
}

export interface DeleteTabsetData {
    node: string;
}

export interface RenameTabData {
    node: string;
    text: string;
}

export interface SelectTabData {
    tabNode: string;
    windowId?: string;
}

export interface SetActiveTabsetData {
    tabsetNode: string | undefined;
    windowId?: string;
}

export interface AdjustWeightsData {
    nodeId: string;
    weights: number[];
}

export interface AdjustBorderSplitData {
    node: string;
    pos: number;
}

export interface MaximizeToggleData {
    node: string;
    windowId?: string;
}

/** Union type for node attributes that can be updated */
export type NodeAttributes = Partial<ITabAttributes> | Partial<ITabSetAttributes> | Partial<IRowAttributes> | Partial<IBorderAttributes>;

export interface UpdateModelAttributesData {
    json: Partial<IGlobalAttributes>;
}

export interface UpdateNodeAttributesData {
    node: string;
    json: NodeAttributes;
}

/** Map from action type to its data type */
export interface ActionDataMap {
    [ActionType.ADD_NODE]: AddNodeData;
    [ActionType.MOVE_NODE]: MoveNodeData;
    [ActionType.DELETE_TAB]: DeleteTabData;
    [ActionType.DELETE_TABSET]: DeleteTabsetData;
    [ActionType.RENAME_TAB]: RenameTabData;
    [ActionType.SELECT_TAB]: SelectTabData;
    [ActionType.SET_ACTIVE_TABSET]: SetActiveTabsetData;
    [ActionType.ADJUST_WEIGHTS]: AdjustWeightsData;
    [ActionType.ADJUST_BORDER_SPLIT]: AdjustBorderSplitData;
    [ActionType.MAXIMIZE_TOGGLE]: MaximizeToggleData;
    [ActionType.UPDATE_MODEL_ATTRIBUTES]: UpdateModelAttributesData;
    [ActionType.UPDATE_NODE_ATTRIBUTES]: UpdateNodeAttributesData;
}

/** Discriminated union of all Action types */
export type Action =
    | { type: typeof ActionType.ADD_NODE; data: AddNodeData }
    | { type: typeof ActionType.MOVE_NODE; data: MoveNodeData }
    | { type: typeof ActionType.DELETE_TAB; data: DeleteTabData }
    | { type: typeof ActionType.DELETE_TABSET; data: DeleteTabsetData }
    | { type: typeof ActionType.RENAME_TAB; data: RenameTabData }
    | { type: typeof ActionType.SELECT_TAB; data: SelectTabData }
    | { type: typeof ActionType.SET_ACTIVE_TABSET; data: SetActiveTabsetData }
    | { type: typeof ActionType.ADJUST_WEIGHTS; data: AdjustWeightsData }
    | { type: typeof ActionType.ADJUST_BORDER_SPLIT; data: AdjustBorderSplitData }
    | { type: typeof ActionType.MAXIMIZE_TOGGLE; data: MaximizeToggleData }
    | { type: typeof ActionType.UPDATE_MODEL_ATTRIBUTES; data: UpdateModelAttributesData }
    | { type: typeof ActionType.UPDATE_NODE_ATTRIBUTES; data: UpdateNodeAttributesData };

/** Factory function for creating typed actions */
export function createAction<T extends ActionTypeValue>(type: T, data: ActionDataMap[T]): Action {
    return { type, data } as Action;
}
