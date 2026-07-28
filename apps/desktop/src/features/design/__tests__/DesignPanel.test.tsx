import { beforeEach, describe, expect, it } from 'vitest'
import { renderIntoDom } from '../../../ui/testUtils'
import { useAppStore } from '../../../store'

beforeEach(() => {
  useAppStore.setState({ layersBetaEnabled: false, nodes: [], selectedNodeIds: [] })
})

// PHASE5_TASKS.md §7b / T7's central constraint: the template fast-path must
// not grow any new steps when the Layers beta is off (the default). This is
// a regression guard, not exhaustive UI testing — it just proves the new
// panel doesn't render unless explicitly toggled on.
describe('DesignPanel fast-path (Layers beta off by default)', () => {
  it('does not render the Layers panel or node inspector when layersBetaEnabled is false', async () => {
    const { registerBuiltins } = await import('../../../extensions')
    registerBuiltins()
    const { DesignPanel } = await import('../DesignPanel')
    const { container, unmount } = renderIntoDom(<DesignPanel />)
    expect(container.textContent).not.toContain('Layers')
    expect(container.textContent).toContain('Template')
    expect(container.textContent).toContain('Wave style')
    unmount()
  })

  it('renders the Layers panel once toggled on, template gallery still present', async () => {
    useAppStore.setState({ layersBetaEnabled: true })
    const { registerBuiltins } = await import('../../../extensions')
    registerBuiltins()
    const { DesignPanel } = await import('../DesignPanel')
    const { container, unmount } = renderIntoDom(<DesignPanel />)
    expect(container.textContent).toContain('Layers')
    expect(container.textContent).toContain('Template')
    unmount()
  })
})
