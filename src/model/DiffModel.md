# DiffModel Implementation Tasks

## Core Functionality
- [x] Basic tab addition/deletion/movement
- [x] Tab name changes
- [x] Tab config changes 
- [x] TabSet selected changes
- [x] TabSet maximized changes
- [x] TabSet active changes

## Additional Node Types
- [x] Support BorderNode changes
- [x] Support RowNode changes
- [ ] Support window/popout changes

## Node Attributes
- [x] Track and diff all TabNode attributes
- [x] Track and diff all TabSetNode attributes 
- [x] Track and diff all BorderNode attributes
- [x] Track and diff all RowNode attributes

## Actions to Support
- [x] ADD_NODE
- [x] MOVE_NODE  
- [x] DELETE_TAB
- [x] DELETE_TABSET
- [x] RENAME_TAB
- [x] SELECT_TAB
- [x] SET_ACTIVE_TABSET
- [x] ADJUST_WEIGHTS
- [x] ADJUST_BORDER_SPLIT
- [x] MAXIMIZE_TOGGLE
- [x] UPDATE_MODEL_ATTRIBUTES
- [x] UPDATE_NODE_ATTRIBUTES
- [ ] POPOUT_TAB
- [ ] POPOUT_TABSET
- [ ] CLOSE_WINDOW
- [ ] CREATE_WINDOW

## Testing
- [x] Test basic node types
- [x] Test basic attributes
- [x] Test core actions
- [ ] Test edge cases
- [ ] Test complex model changes
- [ ] Test window/popout scenarios

## Optimization
- [x] Minimize number of actions generated
- [x] Handle reordering efficiently
- [x] Smart attribute diffing
- [x] Batch similar changes

## Documentation
- [x] Document core operations
- [ ] Document limitations
- [ ] Add examples
- [ ] Add performance considerations

## Remaining Tasks
1. Implement window/popout support
   - Handle POPOUT_TAB action
   - Handle POPOUT_TABSET action
   - Handle CLOSE_WINDOW action
   - Handle CREATE_WINDOW action

2. Add comprehensive testing
   - Edge cases for all node types
   - Complex nested layouts
   - Window/popout scenarios
   - Border interaction cases

3. Complete documentation
   - Add limitations section
   - Add usage examples
   - Document performance considerations
   - Add troubleshooting guide
