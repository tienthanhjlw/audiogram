import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Tooltip } from './Tooltip'
import { renderIntoDom } from './testUtils'

// React 17+ delegates onFocus/onBlur via the bubbling focusin/focusout
// events (not focus/blur, which don't bubble) — dispatch those directly
// rather than relying on mouseenter/mouseleave delegation quirks in jsdom.
function focusWrapper(container: HTMLElement) {
  act(() => {
    container.querySelector('span')!.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
  })
}
function blurWrapper(container: HTMLElement) {
  act(() => {
    container.querySelector('span')!.dispatchEvent(new FocusEvent('focusout', { bubbles: true }))
  })
}

describe('Tooltip', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('renders children without throwing', () => {
    const { container, unmount } = renderIntoDom(
      <Tooltip content="Export video"><button>Export</button></Tooltip>,
    )
    expect(container.querySelector('button')?.textContent).toBe('Export')
    unmount()
  })

  it('does not show content before the delay', () => {
    const { container, unmount } = renderIntoDom(
      <Tooltip content="Export video"><button>Export</button></Tooltip>,
    )
    focusWrapper(container)
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull()
    unmount()
  })

  it('shows content after the delay and hides on blur', () => {
    const { container, unmount } = renderIntoDom(
      <Tooltip content="Export video"><button>Export</button></Tooltip>,
    )
    focusWrapper(container)
    act(() => { vi.advanceTimersByTime(400) })
    expect(document.body.querySelector('[role="tooltip"]')?.textContent).toContain('Export video')

    blurWrapper(container)
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull()
    unmount()
  })

  it('never shows when disabled', () => {
    const { container, unmount } = renderIntoDom(
      <Tooltip content="Export video" disabled><button>Export</button></Tooltip>,
    )
    focusWrapper(container)
    act(() => { vi.advanceTimersByTime(400) })
    expect(document.body.querySelector('[role="tooltip"]')).toBeNull()
    unmount()
  })
})
