import { createRoot, type Root } from 'react-dom/client'
import type { ReactElement } from 'react'
import { act } from 'react'

// Minimal render/click helpers so component smoke tests don't need
// @testing-library/react (not in the approved T4 dependency list).
export function renderIntoDom(el: ReactElement): { container: HTMLElement; root: Root; unmount: () => void } {
  const container = document.createElement('div')
  document.body.appendChild(container)
  const root = createRoot(container)
  act(() => { root.render(el) })
  return {
    container,
    root,
    unmount: () => { act(() => { root.unmount() }); container.remove() },
  }
}

export function click(el: Element) {
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
  })
}
