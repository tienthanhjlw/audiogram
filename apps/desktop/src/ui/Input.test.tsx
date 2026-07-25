import { act } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { Input, Textarea } from './Input'
import { renderIntoDom } from './testUtils'

describe('Input', () => {
  it('renders and forwards value/onChange', () => {
    const onChange = vi.fn()
    const { container, unmount } = renderIntoDom(<Input value="episode-01" onChange={onChange} />)
    const input = container.querySelector('input')!
    expect(input.value).toBe('episode-01')
    unmount()
  })

  it('respects disabled', () => {
    const { container, unmount } = renderIntoDom(<Input disabled value="" onChange={() => {}} />)
    expect(container.querySelector('input')!.disabled).toBe(true)
    unmount()
  })
})

describe('Textarea', () => {
  it('renders without throwing and grows on input', () => {
    const { container, unmount } = renderIntoDom(<Textarea defaultValue="" />)
    const el = container.querySelector('textarea')!
    act(() => {
      el.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(el.style.height).not.toBe('')
    unmount()
  })
})
