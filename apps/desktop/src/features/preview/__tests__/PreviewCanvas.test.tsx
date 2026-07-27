import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderIntoDom } from '../../../ui/testUtils'
import { useAppStore } from '../../../store'
import { PreviewCanvas } from '../PreviewCanvas'

// Regression guard for a real crash shipped in p3-t8 and found by hand:
// PreviewCanvas selected `showCaptions && s.showSubtitles ? s.segments : []`.
// The `[]` literal is a NEW array on every selector call, and zustand v5
// compares snapshots with Object.is through useSyncExternalStore — so React
// saw the store change on every render, looped, and tore the whole tree
// down with "The result of getSnapshot should be cached to avoid an
// infinite loop". Design mode (showCaptions omitted) always took that
// branch, so opening any audio file landed on a blank screen.
describe('PreviewCanvas store selectors', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true)
  })

  it('mounts in Design mode (showCaptions off) without an unstable-snapshot loop', () => {
    const errors: unknown[] = []
    const spy = vi.spyOn(console, 'error').mockImplementation((...args) => { errors.push(args[0]) })

    const { unmount } = renderIntoDom(<PreviewCanvas ratio={1} />)

    const messages = errors.map(String).join('\n')
    expect(messages).not.toContain('getSnapshot should be cached')
    expect(messages).not.toContain('Maximum update depth')

    spy.mockRestore()
    unmount()
  })

  it('mounts in Captions mode with segments present', () => {
    useAppStore.setState({
      showSubtitles: true,
      segments: [{ id: 0, start: 0, end: 1, text: 'hi' }],
    })
    const errors: unknown[] = []
    const spy = vi.spyOn(console, 'error').mockImplementation((...args) => { errors.push(args[0]) })

    const { unmount } = renderIntoDom(<PreviewCanvas ratio={1} showCaptions />)

    const messages = errors.map(String).join('\n')
    expect(messages).not.toContain('getSnapshot should be cached')
    expect(messages).not.toContain('Maximum update depth')

    spy.mockRestore()
    unmount()
  })
})
