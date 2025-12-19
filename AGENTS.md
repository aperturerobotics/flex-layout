## IMPORTANT

Fix anything that you come across in the project while working that violates any of these guidelines as you encounter it.

**CRITICAL: When asked to update AGENTS.md:**

- ALWAYS read the ENTIRE file first before making edits
- Check for duplicate information across sections
- Condense and consolidate duplicates into a single authoritative section
- Ensure guidelines are clear and non-contradictory

Remember to always delete dead code when changing things - for example if you changed something and a component is no longer used anywhere, delete that component.

If we are using a .md file for notes or analysis or todos prefer using that over the todos tool for tracking work.

Avoid using sub-agents unless absolutely necessary.

### General Rules

- Try to keep things in one function unless composable or reusable
- It's okay to temporarily have build errors / lsp errors / warnings while editing a file (clean them by at the end of your work)
- Keep the codebase as a clean component library
- DO NOT do unnecessary destructuring of variables
- DO NOT use `else` statements unless necessary
- DO NOT use `try`/`catch` if it can be avoided
- DO NOT make git commits
- DO NOT modify `bldr.yaml` (ignore any changes in this file) aside from `rev` unless asked
- DO NOT assume the size in pixels of utilities like h-4 and h-16 these are dependent on var(--spacing)
- DO NOT use className string interpolation (use `cn()` from `@web/style/utils.js` instead)
- DO NOT use emojis or obvious comments
- DO NOT use polling, always wait properly, like using a channel receive in go
- DO NOT add obvious comments like "(not persisted)" or "(ephemeral UI state)"
- DO NOT disable linter warnings unless absolutely necessary - if you need to disable a linter warning, it usually means you are doing something wrong and should rethink your approach
- AVOID using `any` type
- AVOID `let` statements
- AVOID `as` statements (pretty much never use them)
- AVOID using refs to store mutable state that affects rendering - use proper React state instead
- AVOID gradients in css as these have inconsistent rendering between browser engines
- PREFER single word variable names where possible
- PREFER to merge multiple `useState` together into one if applicable (or even use a reducer if prudent)
- PREFER `cn()` for conditional className composition
- PREFER using useCallback or useMemo to memoize and keep good React performance
- PREFER function declarations over arrow function expressions for React components (e.g., `export function MyComponent()` over `export const MyComponent = () =>`)
- PREFER optional chaining for callback invocations (e.g., `onRowClick?.(index, item, e)` over `if (onRowClick) { onRowClick(index, item, e) }`)
- ALWAYS investigate all existing implementation details before making changes
- ALWAYS limit your searches or dir listings to the relevant project subdir(s) ./{project}/...
- ALWAYS import useMemo, useCallback, etc, instead of using React.useMemo, React.useCallback, etc.
- NOTE that generated files like _.pb_ are ignored from ripgrep (rg)
- NOTE that ripgrep does not have a built-in `tsx` type; use `-g "*.tsx"` instead of `--type tsx`

## Component Structure

### Component File Structure

Follow React conventions for component organization:

- **One exported component per file** - Each file should export a single main component
- **PascalCase filenames** - Use `MyComponent.tsx` style naming (matches the component name)
- **Co-locate tests** - Test files live next to their components as `ComponentName.test.tsx`
- **Co-locate related code** - Keep types, helpers, and sub-components in the same file unless they're reusable elsewhere
- **Types in component files** - For component-related types (props, interfaces), use `component.ts` instead of `types.ts` (e.g., `object.ts` instead of `types.ts` for object-related types)

## Styling

### Flexbox Scroll Containers

Virtualized or scrollable regions only gain scrollbars when their parent is constrained by flex layout:

- Wrap scroll areas in a `flex flex-col` container with `flex-1` **and** `min-h-0` to let the child size to the viewport.
- Keep the scroll container itself `overflow-hidden` and let the virtualized list own its `overflow-y-auto` style.
- Do **not** rely on padding wrappers or absolute positioning around `react-window`; constrain height via flex so content can exceed the container and trigger scrolling.

## Imports

When importing from TypeScript (`.ts`) or JavaScript (`.js`) files:

- ALWAYS use the `.js` suffix in the import path
- This applies even when importing from `.ts` files
- Group imports in the following order with blank lines between groups:
  1. React and external libraries
  2. Internal modules (using blank line separator for routing, hooks, state, SDK, etc.)
  3. Local/relative imports

Example:

```tsx
// Correct - grouped and organized
import { useMemo, useCallback } from 'react'
import { joinPath } from '@aptre/bldr'
import { DebugInfo, useWatchStateRpc } from '@aptre/bldr-react'

import { useNavigate, useParams, useRouter } from '@web/router/router.js'
import { SharedObjectContext } from '@web/hooks/contexts.js'
import { atomWithLocalStorage, StateNamespaceProvider } from '@web/state'
import { Space } from '@s4wave/sdk/space/space.js'
import { SpaceState, WatchStateRequest } from '@s4wave/sdk/space/space.pb.js'

import { SpaceProvider } from './SpaceContext.js'

// Incorrect - no grouping or organization
import { SpaceContainer } from '@web/space/SpaceContainer'
import { SPACE_BODY_TYPE } from '@web/space/space'
```

## Modern React Patterns

### useEffectEvent

React 19.2 introduces `useEffectEvent` to separate non-reactive logic from effects.

**Problem it solves:**

- Avoid stale closures (functions remembering old prop/state values)
- Prevent unnecessary effect re-runs when non-critical dependencies change
- Read latest props/state in callbacks without adding to dependency arrays

