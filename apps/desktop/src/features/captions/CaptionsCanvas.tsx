import { useAppStore } from '../../store'
import { CANVAS_SIZES } from '../../types'
import { PreviewCanvas } from '../preview/PreviewCanvas'

// Captions mode's middle column — a plain centered preview, no zone-drag
// overlays (those are Design mode's CanvasStage). Live caption text/karaoke
// in this preview is T8's job (PreviewCanvas still hardcodes
// `activeSeg: undefined` until then) — this task (T6) only needs the 3-pane
// shell in place of StepTranscript's monolithic layout.
export function CaptionsCanvas() {
  const canvasSize = useAppStore(s => s.canvasSize)
  const { w, h } = CANVAS_SIZES[canvasSize]
  const ratio = w / h

  return (
    <div className="flex h-full items-center justify-center bg-bg-pit p-6">
      <div
        className="overflow-hidden rounded-[var(--radius-m)] shadow-[0_16px_56px_rgba(0,0,0,0.55)]"
        style={{
          aspectRatio: String(ratio),
          width: ratio >= 1 ? '80%' : undefined,
          height: ratio < 1 ? '86%' : undefined,
        }}
      >
        <PreviewCanvas ratio={ratio} className="h-full w-full" />
      </div>
    </div>
  )
}
