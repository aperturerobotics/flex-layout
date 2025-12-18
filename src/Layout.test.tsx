import React from 'react'
import { describe, it, expect, afterEach } from 'vitest'
import { Layout } from './view/Layout.js'
import { Model, TabNode, IJsonModel } from './index.js'
import { renderSync } from './test/unit-setup.js'

// Basic factory function for tab content
const factory = (node: TabNode) => {
    const component = node.getComponent()
    if (component === 'text') {
        return <div>Content for {node.getName()}</div>
    }
    return null
}

// Basic JSON model with one tabset and three tabs
const jsonModel: IJsonModel = {
    global: {},
    layout: {
        type: 'row',
        weight: 100,
        children: [
            {
                type: 'tabset',
                weight: 100,
                children: [
                    {
                        type: 'tab',
                        name: 'Tab 1',
                        component: 'text',
                    },
                    {
                        type: 'tab',
                        name: 'Tab 2',
                        component: 'text',
                    },
                    {
                        type: 'tab',
                        name: 'Tab 3',
                        component: 'text',
                    },
                ],
            },
        ],
    },
}

describe('Layout Component', () => {
    let unmount: (() => void) | undefined

    afterEach(() => {
        unmount?.()
        unmount = undefined
    })

    it('should render layout structure correctly', () => {
        // Create a model instance from the JSON
        const model = Model.fromJson(jsonModel)

        // Render the Layout component
        const result = renderSync(<Layout model={model} factory={factory} />)
        unmount = result.unmount
        const { container } = result

        // Check if the layout rendered
        expect(container.querySelector('.flexlayout__layout')).toBeTruthy()

        // Check if the tabset header is rendered
        expect(container.querySelector('.flexlayout__tabset')).toBeTruthy()

        // Check if the tab buttons are rendered
        const tabButtons = container.querySelectorAll('.flexlayout__tab_button')
        expect(tabButtons.length).toBe(3)

        // Check tab names
        expect(tabButtons[0].textContent).toContain('Tab 1')
        expect(tabButtons[1].textContent).toContain('Tab 2')
        expect(tabButtons[2].textContent).toContain('Tab 3')
    })

    it('should have the first tab selected by default', () => {
        const model = Model.fromJson(jsonModel)

        const result = renderSync(<Layout model={model} factory={factory} />)
        unmount = result.unmount
        const { container } = result

        // Check that the first tab button has the selected class
        const tabButtons = container.querySelectorAll('.flexlayout__tab_button')
        expect(tabButtons[0].classList.contains('flexlayout__tab_button--selected')).toBe(true)
        expect(tabButtons[1].classList.contains('flexlayout__tab_button--selected')).toBe(false)
        expect(tabButtons[2].classList.contains('flexlayout__tab_button--selected')).toBe(false)
    })
})
