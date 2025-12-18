// Unit test setup for vitest with happy-dom
// Provides mocks for browser APIs not available in happy-dom

import '@testing-library/jest-dom/vitest'
import React from 'react'
import { createRoot, Root } from 'react-dom/client'
import { flushSync } from 'react-dom'

// Mock ResizeObserver if not available
if (typeof globalThis.ResizeObserver === 'undefined') {
    class ResizeObserverMock {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
    globalThis.ResizeObserver = ResizeObserverMock as unknown as typeof ResizeObserver
}

/**
 * Custom render helper that uses flushSync instead of act().
 *
 * The Layout component has effects that run on every render without dependencies,
 * which causes React's act() to hang waiting for React to "settle". Using flushSync
 * bypasses this issue while still ensuring synchronous rendering.
 */
export function renderSync(element: React.ReactElement): {
    container: HTMLElement
    root: Root
    unmount: () => void
} {
    const container = document.createElement('div')
    document.body.appendChild(container)
    const root = createRoot(container)
    flushSync(() => {
        root.render(element)
    })
    return {
        container,
        root,
        unmount: () => {
            root.unmount()
            document.body.removeChild(container)
        },
    }
}
