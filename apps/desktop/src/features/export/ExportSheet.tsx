import { useEffect, useState } from 'react'
import { useAppStore } from '../../store'
import { CANVAS_SIZES, type CanvasSize } from '../../types'
import { estimateSize, estimateTime } from '../../domain/export/estimate'
import { formatBytes, formatDuration, slugify } from '../../domain/format'
import { useRenderExport } from './useRenderExport'
import { Button, Input, Modal, SegmentedControl, Select } from '../../ui'

const FORMAT_OPTIONS = (Object.keys(CANVAS_SIZES) as CanvasSize[]).map(id => ({
  value: id, label: CANVAS_SIZES[id].label,
}))
const FPS_OPTIONS = [24, 30, 60].map(f => ({ value: String(f), label: String(f) }))

// features/export/ExportSheet.tsx — UI_DESIGN_SPEC.md §7. State A (this
// task, PHASE3_TASKS.md T10) only; rendering/success/error get placeholder
// views here so the flow doesn't dead-end, with the real State B/C/D UI
// (progress checklist, ETA, minimize, native notification) built on top in
// p3-t11/t12 without needing to touch this file's State A section again.
export function ExportSheet() {
  const exportSheet   = useAppStore(s => s.exportSheet)
  const setExportSheet = useAppStore(s => s.setExportSheet)
  const canvasSize    = useAppStore(s => s.canvasSize)
  const fps           = useAppStore(s => s.fps)
  const title         = useAppStore(s => s.title)
  const segments      = useAppStore(s => s.segments)
  const showSubtitles = useAppStore(s => s.showSubtitles)
  const karaokeEnabled = useAppStore(s => s.karaokeEnabled)
  const duration      = useAppStore(s => s.duration)
  const lastOutput    = useAppStore(s => s.lastOutput)
  const logs          = useAppStore(s => s.logs)
  const set           = useAppStore(s => s.set)
  const { run } = useRenderExport()

  const [fileName, setFileName] = useState('')

  // Prefill the file name from the title once per sheet-open, not on every
  // title keystroke elsewhere in the app while the sheet happens to be open.
  useEffect(() => {
    if (exportSheet === 'settings') setFileName(prev => prev || slugify(title))
  }, [exportSheet, title])

  if (exportSheet === 'closed') return null

  const hasSegments = segments.length > 0
  const estBytes = estimateSize(duration, canvasSize, fps)
  const estSeconds = estimateTime(duration, fps, canvasSize)
  const { w, h } = CANVAS_SIZES[canvasSize]

  const close = () => setExportSheet('closed')

  const startExport = () => { void run(fileName) }

  return (
    <Modal
      open
      onClose={close}
      dismissable={exportSheet !== 'rendering'}
      className="w-[560px] p-5"
    >
      {exportSheet === 'settings' && (
        <>
          <div className="flex items-center justify-between">
            <span className="text-[15px] font-semibold text-text-1">Export video</span>
            <button type="button" onClick={close} className="text-text-3 hover:text-text-1">✕</button>
          </div>

          <div className="my-4 border-t border-border" />

          <div className="flex flex-col gap-4">
            <Row label="Format">
              <div className="flex items-center gap-2">
                <Select value={canvasSize} onChange={v => set({ canvasSize: v as CanvasSize })} options={FORMAT_OPTIONS} />
                <span className="whitespace-nowrap text-[11px] text-text-3">{w}×{h} · MP4 H.264</span>
              </div>
            </Row>

            <Row label="Frame rate">
              <SegmentedControl
                value={String(fps)}
                onChange={v => set({ fps: Number(v) })}
                options={FPS_OPTIONS}
              />
            </Row>

            <Row label="Captions">
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2 text-[13px] text-text-1">
                  <input
                    type="radio"
                    name="captions-mode"
                    disabled={!hasSegments}
                    checked={showSubtitles && hasSegments}
                    onChange={() => set({ showSubtitles: true })}
                  />
                  Burn into video{hasSegments ? ` · ${segments.length} segments` : ''}
                </label>
                <label className="flex items-center gap-2 text-[13px] text-text-1">
                  <input
                    type="radio"
                    name="captions-mode"
                    disabled={!hasSegments}
                    checked={!showSubtitles || !hasSegments}
                    onChange={() => set({ showSubtitles: false })}
                  />
                  No captions
                </label>
                {showSubtitles && hasSegments && (
                  <label className="ml-6 flex items-center gap-2 text-[12.5px] text-text-2">
                    <input type="checkbox" checked={karaokeEnabled} onChange={e => set({ karaokeEnabled: e.target.checked })} />
                    Karaoke highlight
                  </label>
                )}
              </div>
            </Row>

            <Row label="File name">
              <div className="flex items-center gap-1.5">
                <Input value={fileName} onChange={e => setFileName(e.target.value)} className="flex-1" />
                <span className="text-[13px] text-text-3">.mp4</span>
              </div>
            </Row>
          </div>

          <div className="my-4 border-t border-border" />

          <div className="flex items-center justify-between">
            <span className="text-[12.5px] text-text-2">
              Estimated: ~{formatBytes(estBytes)} · ~{formatDuration(estSeconds)}
            </span>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={close}>Cancel</Button>
              <Button variant="primary" disabled={!fileName.trim()} onClick={startExport}>Export</Button>
            </div>
          </div>
        </>
      )}

      {exportSheet === 'rendering' && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="text-[15px] font-semibold text-text-1">Exporting…</span>
          <span className="text-[12.5px] text-text-3">{logs[logs.length - 1] ?? 'Rendering…'}</span>
        </div>
      )}

      {exportSheet === 'success' && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="text-[32px] text-success">✓</span>
          <span className="text-[15px] font-semibold text-text-1">Export complete</span>
          <span className="break-all text-[12.5px] text-text-3">{lastOutput}</span>
          <Button variant="ghost" onClick={close}>Done</Button>
        </div>
      )}

      {exportSheet === 'error' && (
        <div className="flex flex-col items-center gap-3 py-6 text-center">
          <span className="text-[32px] text-danger">⚠</span>
          <span className="text-[15px] font-semibold text-text-1">Export failed</span>
          <span className="text-[12.5px] text-text-3">{logs[logs.length - 1] ?? 'Something went wrong.'}</span>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={close}>Close</Button>
            <Button variant="primary" onClick={() => setExportSheet('settings')}>Try Again</Button>
          </div>
        </div>
      )}
    </Modal>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[100px_1fr] items-center gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-3">{label}</span>
      <div>{children}</div>
    </div>
  )
}
