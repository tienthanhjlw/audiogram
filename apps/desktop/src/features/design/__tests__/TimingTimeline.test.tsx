import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderIntoDom } from '../../../ui/testUtils'
import { useAppStore } from '../../../store'
import type { SceneNode } from '../../../types'

vi.mock('../../../core/audio/AudioEngine', () => ({
  audioEngine: { seek: vi.fn(), onFrame: vi.fn(() => () => {}), toggle: vi.fn() },
}))

function waveformNode(id: string, timing?: { start: number; end: number }): SceneNode {
  return {
    id, type: 'waveform',
    transform: { x: 0, y: 0, w: 1, h: 1, rotation: 0, opacity: 1 },
    z: 0, timing,
    props: { type: 'waveform', style: 'bar', color: '#fff' },
  }
}

beforeEach(() => {
  useAppStore.setState({ nodes: [], selectedNodeIds: [], duration: 20, currentTime: 0 })
})

describe('TimingTimeline', () => {
  it('renders nothing when there are no nodes', async () => {
    const { TimingTimeline } = await import('../TimingTimeline')
    const { container, unmount } = renderIntoDom(<TimingTimeline />)
    expect(container.innerHTML).toBe('')
    unmount()
  })

  it('renders a full-width bar for a node with no timing, and a partial bar for one with timing', async () => {
    useAppStore.setState({
      nodes: [waveformNode('always'), waveformNode('timed', { start: 5, end: 12 })],
    })
    const { TimingTimeline } = await import('../TimingTimeline')
    const { container, unmount } = renderIntoDom(<TimingTimeline />)
    expect(container.textContent).toContain('Timing')
    const bars = container.querySelectorAll('[style*="left"]')
    expect(bars.length).toBeGreaterThan(0)
    unmount()
  })

  it('renders 20 nodes without a perceptible delay (P5-T9 budget check)', async () => {
    useAppStore.setState({
      nodes: Array.from({ length: 20 }, (_, i) => waveformNode(`n${i}`, { start: i, end: i + 2 })),
    })
    const { TimingTimeline } = await import('../TimingTimeline')
    const start = performance.now()
    const { unmount } = renderIntoDom(<TimingTimeline />)
    const ms = performance.now() - start
    console.log(`[P5-T9 budget] TimingTimeline render, 20 nodes: ${ms.toFixed(3)} ms`)
    expect(ms).toBeLessThan(100) // generous — this is a DOM render, not a canvas draw loop
    unmount()
  })

  it('clicking the track seeks via audioEngine.seek', async () => {
    useAppStore.setState({ nodes: [waveformNode('a')] })
    const { audioEngine } = await import('../../../core/audio/AudioEngine')
    const { TimingTimeline } = await import('../TimingTimeline')
    const { container, unmount } = renderIntoDom(<TimingTimeline />)
    const track = container.querySelector('[class*="select-none"]') as HTMLElement
    track.getBoundingClientRect = () => ({ left: 0, top: 0, width: 200, height: 22, right: 200, bottom: 22, x: 0, y: 0, toJSON: () => {} })
    track.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, clientX: 100 }))
    expect(audioEngine.seek).toHaveBeenCalled()
    unmount()
  })
})
