import { beforeEach, describe, expect, it } from 'vitest'
import { renderIntoDom } from '../../../ui/testUtils'
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
})
