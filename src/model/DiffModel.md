# DiffModel Implementation Tasks

## Core Functionality
- [x] Basic tab addition/deletion/movement
- [x] Tab name changes
- [x] Tab config changes 
- [x] TabSet selected changes
- [x] TabSet maximized changes
- [x] TabSet active changes

## Additional Node Types
- [ ] Support BorderNode changes
- [ ] Support RowNode changes
- [ ] Support window/popout changes

## Node Attributes
- [ ] Track and diff all TabNode attributes
- [ ] Track and diff all TabSetNode attributes 
- [ ] Track and diff all BorderNode attributes
- [ ] Track and diff all RowNode attributes

## Actions to Support
- [ ] ADD_NODE
- [ ] MOVE_NODE  
- [ ] DELETE_TAB
- [ ] DELETE_TABSET
- [ ] RENAME_TAB
- [ ] SELECT_TAB
- [ ] SET_ACTIVE_TABSET
- [ ] ADJUST_WEIGHTS
- [ ] ADJUST_BORDER_SPLIT
- [ ] MAXIMIZE_TOGGLE
- [ ] UPDATE_MODEL_ATTRIBUTES
- [ ] UPDATE_NODE_ATTRIBUTES
- [ ] POPOUT_TAB
- [ ] POPOUT_TABSET
- [ ] CLOSE_WINDOW
- [ ] CREATE_WINDOW

## Testing
- [ ] Test all node types
- [ ] Test all attributes
- [ ] Test all actions
- [ ] Test edge cases
- [ ] Test complex model changes
- [ ] Test window/popout scenarios

## Optimization
- [ ] Minimize number of actions generated
- [ ] Handle reordering efficiently
- [ ] Smart attribute diffing
- [ ] Batch similar changes

## Documentation
- [ ] Document supported operations
- [ ] Document limitations
- [ ] Add examples
- [ ] Add performance considerations
