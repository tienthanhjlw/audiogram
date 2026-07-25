import { describe, expect, it } from 'vitest'
import { ProgressBar } from './ProgressBar'
import { renderIntoDom } from './testUtils'

// DOM shape is container > track(div) > fill(div) — go straight to the fill.
function fillOf(container: HTMLElement): HTMLElement {
  return container.firstElementChild!.firstElementChild as HTMLElement
}

describe('ProgressBar', () => {
  it('sets width from value when determinate', () => {
    const { container, unmount } = renderIntoDom(<ProgressBar value={42} />)
    expect(fillOf(container).style.width).toBe('42%')
    unmount()
  })

  it('clamps out-of-range values', () => {
    const { container, unmount } = renderIntoDom(<ProgressBar value={150} />)
    expect(fillOf(container).style.width).toBe('100%')
    unmount()
  })

  it('renders an indeterminate bar when value is omitted', () => {
    const { container, unmount } = renderIntoDom(<ProgressBar />)
    expect(fillOf(container).className).toContain('animate-progress-indeterminate')
    unmount()
  })
})
