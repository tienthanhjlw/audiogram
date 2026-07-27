import { useAppStore } from '../../store'
import { palettePoint } from '../../extensions'
import { DEFAULT_ZONES } from '../../types'
import { Button, Field, FieldStack, Slider, SwatchRow, Toggle } from '../../ui'
import { ipc } from '../../core/ipc/client'

// Looked up lazily (not at module scope) — same reason as
// DesignInspector.tsx's `palette()` helper: this file is statically
// imported before main.tsx's registerBuiltins() call runs.
function palette(id: string) {
  return palettePoint.get(`com.audiogram.palette.${id}`)?.colors ?? []
}

function colorName(hex: string, swatches: { hex: string; name: string }[]): string {
  return swatches.find(s => s.hex.toLowerCase() === hex.toLowerCase())?.name ?? 'Custom'
}

// UI_DESIGN_SPEC.md §5.2 — static (doesn't depend on a selection, unlike
// DesignInspector). PHASE3_TASKS.md T8.
export function CaptionsInspector() {
  const segments       = useAppStore(s => s.segments)
  const showSubtitles  = useAppStore(s => s.showSubtitles)
  const subtitleColor  = useAppStore(s => s.subtitleColor)
  const karaokeEnabled = useAppStore(s => s.karaokeEnabled)
  const karaokeColor   = useAppStore(s => s.karaokeColor)
  const subtitleYPct   = useAppStore(s => s.subtitleYPct)
  const zones          = useAppStore(s => s.zones)
  const layoutTemplate = useAppStore(s => s.layoutTemplate)
  const srtPath        = useAppStore(s => s.srtPath)
  const set            = useAppStore(s => s.set)

  const hasSegments = segments.length > 0
  const hasSubtitles = showSubtitles && hasSegments

  const effectiveZones = zones ?? DEFAULT_ZONES[layoutTemplate]
  const subtitleSwatches = palette('subtitle')

  // Position: the subtitle zone (if the layout has one and/or the user
  // dragged it in Design mode's CanvasStage) always wins in the renderer
  // over subtitleYPct (domain/preview/renderer.ts's drawSubtitle) — this
  // slider reflects whichever is currently in effect, and writes back to
  // both so a zone-drag and this slider stay in sync (PHASE3_TASKS.md T8's
  // "kéo zone ⇄ slider đồng bộ 2 chiều").
  const positionFraction = effectiveZones.subtitle?.y ?? subtitleYPct ?? 0.74
  const positionPct = Math.round(positionFraction * 100)

  const setPosition = (pct: number) => {
    const y = pct / 100
    const patch: { subtitleYPct: number; zones?: typeof zones } = { subtitleYPct: y }
    if (effectiveZones.subtitle) {
      patch.zones = { ...effectiveZones, subtitle: { ...effectiveZones.subtitle, y } }
    }
    set(patch)
  }

  const resetPosition = () => {
    set({
      subtitleYPct: null,
      zones: zones?.subtitle ? { ...zones, subtitle: undefined } : zones,
    })
  }

  const revealSrt = () => {
    if (!srtPath) return
    const dir = srtPath.replace(/\\/g, '/').replace(/\/[^/]*$/, '')
    ipc.openFolder(dir)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 flex-shrink-0 items-center border-b border-border px-3">
        <span className="text-[13px] font-semibold text-text-1">Caption Style</span>
      </div>

      <div className="overlay-scroll flex-1 overflow-y-auto p-4">
        <FieldStack>
          <Field label="Show captions">
            <Toggle
              label="Show captions in export"
              checked={hasSubtitles}
              disabled={!hasSegments}
              disabledReason="Transcribe first"
              onChange={v => set({ showSubtitles: v })}
            />
          </Field>

          <Field label="Text color">
            <SwatchRow value={subtitleColor} swatches={subtitleSwatches} disabled={!hasSubtitles} onChange={hex => set({ subtitleColor: hex })} />
          </Field>

          <Field label="Karaoke">
            <Toggle
              label="Karaoke highlight"
              subLabel="Text sweeps with audio progress"
              checked={karaokeEnabled}
              disabled={!hasSubtitles}
              disabledReason="Transcribe first"
              onChange={v => set({ karaokeEnabled: v })}
            />
            {karaokeEnabled && hasSubtitles && (
              <div className="mt-3">
                <SwatchRow value={karaokeColor} swatches={palette('karaoke')} onChange={hex => set({ karaokeColor: hex })} />
              </div>
            )}
          </Field>

          <Field label="Vertical position">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Slider value={positionPct} min={0} max={100} formatValue={v => `${v}%`} onChange={setPosition} />
              </div>
              <Button variant="ghost" size="sm" onClick={resetPosition}>Auto</Button>
            </div>
          </Field>

          {srtPath && (
            <Field label="Files">
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] text-text-2">captions.srt ✓</span>
                <Button variant="ghost" size="sm" onClick={revealSrt}>Reveal</Button>
              </div>
            </Field>
          )}
        </FieldStack>
      </div>

      <div className="flex-shrink-0 border-t border-border px-4 py-2.5 text-[11px] text-text-3">
        {segments.length} segments
        {' · '}
        <span className="inline-flex items-center gap-1.5 align-middle">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: subtitleColor }} />
          {colorName(subtitleColor, subtitleSwatches)}
        </span>
      </div>
    </div>
  )
}
