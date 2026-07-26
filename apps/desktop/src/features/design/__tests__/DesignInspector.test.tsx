import { describe, expect, it } from 'vitest'
import { renderIntoDom } from '../../../ui/testUtils'

// Regression test for a real bug caught during P2-T8: this file is
// statically imported from App.tsx, which main.tsx imports before its own
// registerBuiltins() call runs (ES module evaluation order — every static
// import resolves before the importing module's body executes). A
// module-level `palettePoint.get(id)!.colors` read at import time would hit
// an empty registry and crash on the `!` non-null assertion, before
// registerBuiltins() ever gets a chance to populate it. Deliberately does
// NOT call registerBuiltins() first, unlike other feature tests in this
// repo, to prove the import itself is safe.
describe('DesignInspector module evaluation', () => {
  it('imports without throwing even before registerBuiltins() has run', async () => {
    await expect(import('../DesignInspector')).resolves.toBeDefined()
  })

  it('renders the Canvas section once extensions are registered', async () => {
    const { registerBuiltins } = await import('../../../extensions')
    registerBuiltins()
    const { DesignInspector } = await import('../DesignInspector')
    const { container, unmount } = renderIntoDom(<DesignInspector />)
    expect(container.textContent).toContain('Canvas')
    unmount()
  })
})
