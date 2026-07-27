import { act, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { renderIntoDom, click } from '../../../ui/testUtils'
import { useAppStore } from '../../../store'
import type { Segment } from '../../../types'

// react-virtuoso measures via ResizeObserver, which jsdom doesn't provide —
// it silently renders nothing rather than erroring, which would make every
// test below pass for the wrong reason (an empty container). Swap it for a
// plain unvirtualized render so this test actually exercises SegmentList's
// own selection/edit/context-menu logic instead of Virtuoso's measurement.
vi.mock('react-virtuoso', () => ({
  Virtuoso: ({ data, itemContent }: { data: Segment[]; itemContent: (i: number, d: Segment) => ReactNode }) => (
    <div>{data.map((d, i) => <div key={d.id}>{itemContent(i, d)}</div>)}</div>
  ),
}))

const { SegmentList } = await import('../SegmentList')

const SEGMENTS: Segment[] = [
  { id: 0, start: 0, end: 2, text: 'Hello world' },
  { id: 1, start: 2, end: 4, text: 'Second segment' },
]

function fire(el: Element, type: string, init: KeyboardEventInit = {}) {
  act(() => { el.dispatchEvent(new KeyboardEvent(type, { bubbles: true, cancelable: true, ...init })) })
}

describe('SegmentList', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true)
    useAppStore.setState({ segments: SEGMENTS })
  })

  it('renders every segment row with its text', () => {
    const { container, unmount } = renderIntoDom(<SegmentList items={SEGMENTS} />)
    expect(container.textContent).toContain('Hello world')
    expect(container.textContent).toContain('Second segment')
    unmount()
  })

  it('click once selects, click again on the selected row starts editing', () => {
    const { container, unmount } = renderIntoDom(<SegmentList items={SEGMENTS} />)
    const textEl = Array.from(container.querySelectorAll('span')).find(el => el.textContent === 'Hello world')!

    click(textEl)
    expect(useAppStore.getState().selectedSegmentId).toBe(0)
    expect(container.querySelector('textarea')).toBeNull()

    const textElAgain = Array.from(container.querySelectorAll('span')).find(el => el.textContent === 'Hello world')!
    click(textElAgain)
    expect(container.querySelector('textarea')).not.toBeNull()
    unmount()
  })

  it('Escape cancels editing without changing the segment text', () => {
    const { container, unmount } = renderIntoDom(<SegmentList items={SEGMENTS} />)
    const textEl = Array.from(container.querySelectorAll('span')).find(el => el.textContent === 'Hello world')!
    click(textEl)
    click(Array.from(container.querySelectorAll('span')).find(el => el.textContent === 'Hello world')!)

    const textarea = container.querySelector('textarea')!
    fire(textarea, 'keydown', { key: 'Escape' })

    expect(container.querySelector('textarea')).toBeNull()
    expect(useAppStore.getState().segments[0].text).toBe('Hello world')
    unmount()
  })

  it('Enter commits the edited text back into the store', () => {
    const { container, unmount } = renderIntoDom(<SegmentList items={SEGMENTS} />)
    const textEl = Array.from(container.querySelectorAll('span')).find(el => el.textContent === 'Hello world')!
    click(textEl)
    click(Array.from(container.querySelectorAll('span')).find(el => el.textContent === 'Hello world')!)

    const textarea = container.querySelector('textarea') as HTMLTextAreaElement
    act(() => {
      const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')!.set!
      setter.call(textarea, 'Edited text')
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
    fire(textarea, 'keydown', { key: 'Enter' })

    expect(useAppStore.getState().segments[0].text).toBe('Edited text')
    expect(container.querySelector('textarea')).toBeNull()
    unmount()
  })

  it('right-click opens a context menu with Merge disabled on the last row', () => {
    const { container, unmount } = renderIntoDom(<SegmentList items={SEGMENTS} />)
    const lastRowText = Array.from(container.querySelectorAll('span')).find(el => el.textContent === 'Second segment')!
    const row = lastRowText.closest('div')!

    act(() => {
      row.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true }))
    })

    const menuItems = Array.from(document.querySelectorAll('[role="menuitem"]'))
    const mergeItem = menuItems.find(el => el.textContent === 'Merge with next') as HTMLButtonElement
    expect(mergeItem).toBeDefined()
    expect(mergeItem.disabled).toBe(true)

    unmount()
  })
})
