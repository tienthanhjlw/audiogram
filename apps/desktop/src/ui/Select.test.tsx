import { describe, expect, it, vi } from 'vitest'
import { Select } from './Select'
import { click, renderIntoDom } from './testUtils'

const OPTIONS = [
  { value: 'base', label: 'Base' },
  { value: 'small', label: 'Small' },
] as const

describe('Select', () => {
  it('shows the selected option label on the trigger', () => {
    const { container, unmount } = renderIntoDom(
      <Select value="base" onChange={() => {}} options={[...OPTIONS]} />,
    )
    expect(container.querySelector('button')?.textContent).toContain('Base')
    unmount()
  })

  it('opens the listbox on trigger click and selects an option', () => {
    const onChange = vi.fn()
    const { container, unmount } = renderIntoDom(
      <Select value="base" onChange={onChange} options={[...OPTIONS]} />,
    )
    click(container.querySelector('button')!)
    const option = [...document.body.querySelectorAll('[role="option"]')].find(o => o.textContent?.includes('Small'))
    click(option!)
    expect(onChange).toHaveBeenCalledWith('small')
    unmount()
  })

  it('does not open when disabled', () => {
    const { container, unmount } = renderIntoDom(
      <Select value="base" onChange={() => {}} options={[...OPTIONS]} disabled />,
    )
    click(container.querySelector('button')!)
    expect(document.body.querySelector('[role="listbox"]')).toBeNull()
    unmount()
  })
})
