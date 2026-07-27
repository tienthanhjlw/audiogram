import { useEffect, useState } from 'react'
import { getCurrentWindow } from '@tauri-apps/api/window'
import { useAppStore } from '../../store'
import { ipc } from '../../core/ipc/client'
import { Button, Modal } from '../../ui'

// UI_DESIGN_SPEC.md §8.3 — mounted once at the app root (App.tsx, alongside
// ExportSheet) rather than inside ExportSheet itself: a render can be in
// flight with the sheet closed/minimized, and this still has to intercept
// the window close in that case.
export function CloseGuardDialog() {
  const isRendering = useAppStore(s => s.isRendering)
  const progressPct = useAppStore(s => s.progressPct)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const win = getCurrentWindow()
    let unlisten: (() => void) | undefined
    void win.onCloseRequested(event => {
      if (useAppStore.getState().isRendering) {
        event.preventDefault()
        setOpen(true)
      }
    }).then(fn => { unlisten = fn })
    return () => unlisten?.()
  }, [])

  // If the render finishes (or is cancelled) while this confirm is showing,
  // don't leave a stale "in progress" dialog up.
  useEffect(() => {
    if (open && !isRendering) setOpen(false)
  }, [open, isRendering])

  const keepExporting = () => setOpen(false)

  const quitAnyway = () => {
    void ipc.cancelRender()
    setOpen(false)
    void getCurrentWindow().destroy()
  }

  return (
    <Modal open={open} onClose={keepExporting} className="w-[400px] p-5">
      <div className="text-[15px] font-semibold text-text-1">Export in progress</div>
      <p className="mt-2 text-[13px] text-text-2">
        Quitting now will cancel the export at {Math.round(progressPct)}%.
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="primary" onClick={keepExporting}>Keep Exporting</Button>
        <Button variant="danger" onClick={quitAnyway}>Quit Anyway</Button>
      </div>
    </Modal>
  )
}
