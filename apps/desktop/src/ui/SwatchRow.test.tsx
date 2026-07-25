import { describe, expect, it, vi } from 'vitest'
import { SwatchRow } from './SwatchRow'
import { click, renderIntoDom } from './testUtils'

const SWATCHES = [
  { hex: '#7C5CFF', name: 'Purple' },
  { hex: '#06B6D4', name: 'Cyan' },
]

describe('SwatchRow', () => {
  it('renders one button per swatch plus a custom color well', () => {
    const { container, unmount } = renderIntoDom(
      <SwatchRow value="#7C5CFF" onChange={() => {}} swatches={SWATCHES} />,
    )
    expect(container.querySelectorAll('button').length).toBe(2)
    expect(container.querySelector('input[type="color"]')).not.toBeNull()
    unmount()
  })

  it('calls onChange with the clicked swatch hex', () => {
    const onChange = vi.fn()
    const { container, unmount } = renderIntoDom(
      <SwatchRow value="#7C5CFF" onChange={onChange} swatches={SWATCHES} />,
    )
    click(container.querySelectorAll('button')[1])
    expect(onChange).toHaveBeenCalledWith('#06B6D4')
    unmount()
  })

  it('marks the matching swatch as selected', () => {
    const { container, unmount } = renderIntoDom(
      <SwatchRow value="#06B6D4" onChange={() => {}} swatches={SWATCHES} />,
    )
    const buttons = container.querySelectorAll('button')
    expect(buttons[0].getAttribute('aria-pressed')).toBe('false')
    expect(buttons[1].getAttribute('aria-pressed')).toBe('true')
    unmount()
  })
})
