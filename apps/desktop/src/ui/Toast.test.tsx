import { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { toast, ToastViewport } from './Toast'
import { renderIntoDom } from './testUtils'

describe('Toast', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('renders nothing until toast.show is called', () => {
    const { unmount } = renderIntoDom(<ToastViewport />)
    expect(document.body.querySelector('[role="status"]')).toBeNull()
    unmount()
  })

  it('shows a toast and auto-dismisses it after 4s', () => {
    const { unmount } = renderIntoDom(<ToastViewport />)
    act(() => { toast.success('Export complete') })
    expect(document.body.textContent).toContain('Export complete')

    act(() => { vi.advanceTimersByTime(4000) })
    expect(document.body.textContent).not.toContain('Export complete')
    unmount()
  })
})
