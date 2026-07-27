import { describe, expect, it } from 'vitest'
import { renderIntoDom } from '../../../ui/testUtils'

// Same regression guard as DesignInspector.test.tsx (P2-T8): this file is
// statically imported from App.tsx, which main.tsx imports before its own
// registerBuiltins() call runs, so a module-level palette lookup would hit
// an empty registry. Deliberately does NOT call registerBuiltins() first.
describe('CaptionsInspector module evaluation', () => {
  it('imports without throwing even before registerBuiltins() has run', async () => {
    await expect(import('../CaptionsInspector')).resolves.toBeDefined()
  })

  it('renders the 5 UI_DESIGN_SPEC.md §5.2 clusters once extensions are registered', async () => {
    const { registerBuiltins } = await import('../../../extensions')
    registerBuiltins()
    const { CaptionsInspector } = await import('../CaptionsInspector')
    const { container, unmount } = renderIntoDom(<CaptionsInspector />)
    expect(container.textContent).toContain('Show captions in export')
    expect(container.textContent).toContain('Text color')
    expect(container.textContent).toContain('Karaoke highlight')
    expect(container.textContent).toContain('Vertical position')
    unmount()
  })
})
