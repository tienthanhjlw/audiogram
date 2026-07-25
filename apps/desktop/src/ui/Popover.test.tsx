import { act, useRef } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Popover } from './Popover'
import { renderIntoDom } from './testUtils'

function Harness({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLButtonElement>(null)
  return (
    <div>
      <button ref={ref}>Trigger</button>
      <Popover anchorRef={ref} open={open} onClose={onClose}>
        <div>Popover content</div>
      </Popover>
    </div>
  )
}

describe('Popover', () => {
  it('renders nothing when closed', () => {
    const { container, unmount } = renderIntoDom(<Harness open={false} onClose={() => {}} />)
    expect(document.body.textContent).not.toContain('Popover content')
    unmount()
    void container
  })

  it('renders content when open', () => {
    const { unmount } = renderIntoDom(<Harness open onClose={() => {}} />)
    expect(document.body.textContent).toContain('Popover content')
    unmount()
  })

  it('calls onClose on outside mousedown', () => {
    const onClose = vi.fn()
    const { unmount } = renderIntoDom(<Harness open onClose={onClose} />)
    act(() => {
      document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('calls onClose on Escape', () => {
    const onClose = vi.fn()
    const { unmount } = renderIntoDom(<Harness open onClose={onClose} />)
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    unmount()
  })
})
