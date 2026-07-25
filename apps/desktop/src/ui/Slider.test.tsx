import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Slider } from './Slider'
import { renderIntoDom } from './testUtils'

describe('Slider', () => {
  it('renders the value, formatted if formatValue is given', () => {
    const { container, unmount } = renderIntoDom(
      <Slider value={100} min={70} max={140} onChange={() => {}} formatValue={v => `${v}%`} />,
    )
    expect(container.textContent).toContain('100%')
    unmount()
  })

  it('calls onChange with a number when the input changes', () => {
    const onChange = vi.fn()
    const { container, unmount } = renderIntoDom(
      <Slider value={100} min={70} max={140} onChange={onChange} />,
    )
    const input = container.querySelector('input')!
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!
      setter.call(input, '120')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(onChange).toHaveBeenCalledWith(120)
    unmount()
  })

  it('does not call onChange when disabled', () => {
    const onChange = vi.fn()
    const { container, unmount } = renderIntoDom(
      <Slider value={100} min={70} max={140} onChange={onChange} disabled />,
    )
    expect(container.querySelector('input')!.disabled).toBe(true)
    unmount()
  })
})
