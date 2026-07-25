import { describe, expect, it, vi } from 'vitest'
import { Toggle } from './Toggle'
import { click, renderIntoDom } from './testUtils'

describe('Toggle', () => {
  it('renders without throwing', () => {
    const { container, unmount } = renderIntoDom(
      <Toggle checked={false} onChange={() => {}} label="Show captions" />,
    )
    expect(container.textContent).toContain('Show captions')
    unmount()
  })

  it('calls onChange with the flipped value when clicked', () => {
    const onChange = vi.fn()
    const { container, unmount } = renderIntoDom(<Toggle checked={false} onChange={onChange} />)
    click(container.querySelector('button')!)
    expect(onChange).toHaveBeenCalledWith(true)
    unmount()
  })

  it('does not call onChange when disabled', () => {
    const onChange = vi.fn()
    const { container, unmount } = renderIntoDom(
      <Toggle checked={false} onChange={onChange} disabled disabledReason="Transcribe audio first" />,
    )
    click(container.querySelector('button')!)
    expect(onChange).not.toHaveBeenCalled()
    unmount()
  })

  it('wraps in a tooltip only when disabled with a reason', () => {
    const { container: withReason, unmount: unmount1 } = renderIntoDom(
      <Toggle checked={false} onChange={() => {}} disabled disabledReason="Transcribe audio first" />,
    )
    expect(withReason.querySelector('span')).not.toBeNull()
    unmount1()

    const { container: enabled, unmount: unmount2 } = renderIntoDom(
      <Toggle checked={false} onChange={() => {}} />,
    )
    expect(enabled.querySelector('button')).not.toBeNull()
    unmount2()
  })
})
