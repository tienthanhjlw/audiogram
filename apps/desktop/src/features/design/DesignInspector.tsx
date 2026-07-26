import { useAppStore } from '../../store'
import { palettePoint, templatePoint } from '../../extensions'
import { DEFAULT_ZONES, WAVE_STYLES, type WaveStyle } from '../../types'
import { Field, FieldStack, Input, Select, Slider, SwatchRow, Toggle, Tooltip } from '../../ui'
import { assetUrl } from '../../core/assetUrl'
import { actions } from '../../app/actions'
import { useCoverImage } from './useCoverImage'

// Looked up lazily inside each component (not at module scope): this file
// is statically imported from App.tsx, which main.tsx imports before its
// own registerBuiltins() call runs (ES module evaluation order — all
// static imports resolve before the importing module's body executes), so
// a module-level `palettePoint.get(...)!.colors` would read an empty
// registry and crash on the `!`.
function palette(id: string) {
  return palettePoint.get(`com.audiogram.palette.${id}`)?.colors ?? []
}

const WAVE_STYLE_OPTIONS = WAVE_STYLES.map(w => ({ value: w.id, label: w.label }))
const FONT_OPTIONS = ['Arial', 'Georgia', 'Impact', 'Verdana'].map(f => ({ value: f, label: f }))
const ALIGN_OPTIONS = [
  { value: 'left' as const, label: '≡', title: 'Align left' },
  { value: 'center' as const, label: '≡', title: 'Align center' },
  { value: 'right' as const, label: '≡', title: 'Align right' },
]

const EL_META: Record<'wave' | 'title' | 'subtitle' | 'avatar', { label: string; color: string }> = {
  wave:     { label: 'Waveform', color: '#6C4FF6' },
  title:    { label: 'Title',    color: '#F59E0B' },
  subtitle: { label: 'Subtitle', color: '#22C55E' },
  avatar:   { label: 'Avatar',   color: '#EC4FC4' },
}

// features/design/DesignInspector.tsx — UI_DESIGN_SPEC.md §4.3. Content
// switches on `ui.slice`'s selectedEl (shared with CanvasStage's zone
// selection, P2-T7). FPS/canvas-size are deliberately absent here — they
// moved to the stage footer (P2-T7) and Export sheet respectively, per
// spec §4.3.1's note.
export function DesignInspector() {
  const selectedEl = useAppStore(s => s.selectedEl)
  const selectEl   = useAppStore(s => s.selectEl)

  const header = selectedEl === null
    ? { label: 'Canvas', color: 'var(--color-text-3)' }
    : EL_META[selectedEl]

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-10 flex-shrink-0 items-center gap-2 border-b border-border px-3">
        <span className="h-2 w-2 flex-shrink-0 rounded-full" style={{ background: header.color }} />
        <span className="flex-1 text-[13px] font-semibold text-text-1">{header.label}</span>
        {selectedEl !== null && (
          <button
            type="button"
            onClick={() => selectEl(null)}
            className="flex h-6 w-6 items-center justify-center rounded-[var(--radius-s)] text-text-3 hover:bg-bg-elevated hover:text-text-1"
          >
            ×
          </button>
        )}
      </div>

      <div className="overlay-scroll flex-1 overflow-y-auto p-4">
        {selectedEl === null && <CanvasSection />}
        {selectedEl === 'wave' && <WaveSection />}
        {selectedEl === 'title' && <TitleSection />}
        {selectedEl === 'subtitle' && <SubtitleSection />}
        {selectedEl === 'avatar' && <AvatarSection />}
      </div>
    </div>
  )
}

