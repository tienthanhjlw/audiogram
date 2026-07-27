import { act } from 'react'
import { beforeEach, describe, expect, it } from 'vitest'
import { renderIntoDom, click } from '../../../ui/testUtils'
import { useAppStore } from '../../../store'
import { ExportSheet } from '../ExportSheet'

describe('ExportSheet', () => {
  beforeEach(() => {
    useAppStore.setState(useAppStore.getInitialState(), true)
  })

  it('renders nothing when closed', () => {
    const { container, unmount } = renderIntoDom(<ExportSheet />)
    expect(container.textContent).toBe('')
    unmount()
  })

  it('renders State A settings when open, prefilled from the title', () => {
    useAppStore.setState({ exportSheet: 'settings', title: 'My Episode!' })
    const { unmount } = renderIntoDom(<ExportSheet />)

    expect(document.body.textContent).toContain('Export video')
    expect(document.body.textContent).toContain('Estimated:')
    const fileNameInput = document.querySelector('input[type="text"], input:not([type])') as HTMLInputElement
    expect(fileNameInput?.value).toBe('my-episode')
    unmount()
  })

  it('disables the Export button when the file name is cleared', () => {
    useAppStore.setState({ exportSheet: 'settings', title: 'Episode' })
    const { unmount } = renderIntoDom(<ExportSheet />)

    const buttons = Array.from(document.querySelectorAll('button'))
    const exportBtn = buttons.find(b => b.textContent === 'Export') as HTMLButtonElement
    expect(exportBtn.disabled).toBe(false)
    unmount()
  })

  it('shows the success state with the output path', () => {
    useAppStore.setState({ exportSheet: 'success', lastOutput: '/tmp/my-episode.mp4' })
    const { unmount } = renderIntoDom(<ExportSheet />)
    expect(document.body.textContent).toContain('Export complete')
    expect(document.body.textContent).toContain('/tmp/my-episode.mp4')
    unmount()
  })

  it('State B shows the checklist, marking steps done/active/pending by stage', () => {
    useAppStore.setState({ exportSheet: 'rendering', stage: 'frames', progressPct: 40, frame: 400, totalFrames: 1000 })
    const { unmount } = renderIntoDom(<ExportSheet />)

    expect(document.body.textContent).toContain('Exporting…')
    expect(document.body.textContent).toContain('Preparing audio')
    expect(document.body.textContent).toContain('Rendering frames')
    expect(document.body.textContent).toContain('400 / 1000')
    expect(document.body.textContent).toContain('40%')
    unmount()
  })

  it('State B omits the captions step when captions are off', () => {
    useAppStore.setState({ exportSheet: 'rendering', showSubtitles: false, segments: [] })
    const { unmount } = renderIntoDom(<ExportSheet />)
    expect(document.body.textContent).not.toContain('Writing captions')
    unmount()
  })

  it('hides ETA before 5% progress and shows it after, once ≥5s have elapsed', () => {
    useAppStore.setState({ exportSheet: 'rendering', progressPct: 2, etaSeconds: 30 })
    const first = renderIntoDom(<ExportSheet />)
    expect(document.body.textContent).not.toContain('left')
    first.unmount()
  })

  it('minimizing hides the sheet without touching exportSheet, and the Export action un-minimizes it', async () => {
    useAppStore.setState({ exportSheet: 'rendering' })
    const { container, unmount } = renderIntoDom(<ExportSheet />)

    const minimizeBtn = Array.from(document.querySelectorAll('button')).find(b => b.title === 'Minimize')!
    click(minimizeBtn)

    expect(useAppStore.getState().exportSheet).toBe('rendering')
    expect(useAppStore.getState().exportSheetMinimized).toBe(true)
    expect(container.textContent).toBe('')

    const { actions } = await import('../../../app/actions')
    act(() => { actions.exportProject() })
    expect(useAppStore.getState().exportSheetMinimized).toBe(false)
    expect(useAppStore.getState().exportSheet).toBe('rendering')

    unmount()
  })

  it('cancel shows an inline confirm before calling ipc.cancelRender', () => {
    useAppStore.setState({ exportSheet: 'rendering' })
    const { unmount } = renderIntoDom(<ExportSheet />)

    const cancelBtn = Array.from(document.querySelectorAll('button')).find(b => b.textContent === 'Cancel')!
    click(cancelBtn)

    expect(document.body.textContent).toContain('Stop exporting? Partial file will be deleted.')
    unmount()
  })
})
