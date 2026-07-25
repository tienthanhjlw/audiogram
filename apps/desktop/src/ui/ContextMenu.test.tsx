import { describe, expect, it, vi } from 'vitest'
import { ContextMenu } from './ContextMenu'
import { click, renderIntoDom } from './testUtils'

describe('ContextMenu', () => {
  it('renders nothing when closed', () => {
    const { unmount } = renderIntoDom(
      <ContextMenu open={false} x={0} y={0} items={[{ label: 'Delete', onSelect: () => {} }]} onClose={() => {}} />,
    )
    expect(document.body.querySelector('[role="menu"]')).toBeNull()
    unmount()
  })

  it('calls onSelect and onClose when an item is clicked', () => {
    const onSelect = vi.fn()
    const onClose = vi.fn()
    const { unmount } = renderIntoDom(
      <ContextMenu open x={10} y={10} items={[{ label: 'Delete', onSelect }]} onClose={onClose} />,
    )
    click(document.body.querySelector('[role="menuitem"]')!)
    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('does not call onSelect for a disabled item', () => {
    const onSelect = vi.fn()
    const { unmount } = renderIntoDom(
      <ContextMenu open x={10} y={10} items={[{ label: 'Delete', onSelect, disabled: true }]} onClose={() => {}} />,
    )
    click(document.body.querySelector('[role="menuitem"]')!)
    expect(onSelect).not.toHaveBeenCalled()
    unmount()
  })

  it('renders separators without treating them as items', () => {
    const { unmount } = renderIntoDom(
      <ContextMenu
        open
        x={0}
        y={0}
        items={[{ label: 'Play', onSelect: () => {} }, { separator: true }, { label: 'Delete', onSelect: () => {} }]}
        onClose={() => {}}
      />,
    )
    expect(document.body.querySelectorAll('[role="menuitem"]').length).toBe(2)
    expect(document.body.querySelector('[role="separator"]')).not.toBeNull()
    unmount()
  })
})
