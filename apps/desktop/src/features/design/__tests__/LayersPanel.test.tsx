import { beforeEach, describe, expect, it } from 'vitest'
import { renderIntoDom, click } from '../../../ui/testUtils'
import { useAppStore } from '../../../store'

beforeEach(() => {
  useAppStore.setState({ nodes: [], selectedNodeIds: [] })
})

describe('LayersPanel', () => {
  it('imports without throwing even before registerBuiltins() has run', async () => {
    await expect(import('../LayersPanel')).resolves.toBeDefined()
  })

  it('shows the empty state hint, not a blank panel, when there are no nodes', async () => {
    const { LayersPanel } = await import('../LayersPanel')
    const { container, unmount } = renderIntoDom(<LayersPanel />)
    // Expand the collapsed-by-default section first.
    click(container.querySelector('button')!)
    expect(container.textContent).toContain('Add text, images or stickers')
    unmount()
  })

  it('+ Text adds a node, selects it, and it appears in the list', async () => {
    const { LayersPanel } = await import('../LayersPanel')
    const { container, unmount } = renderIntoDom(<LayersPanel />)
    click(container.querySelector('button')!) // expand
    const addTextBtn = Array.from(container.querySelectorAll('button')).find(b => b.textContent === '+ Text')!
    click(addTextBtn)
    expect(useAppStore.getState().nodes).toHaveLength(1)
    expect(useAppStore.getState().nodes[0].type).toBe('text')
    expect(useAppStore.getState().selectedNodeIds).toEqual([useAppStore.getState().nodes[0].id])
    expect(container.textContent).toContain('New text')
    unmount()
  })

  it('delete (✕) removes the node', async () => {
    const { LayersPanel } = await import('../LayersPanel')
    const { container, unmount } = renderIntoDom(<LayersPanel />)
    click(container.querySelector('button')!) // expand
    click(Array.from(container.querySelectorAll('button')).find(b => b.textContent === '+ Text')!)
    expect(useAppStore.getState().nodes).toHaveLength(1)
    const deleteBtn = Array.from(container.querySelectorAll('button')).find(b => b.title === 'Delete')!
    click(deleteBtn)
    expect(useAppStore.getState().nodes).toHaveLength(0)
    unmount()
  })
})
