import { describe, expect, it, vi } from 'vitest'
import { SegmentedControl } from './SegmentedControl'
import { click, renderIntoDom } from './testUtils'

const OPTIONS = [
  { value: 'design', label: 'Design' },
  { value: 'captions', label: 'Captions' },
] as const

describe('SegmentedControl', () => {
  it('renders every option without throwing', () => {
    const { container, unmount } = renderIntoDom(
      <SegmentedControl value="design" onChange={() => {}} options={[...OPTIONS]} />,
    )
    expect(container.textContent).toContain('Design')
    expect(container.textContent).toContain('Captions')
    unmount()
  })

  it('calls onChange with the clicked option value', () => {
    const onChange = vi.fn()
    const { container, unmount } = renderIntoDom(
      <SegmentedControl value="design" onChange={onChange} options={[...OPTIONS]} />,
    )
    const buttons = container.querySelectorAll('button')
    click(buttons[1]) // "Captions"
    expect(onChange).toHaveBeenCalledWith('captions')
    unmount()
  })

  it('does not call onChange when disabled', () => {
    const onChange = vi.fn()
    const { container, unmount } = renderIntoDom(
      <SegmentedControl value="design" onChange={onChange} options={[...OPTIONS]} disabled />,
    )
    click(container.querySelectorAll('button')[1])
    expect(onChange).not.toHaveBeenCalled()
    unmount()
  })
})
