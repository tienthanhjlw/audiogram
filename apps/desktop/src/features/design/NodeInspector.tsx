// features/design/NodeInspector.tsx — P5-T7. Property editor for the
// currently-selected scene node (store.selectedNodeIds[0]). A trimmed-down
// sibling of DesignInspector.tsx (which still drives the legacy 6-template
// fields) — this one edits `node.props`/`node.transform` directly. Renders
// nothing when no node is selected or more than one is (multi-select
// property editing isn't in scope until a real need shows up).
import { useAppStore } from '../../store'
import { palettePoint } from '../../extensions'
import { Field, Input, Select, SwatchRow, Toggle } from '../../ui'
import type { ImageFit, ImageShape, TextAlign } from '../../types'

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

export function NodeInspector() {
  const nodes = useAppStore(s => s.nodes)
  const selectedNodeIds = useAppStore(s => s.selectedNodeIds)
  const updateNodeProps = useAppStore(s => s.updateNodeProps)

  if (selectedNodeIds.length !== 1) return null
  const node = nodes.find(n => n.id === selectedNodeIds[0])
  if (!node || !node.props) return null

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
