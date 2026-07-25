import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Modal } from './Modal'
import { renderIntoDom } from './testUtils'

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { unmount } = renderIntoDom(
      <Modal open={false} onClose={() => {}}><div>Export video</div></Modal>,
    )
    expect(document.body.textContent).not.toContain('Export video')
    unmount()
  })

  it('renders content when open', () => {
    const { unmount } = renderIntoDom(
      <Modal open onClose={() => {}}><div>Export video</div></Modal>,
    )
    expect(document.body.textContent).toContain('Export video')
    unmount()
  })

  it('calls onClose on Escape when dismissable', () => {
    const onClose = vi.fn()
    const { unmount } = renderIntoDom(
      <Modal open onClose={onClose}><div>content</div></Modal>,
    )
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('ignores Escape when not dismissable (render in progress)', () => {
    const onClose = vi.fn()
    const { unmount } = renderIntoDom(
      <Modal open onClose={onClose} dismissable={false}><div>content</div></Modal>,
    )
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(onClose).not.toHaveBeenCalled()
    unmount()
  })
})
