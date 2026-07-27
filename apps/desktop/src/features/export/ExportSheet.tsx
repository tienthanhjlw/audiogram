import { useEffect, useRef, useState } from 'react'
import { useAppStore } from '../../store'
import { CANVAS_SIZES, type CanvasSize } from '../../types'
import { estimateSize, estimateTime } from '../../domain/export/estimate'
import { formatBytes, formatDuration, slugify } from '../../domain/format'
import { useRenderExport } from './useRenderExport'
import { ipc } from '../../core/ipc/client'
import { Button, Input, Modal, ProgressBar, SegmentedControl, Select } from '../../ui'

const FORMAT_OPTIONS = (Object.keys(CANVAS_SIZES) as CanvasSize[]).map(id => ({
  value: id, label: CANVAS_SIZES[id].label,
}))
const FPS_OPTIONS = [24, 30, 60].map(f => ({ value: String(f), label: String(f) }))

// features/export/ExportSheet.tsx — UI_DESIGN_SPEC.md §7. State A (p3-t10)
// + State B (this task, p3-t11 — rendering checklist/ETA/cancel/minimize).
// State C/D (success/error) still get the p3-t10 placeholder views; the
// real ones are p3-t12, alongside dock progress/native notification/close
// guard.
export function ExportSheet() {
  const exportSheet     = useAppStore(s => s.exportSheet)
  const setExportSheet  = useAppStore(s => s.setExportSheet)
  const minimized       = useAppStore(s => s.exportSheetMinimized)
  const setMinimized    = useAppStore(s => s.setExportSheetMinimized)
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

  if (exportSheet === 'closed' || (minimized && exportSheet === 'rendering')) return null

  const hasSegments = segments.length > 0
  const estBytes = estimateSize(duration, canvasSize, fps)
  const estSeconds = estimateTime(duration, fps, canvasSize)
  const { w, h } = CANVAS_SIZES[canvasSize]

  const close = () => setExportSheet('closed')

  // While rendering, the backdrop/Esc minimize (hide the sheet, keep the
  // render running) instead of closing/cancelling it — UI_DESIGN_SPEC.md
  // §7.2's "click ngoài overlay = minimize (không cancel)". Everywhere else
  // it's a normal dismiss.
  const requestDismiss = () => {
    if (exportSheet === 'rendering') setMinimized(true)
    else close()
  }

  const startExport = () => { void run(fileName) }

  return (
    <Modal open onClose={requestDismiss} dismissable className="w-[560px] p-5">
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
        <RenderingState usesCaptions={showSubtitles && hasSegments} onMinimize={() => setMinimized(true)} />
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

// ── State B — rendering ──────────────────────────────────────────────────

const STAGE_ORDER = ['preparing', 'captions', 'frames', 'encoding', 'done'] as const

function stepStatus(stepKey: string, stage: string): 'done' | 'active' | 'pending' {
  const stepIdx = STAGE_ORDER.indexOf(stepKey as (typeof STAGE_ORDER)[number])
  const stageIdx = STAGE_ORDER.indexOf(stage as (typeof STAGE_ORDER)[number])
  if (stageIdx < 0) return 'pending'
  if (stepIdx < stageIdx) return 'done'
  if (stepIdx === stageIdx) return 'active'
  return 'pending'
}

function RenderingState({ usesCaptions, onMinimize }: { usesCaptions: boolean; onMinimize: () => void }) {
  const stage        = useAppStore(s => s.stage)
  const progressPct  = useAppStore(s => s.progressPct)
  const frame        = useAppStore(s => s.frame)
  const totalFrames  = useAppStore(s => s.totalFrames)
  const etaSeconds   = useAppStore(s => s.etaSeconds)
  const logs         = useAppStore(s => s.logs)

  const [showDetails, setShowDetails] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)
  const startedAtRef = useRef(Date.now())

  useEffect(() => {
    if (showDetails && logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [logs, showDetails])

  const steps = [
    { key: 'preparing', label: 'Preparing audio' },
    ...(usesCaptions ? [{ key: 'captions', label: 'Writing captions' }] : []),
    { key: 'frames', label: 'Rendering frames', detail: totalFrames > 0 ? `${frame} / ${totalFrames}` : undefined },
    { key: 'encoding', label: 'Encoding video' },
  ]

  const elapsedSec = (Date.now() - startedAtRef.current) / 1000
  const showEta = progressPct >= 5 && elapsedSec >= 5 && etaSeconds !== null

  const cancel = () => {
    void ipc.cancelRender()
    setConfirmCancel(false)
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-[15px] font-semibold text-text-1">Exporting…</span>
        <button type="button" title="Minimize" onClick={onMinimize} className="text-text-3 hover:text-text-1">─</button>
      </div>

      <div className="my-4 border-t border-border" />

      <div className="flex flex-col gap-2">
        {steps.map(step => {
          const status = stepStatus(step.key, stage)
          return (
            <div key={step.key} className="flex items-center gap-2 text-[13px] transition-[color] duration-200">
              <span className={
                status === 'done' ? 'text-success' : status === 'active' ? 'animate-pulse text-accent' : 'text-text-3'
              }>
                {status === 'done' ? '✓' : status === 'active' ? '◉' : '○'}
              </span>
              <span className={status === 'pending' ? 'text-text-3' : 'text-text-1'}>{step.label}</span>
              {status === 'active' && step.detail && (
                <span className="ml-auto font-mono text-[11px] text-text-3">{step.detail}</span>
              )}
            </div>
          )
        })}
      </div>

      <div className="my-4 border-t border-border" />

      <ProgressBar value={progressPct} />
      <div className="mt-1.5 flex items-center justify-between text-[12px] text-text-2">
        <span>{Math.round(progressPct)}%{showEta ? ` · ~${formatDuration(etaSeconds!)} left` : ''}</span>
        <button type="button" onClick={() => setShowDetails(v => !v)} className="text-text-3 hover:text-text-1">
          {showDetails ? '▾ Hide details' : '▸ Show details'}
        </button>
      </div>

      {showDetails && (
        <div
          ref={logRef}
          className="mt-2 h-[120px] overflow-y-auto rounded-[var(--radius-s)] bg-bg-app p-2 font-mono text-[11px] leading-relaxed text-text-2"
        >
          {logs.map((line, i) => <div key={i}>{line}</div>)}
        </div>
      )}

      <div className="mt-4 flex justify-end">
        {confirmCancel ? (
          <div className="flex w-full items-center justify-between rounded-[var(--radius-s)] bg-bg-app px-3 py-2">
            <span className="text-[12px] text-text-2">Stop exporting? Partial file will be deleted.</span>
            <div className="flex gap-2">
              <Button variant="secondary" size="sm" onClick={() => setConfirmCancel(false)}>Keep going</Button>
              <Button variant="danger" size="sm" onClick={cancel}>Stop</Button>
            </div>
          </div>
        ) : (
          <Button variant="secondary" onClick={() => setConfirmCancel(true)}>Cancel</Button>
        )}
      </div>
    </div>
  )
}
