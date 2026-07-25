import { describe, expect, it, vi } from 'vitest'
import { Button } from './Button'
import { click, renderIntoDom } from './testUtils'

describe('Button', () => {
  it('renders without throwing', () => {
    const { container, unmount } = renderIntoDom(<Button>Export</Button>)
    expect(container.querySelector('button')?.textContent).toContain('Export')
    unmount()
  })

  it('calls onClick when clicked', () => {
    const onClick = vi.fn()
    const { container, unmount } = renderIntoDom(<Button onClick={onClick}>Export</Button>)
    click(container.querySelector('button')!)
    expect(onClick).toHaveBeenCalledTimes(1)
    unmount()
  })

  it('does not call onClick when disabled', () => {
    const onClick = vi.fn()
    const { container, unmount } = renderIntoDom(<Button onClick={onClick} disabled>Export</Button>)
    click(container.querySelector('button')!)
    expect(onClick).not.toHaveBeenCalled()
    unmount()
  })

  it('does not call onClick while loading', () => {
    const onClick = vi.fn()
    const { container, unmount } = renderIntoDom(<Button onClick={onClick} loading>Export</Button>)
    click(container.querySelector('button')!)
    expect(onClick).not.toHaveBeenCalled()
    unmount()
  })
})