function CanvasSection() {
  const bgColor        = useAppStore(s => s.bgColor)
  const title          = useAppStore(s => s.title)
  const layoutTemplate = useAppStore(s => s.layoutTemplate)
  const set            = useAppStore(s => s.set)
  const { coverImagePath, pick, remove } = useCoverImage()

  const needsAvatar = !!templatePoint.get(`com.audiogram.template.${layoutTemplate}`)?.needsAvatar

  return (
    <FieldStack>
      <Field label="Background">
        <SwatchRow value={bgColor} swatches={palette('bg')} onChange={hex => set({ bgColor: hex })} />
      </Field>
      {needsAvatar && (
        <Field label="Cover image">
          <CoverImageWell path={coverImagePath} onPick={pick} onRemove={remove} />
        </Field>
      )}
      <Field label="Title text">
        <Input value={title} onChange={e => set({ title: e.target.value })} placeholder="Episode title" />
      </Field>
    </FieldStack>
  )
}

function WaveSection() {
  const waveStyle = useAppStore(s => s.waveStyle)
  const waveColor = useAppStore(s => s.waveColor)
  const zones     = useAppStore(s => s.zones)
  const layoutTemplate = useAppStore(s => s.layoutTemplate)
  const set = useAppStore(s => s.set)

  const effectiveZones = zones ?? DEFAULT_ZONES[layoutTemplate]
  const wz = effectiveZones.waveform

  return (
    <FieldStack>
      <Field label="Style">
        <Select value={waveStyle} onChange={v => set({ waveStyle: v as WaveStyle })} options={WAVE_STYLE_OPTIONS} />
      </Field>
      <Field label="Color">
        <SwatchRow value={waveColor} swatches={palette('wave')} onChange={hex => set({ waveColor: hex })} />
      </Field>
      <Field label="Position">
        <PositionReadout zone={wz} />
      </Field>
    </FieldStack>
  )
}

function TitleSection() {
  const title       = useAppStore(s => s.title)
  const titleColor  = useAppStore(s => s.titleColor)
  const fontName    = useAppStore(s => s.fontName)
  const fontSize    = useAppStore(s => s.fontSize)
  const titleAlign  = useAppStore(s => s.titleAlign)
  const titleBold   = useAppStore(s => s.titleBold)
  const titleItalic = useAppStore(s => s.titleItalic)
  const set = useAppStore(s => s.set)

  return (
    <FieldStack>
      <Field label="Text">
        <Input value={title} onChange={e => set({ title: e.target.value })} placeholder="Episode title" />
      </Field>
      <Field label="Color">
        <SwatchRow value={titleColor} swatches={palette('wave')} onChange={hex => set({ titleColor: hex })} />
      </Field>
      <Tooltip content="Also applies to captions">
        <div>
          <Field label="Font">
            <Select value={fontName} onChange={v => set({ fontName: v })} options={FONT_OPTIONS} />
          </Field>
          <div className="mt-4">
            <Slider
              value={fontSize} min={70} max={140} step={5}
              formatValue={v => `${v}%`}
              onChange={v => set({ fontSize: v })}
            />
          </div>
        </div>
      </Tooltip>
      <Field label="Format">
        <div className="flex gap-1">
          {ALIGN_OPTIONS.map(a => (
            <button
              key={a.value}
              type="button"
              title={a.title}
              onClick={() => set({ titleAlign: a.value })}
              className={[
                'flex h-7 w-8 items-center justify-center rounded-[var(--radius-s)] text-[13px]',
                titleAlign === a.value ? 'bg-accent-soft text-accent' : 'text-text-2 hover:bg-bg-elevated',
              ].join(' ')}
              style={{ textAlign: a.value }}
            >
              {a.value === 'left' ? '⟸' : a.value === 'right' ? '⟹' : '⟺'}
            </button>
          ))}
          <button
            type="button"
            onClick={() => set({ titleBold: !titleBold })}
            className={[
              'flex h-7 w-8 items-center justify-center rounded-[var(--radius-s)] font-bold',
              titleBold ? 'bg-accent-soft text-accent' : 'text-text-2 hover:bg-bg-elevated',
            ].join(' ')}
          >
            B
          </button>
          <button
            type="button"
            onClick={() => set({ titleItalic: !titleItalic })}
            className={[
              'flex h-7 w-8 items-center justify-center rounded-[var(--radius-s)] italic',
              titleItalic ? 'bg-accent-soft text-accent' : 'text-text-2 hover:bg-bg-elevated',
            ].join(' ')}
          >
            I
          </button>
        </div>
      </Field>
    </FieldStack>
  )
}