**When to use:**

- Callbacks inside effects that need latest props but shouldn't trigger re-runs
- Event handlers passed to subscriptions/listeners
- Replacing `useRef` + `.current` patterns for accessing latest values
- Use ONLY for non-reactive logic that doesn't depend on changing values

**Example:**

```tsx
function ChatRoom({ roomId, userPreferences }) {
  const onMessage = useEffectEvent((msg) => {
    if (userPreferences.sound) {
      // Always sees latest
      playSound('ding.mp3')
    }
  })

  useEffect(() => {
    const connection = connectToRoom(roomId)
    connection.on('message', onMessage)
    return () => connection.disconnect()
  }, [roomId]) // Only re-runs when roomId changes
}
```

**Reactive values as arguments:**

```tsx
function Page({ url }) {
  const { items } = useContext(ShoppingCartContext)
  const numberOfItems = items.length

  const onNavigate = useEffectEvent((visitedUrl) => {
    logVisit(visitedUrl, numberOfItems)
  })

  useEffect(() => {
    onNavigate(url)
  }, [url]) // Effect re-runs on url change, but not numberOfItems
}
```

Pass reactive values like `url` as arguments to keep them reactive while accessing latest non-reactive values like `numberOfItems` inside the event.

**Important restrictions:**

- ONLY call Effect Events inside Effects (useEffect, useLayoutEffect, useInsertionEffect)
- DO NOT pass them to other components or hooks
- DO NOT use to avoid specifying dependencies (use explicit dependencies or refs instead)
- DO NOT include in dependency arrays

### When NOT to Use Effects

#### Core Principle

Effects are an **escape hatch** from React. Use them only to synchronize with **external systems** (network, DOM APIs, third-party libraries). If there's no external system, you don't need an Effect.

#### Common Cases Where You DON'T Need Effects

### 1. Transforming Data for Rendering

**❌ Don't do this:**

```tsx
const [fullName, setFullName] = useState('')
useEffect(() => {
  setFullName(firstName + ' ' + lastName)
}, [firstName, lastName])
```

**✅ Do this instead:**

```tsx
const fullName = firstName + ' ' + lastName
```

### 2. Caching Expensive Calculations

**❌ Don't do this:**

```tsx
const [visibleTodos, setVisibleTodos] = useState([])
useEffect(() => {
  setVisibleTodos(getFilteredTodos(todos, filter))
}, [todos, filter])
```

**✅ Do this instead:**

```tsx
const visibleTodos = useMemo(
  () => getFilteredTodos(todos, filter),
  [todos, filter],
)
```

### 3. Resetting State on Prop Change

**❌ Don't do this:**

```tsx
useEffect(() => {
  setComment('')
}, [userId])
```

**✅ Do this instead:**

```tsx
<Profile userId={userId} key={userId} />
```

### 4. Adjusting State on Prop Change

**❌ Don't do this:**

```tsx
useEffect(() => {
  setSelection(null)
}, [items])
```

**✅ Do this instead (calculate during render):**

```tsx
const selection = items.find((item) => item.id === selectedId) ?? null
```

### 5. Handling User Events

**❌ Don't do this:**

```tsx
useEffect(() => {
  if (product.isInCart) {
    showNotification(`Added ${product.name}`)
  }
}, [product])
```

**✅ Do this instead:**

```tsx
function handleBuyClick() {
  addToCart(product)
  showNotification(`Added ${product.name}`)
}
```

### 6. Notifying Parent Components

**❌ Don't do this:**

```tsx
useEffect(() => {
  onChange(isOn)
}, [isOn, onChange])
```

**✅ Do this instead:**

```tsx
function handleClick() {
  setIsOn(!isOn)
  onChange(!isOn)
}
```

### 7. Chains of Computations

**❌ Don't do this:**

```tsx
useEffect(() => {
  if (card?.gold) setGoldCardCount((c) => c + 1)
}, [card])

useEffect(() => {
  if (goldCardCount > 3) setRound((r) => r + 1)
}, [goldCardCount])
```

**✅ Do this instead:**

```tsx
function handlePlaceCard(nextCard) {
  setCard(nextCard)
  if (nextCard.gold) {
    if (goldCardCount <= 3) {
      setGoldCardCount(goldCardCount + 1)
    } else {
      setRound(round + 1)
    }
  }
}
```

#### When You DO Need Effects

### 1. Synchronizing with External Systems

```tsx
useEffect(() => {
  const connection = createConnection()
  connection.connect()
  return () => connection.disconnect()
}, [])
```

### 2. Fetching Data (with cleanup for race conditions)

```tsx
useEffect(() => {
  let ignore = false
  fetchData().then((data) => {
    if (!ignore) setData(data)
  })
  return () => {
    ignore = true
  }
}, [query])
```

### 3. Analytics/Logging (runs because component displayed)

```tsx
useEffect(() => {
  logPageView('/home')
}, [])
```

### 4. Subscribing to External Stores

```tsx
useEffect(() => {
  const unsubscribe = externalStore.subscribe(handleChange)
  return () => unsubscribe()
}, [])
```

#### Quick Decision Guide

Ask yourself: **Why does this code need to run?**

- **Because the user clicked a button** → Event handler useEffectEvent
- **Because a prop/state changed and I need to update other state** → Calculate during render or use a key
- **Because the component was displayed to the user** → Effect
- **Because I need to sync with something outside React** → Effect

