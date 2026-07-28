// features/design/NodeInspector.tsx — P5-T7 (props) + P5-T8 (timing).
// Property editor for the currently-selected scene node
// (store.selectedNodeIds[0]). A trimmed-down sibling of DesignInspector.tsx
// (which still drives the legacy 6-template fields) — this one edits
// `node.props`/`node.transform`/`node.timing`/`node.animIn`/`node.animOut`
// directly. Renders nothing when no node is selected or more than one is
// (multi-select property editing isn't in scope until a real need shows up).
import { useAppStore } from '../../store'
import { palettePoint } from '../../extensions'
import { Field, Input, Select, SwatchRow, Toggle } from '../../ui'
import type { AnimationId, ImageFit, ImageShape, SceneNode, TextAlign } from '../../types'

function palette(id: string) {
  return palettePoint.get(`com.audiogram.palette.${id}`)?.colors ?? []
}

const TEXT_ALIGN_OPTIONS: { value: TextAlign; label: string }[] = [
  { value: 'left', label: 'Left' }, { value: 'center', label: 'Center' }, { value: 'right', label: 'Right' },
]
const IMAGE_FIT_OPTIONS: { value: ImageFit; label: string }[] = [
  { value: 'cover', label: 'Cover' }, { value: 'contain', label: 'Contain' },
]
const IMAGE_SHAPE_OPTIONS: { value: ImageShape; label: string }[] = [
  { value: 'rect', label: 'Rectangle' }, { value: 'circle', label: 'Circle' }, { value: 'rounded', label: 'Rounded' },
]
const ANIM_PRESET_OPTIONS: { value: AnimationId | ''; label: string }[] = [
  { value: '', label: 'None' },
  { value: 'fade', label: 'Fade' },
  { value: 'slide-up', label: 'Slide up' },
  { value: 'slide-down', label: 'Slide down' },
  { value: 'scale-in', label: 'Scale in' },
]

function PropsSection({ node }: { node: SceneNode }) {
  const updateNodeProps = useAppStore(s => s.updateNodeProps)
  if (!node.props) return null

  if (node.props.type === 'text') {
    const p = node.props
    return (
      <section className="flex flex-col gap-3 border-t border-border pt-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-3">Text</div>
        <Field label="Content">
          <Input value={p.text} onChange={e => updateNodeProps(node.id, { text: e.target.value })} />
        </Field>
        <Field label="Color">
          <SwatchRow value={p.color} swatches={palette('wave')} onChange={color => updateNodeProps(node.id, { color })} />
        </Field>
        <Field label="Align">
          <Select value={p.align} onChange={align => updateNodeProps(node.id, { align: align as TextAlign })} options={TEXT_ALIGN_OPTIONS} />
        </Field>
        <Field label="Size">
          <Input
            type="number"
            value={p.size}
            onChange={e => updateNodeProps(node.id, { size: Number(e.target.value) })}
          />
        </Field>
        <div className="flex gap-4">
          <Toggle checked={p.bold} onChange={bold => updateNodeProps(node.id, { bold })} label="Bold" />
          <Toggle checked={p.italic} onChange={italic => updateNodeProps(node.id, { italic })} label="Italic" />
        </div>
      </section>
    )
  }

  if (node.props.type === 'image') {
    const p = node.props
    return (
      <section className="flex flex-col gap-3 border-t border-border pt-3">
        <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-3">Image</div>
        <Field label="File path">
          <Input value={p.src} onChange={e => updateNodeProps(node.id, { src: e.target.value })} />
        </Field>
        <Field label="Fit">
          <Select value={p.fit} onChange={fit => updateNodeProps(node.id, { fit: fit as ImageFit })} options={IMAGE_FIT_OPTIONS} />
        </Field>
        <Field label="Shape">
          <Select
            value={p.shape ?? 'rect'}
            onChange={shape => updateNodeProps(node.id, { shape: shape as ImageShape })}
            options={IMAGE_SHAPE_OPTIONS}
          />
        </Field>
      </section>
    )
  }

  return null
}

/** P5-T8 — start/end (seconds) + animIn/animOut preset+duration. The real
 * drag-to-set UI is TimingTimeline.tsx (T9); these number fields exist so
 * the mechanism is fully wired/testable before that lands, and stay as the
 * precise-value fallback afterward (T9 syncs both ways with these fields). */
function TimingSection({ node }: { node: SceneNode }) {
  const updateNodeTiming = useAppStore(s => s.updateNodeTiming)
  const updateNodeAnim = useAppStore(s => s.updateNodeAnim)

  const hasTiming = !!node.timing
  const start = node.timing?.start ?? 0
  const end = node.timing?.end ?? 10

  const setTiming = (patch: Partial<{ start: number; end: number }>) => {
    const next = { start, end, ...patch }
    // Edge case (PHASE5_TASKS.md T8 step 4): end < start is invalid — clamp
    // end up to start instead of accepting an inverted window.
    if (next.end < next.start) next.end = next.start
    updateNodeTiming(node.id, next)
  }

  return (
    <section className="flex flex-col gap-3 border-t border-border pt-3">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold uppercase tracking-[0.05em] text-text-3">Timing</div>
        <Toggle
          checked={hasTiming}
          onChange={checked => updateNodeTiming(node.id, checked ? { start: 0, end: 10 } : undefined)}
          label="Limit to a time window"
        />
      </div>

      {hasTiming && (
        <>
          <div className="flex gap-3">
            <Field label="Start (s)" className="flex-1">
              <Input type="number" min={0} value={start} onChange={e => setTiming({ start: Number(e.target.value) })} />
            </Field>
            <Field label="End (s)" className="flex-1">
              <Input type="number" min={start} value={end} onChange={e => setTiming({ end: Number(e.target.value) })} />
            </Field>
          </div>

          {(['animIn', 'animOut'] as const).map(which => {
            const clip = node[which]
            const label = which === 'animIn' ? 'Enter' : 'Exit'
            return (
              <div key={which} className="flex gap-3">
                <Field label={`${label} effect`} className="flex-1">
                  <Select
                    value={clip?.preset ?? ''}
                    onChange={preset => updateNodeAnim(node.id, which, preset ? { preset: preset as AnimationId, duration: clip?.duration ?? 0.4 } : undefined)}
                    options={ANIM_PRESET_OPTIONS}
                  />
                </Field>
                {clip && (
                  <Field label="Duration (s)" className="w-24">
                    <Input
                      type="number" min={0.05} step={0.05}
                      value={clip.duration}
                      onChange={e => updateNodeAnim(node.id, which, { ...clip, duration: Number(e.target.value) })}
                    />
                  </Field>
                )}
              </div>
            )
          })}
        </>
      )}
    </section>
  )
}

export function NodeInspector() {
  const nodes = useAppStore(s => s.nodes)
  const selectedNodeIds = useAppStore(s => s.selectedNodeIds)

  if (selectedNodeIds.length !== 1) return null
  const node = nodes.find(n => n.id === selectedNodeIds[0])
  if (!node || !node.props) return null

  return (
    <>
      <PropsSection node={node} />
      <TimingSection node={node} />
    </>
  )
}