function SubtitleSection() {
  const subtitleColor  = useAppStore(s => s.subtitleColor)
  const karaokeEnabled = useAppStore(s => s.karaokeEnabled)
  const karaokeColor   = useAppStore(s => s.karaokeColor)
  const segmentsCount  = useAppStore(s => s.segments.length)
  const set = useAppStore(s => s.set)

  return (
    <FieldStack>
      <Field label="Color">
        <SwatchRow value={subtitleColor} swatches={palette('subtitle')} onChange={hex => set({ subtitleColor: hex })} />
      </Field>
      <Field label="Karaoke">
        <Toggle
          label="Karaoke highlight"
          checked={karaokeEnabled}
          disabled={segmentsCount === 0}
          disabledReason="Transcribe audio first (Captions mode)"
          onChange={v => set({ karaokeEnabled: v })}
        />
        {karaokeEnabled && segmentsCount > 0 && (
          <div className="mt-3">
            <SwatchRow value={karaokeColor} swatches={palette('karaoke')} onChange={hex => set({ karaokeColor: hex })} />
          </div>
        )}
      </Field>
      <button
        type="button"
        onClick={actions.setModeCaptions}
        className="text-left text-[11px] text-text-3 hover:text-text-2"
      >
        Edit caption text in Captions mode →
      </button>
    </FieldStack>
  )
}

function AvatarSection() {
  const zones = useAppStore(s => s.zones)
  const layoutTemplate = useAppStore(s => s.layoutTemplate)
  const { coverImagePath, pick, remove } = useCoverImage()

  const effectiveZones = zones ?? DEFAULT_ZONES[layoutTemplate]
  const az = effectiveZones.avatar

  return (
    <FieldStack>
      <Field label="Image">
        <CoverImageWell path={coverImagePath} onPick={pick} onRemove={remove} />
      </Field>
      {az && (
        <Field label="Position">
          <PositionReadout zone={az} />
        </Field>
      )}
    </FieldStack>
  )
}

function PositionReadout({ zone }: { zone: { x: number; y: number; w: number; h: number } }) {
  const cells: [string, number][] = [['X', zone.x], ['Y', zone.y], ['W', zone.w], ['H', zone.h]]
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {cells.map(([label, v]) => (
        <div key={label} className="rounded-[var(--radius-s)] border border-border bg-bg-app px-1.5 py-1 text-center">
          <div className="text-[9px] text-text-3">{label}</div>
          <div className="tabular text-[11px] text-text-1">{Math.round(v * 100)}%</div>
        </div>
      ))}
    </div>
  )
}

function CoverImageWell({ path, onPick, onRemove }: { path: string; onPick: () => void; onRemove: () => void }) {
  if (!path) {
    return (
      <button
        type="button"
        onClick={onPick}
        className="flex h-20 w-full flex-col items-center justify-center gap-1 rounded-[var(--radius-m)] border border-dashed border-border text-text-3 hover:border-text-3"
      >
        <span className="text-[18px]">🖼</span>
        <span className="text-[11px]">Add cover image · JPG PNG WEBP</span>
      </button>
    )
  }
  return (
    <div className="group relative h-20 w-full overflow-hidden rounded-[var(--radius-m)] border border-border">
      <img
        src={assetUrl(path)}
        alt="Cover"
        className="h-full w-full object-cover"
        onError={e => { (e.target as HTMLImageElement).style.opacity = '0.2' }}
      />
      <div className="absolute inset-0 flex items-center justify-center gap-2 bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
        <button type="button" onClick={onPick} className="rounded-[var(--radius-s)] bg-bg-elevated px-2 py-1 text-[11px] text-text-1">
          Replace
        </button>
        <button type="button" onClick={onRemove} className="rounded-[var(--radius-s)] bg-bg-elevated px-2 py-1 text-[11px] text-danger">
          Remove
        </button>
      </div>
    </div>
  )
}
