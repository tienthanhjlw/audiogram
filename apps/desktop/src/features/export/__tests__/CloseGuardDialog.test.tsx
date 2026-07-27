import { act } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderIntoDom } from '../../../ui/testUtils'
import { useAppStore } from '../../../store'

let closeRequestedHandler: ((event: { preventDefault: () => void }) => void) | undefined

const mockWindow = {
  onCloseRequested: vi.fn((handler: typeof closeRequestedHandler) => {
    closeRequestedHandler = handler
    return Promise.resolve(() => {})
  }),
  destroy: vi.fn().mockResolvedValue(undefined),
}
vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => mockWindow,
}))

const { CloseGuardDialog } = await import('../CloseGuardDialog')

describe('CloseGuardDialog', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true)
    closeRequestedHandler = undefined
  })

  it('registers a close-requested listener on mount', () => {
    const { unmount } = renderIntoDom(<CloseGuardDialog />)
    expect(mockWindow.onCloseRequested).toHaveBeenCalled()
    unmount()
  })

  it('shows the confirm dialog and prevents the default close when a render is in flight', async () => {
    useAppStore.setState({ isRendering: true, progressPct: 42 })
    const { unmount } = renderIntoDom(<CloseGuardDialog />)

    const preventDefault = vi.fn()
    await act(async () => { closeRequestedHandler?.({ preventDefault }) })

    expect(preventDefault).toHaveBeenCalled()
    expect(document.body.textContent).toContain('Export in progress')
    expect(document.body.textContent).toContain('42%')
    unmount()
  })

  it('does not intercept the close when nothing is rendering', async () => {
    useAppStore.setState({ isRendering: false })
    const { unmount } = renderIntoDom(<CloseGuardDialog />)

    const preventDefault = vi.fn()
    await act(async () => { closeRequestedHandler?.({ preventDefault }) })

    expect(preventDefault).not.toHaveBeenCalled()
    unmount()
  })
})
