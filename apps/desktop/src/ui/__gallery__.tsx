import { useRef, useState } from 'react'
import { Button } from './Button'
import { ContextMenu } from './ContextMenu'
import { Field, FieldStack } from './Field'
import { Input, Textarea } from './Input'
import { Modal } from './Modal'
import { ProgressBar } from './ProgressBar'
import { SegmentedControl } from './SegmentedControl'
import { Select } from './Select'
import { Slider } from './Slider'
import { SwatchRow } from './SwatchRow'
import { toast, ToastViewport } from './Toast'
import { Toggle } from './Toggle'
import { Tooltip } from './Tooltip'
import { WaveMiniPreview } from '../features/preview/WaveMiniPreview'
import { renderTemplateThumb } from '../features/preview/thumbnailer'
import { wavePoint } from '../extensions'
import { LAYOUT_TEMPLATES } from '../types'

// Temporary visual QA route — open with ?gallery=1. Not part of the app
// bundle's normal navigation; wired directly from main.tsx (T4/T5).
const WAVE_COLORS = [
  { hex: '#7C5CFF', name: 'Purple' },
  { hex: '#EC4FC4', name: 'Pink' },
  { hex: '#06B6D4', name: 'Cyan' },
  { hex: '#22C55E', name: 'Green' },
  { hex: '#FFFFFF', name: 'White' },
]

export default function UiGallery() {
  const [mode, setMode] = useState<'design' | 'captions'>('design')
  const [fontSize, setFontSize] = useState(100)
  const [showCaptions, setShowCaptions] = useState(true)
  const [karaoke, setKaraoke] = useState(false)
  const [model, setModel] = useState('base')
  const [waveColor, setWaveColor] = useState('#7C5CFF')
  const [title, setTitle] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [menu, setMenu] = useState<{ x: number; y: number } | null>(null)
  const contextTargetRef = useRef<HTMLDivElement>(null)

  return (
    <div className="min-h-screen bg-bg-app p-8 text-text-1">
      <h1 className="mb-8 text-xl font-semibold">UI Primitives Gallery</h1>

      <Section title="Button">
        <Row>
          <Button variant="primary">Primary</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="danger">Danger</Button>
        </Row>
        <Row>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button shortcutHint="⌘E">With shortcut</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
        </Row>
      </Section>

      <Section title="Field / FieldStack">
        <div className="w-64 rounded-[var(--radius-m)] bg-bg-panel p-4">
          <FieldStack>
            <Field label="Title">
              <input className="h-8 w-full rounded-[var(--radius-s)] border border-border bg-bg-app px-2 text-[13px] text-text-1" />
            </Field>
            <Field label="Wave style">
              <div className="text-[13px] text-text-2">Bars</div>
            </Field>
          </FieldStack>
        </div>
      </Section>

      <Section title="Tooltip (hover/focus, 400ms delay)">
        <Row>
          <Tooltip content="Export video" shortcut="⌘E">
            <Button variant="secondary">Hover me</Button>
          </Tooltip>
          <Tooltip content="Only available with the Karaoke template — switch templates in Design mode.">
            <Button variant="secondary">Long tooltip</Button>
          </Tooltip>
        </Row>
      </Section>

      <Section title="Toggle">
        <div className="flex w-72 flex-col gap-4">
          <Toggle checked={showCaptions} onChange={setShowCaptions} label="Show captions in export" />
          <Toggle
            checked={karaoke}
            onChange={setKaraoke}
            label="Karaoke highlight"
            subLabel="Text sweeps with audio progress"
          />
          <Toggle
            checked={false}
            onChange={() => {}}
            label="Karaoke highlight"
            disabled
            disabledReason="Only available with the Karaoke template."
          />
        </div>
      </Section>

      <Section title="Slider">
        <div className="w-64">
          <Slider value={fontSize} min={70} max={140} step={5} onChange={setFontSize} formatValue={v => `${v}%`} />
        </div>
      </Section>

      <Section title="SegmentedControl">
        <SegmentedControl
          value={mode}
          onChange={setMode}
          options={[
            { value: 'design', label: 'Design' },
            { value: 'captions', label: 'Captions' },
          ]}
        />
      </Section>

      <Section title="Select">
        <div className="w-40">
          <Select
            value={model}
            onChange={setModel}
            options={[
              { value: 'base', label: 'Base · 142 MB' },
              { value: 'small', label: 'Small · 466 MB' },
              { value: 'medium', label: 'Medium · 1.5 GB' },
            ]}
          />
        </div>
      </Section>

      <Section title="Input / Textarea">
        <div className="flex w-72 flex-col gap-3">
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Episode title" />
          <Textarea placeholder="Caption text — grows up to 4 lines" />
        </div>
      </Section>

      <Section title="SwatchRow">
        <SwatchRow value={waveColor} onChange={setWaveColor} swatches={WAVE_COLORS} />
      </Section>

      <Section title="ProgressBar">
        <div className="flex w-64 flex-col gap-3">
          <ProgressBar value={42} />
          <ProgressBar />
        </div>
      </Section>

      <Section title="Modal">
        <Row>
          <Button variant="secondary" onClick={() => setModalOpen(true)}>Open modal</Button>
        </Row>
        <Modal open={modalOpen} onClose={() => setModalOpen(false)} className="w-[360px] p-5">
          <div className="mb-2 text-[15px] font-semibold">Export video</div>
          <div className="mb-4 text-[13px] text-text-2">Sample modal content with a focus trap.</div>
          <Row>
            <Button variant="secondary" onClick={() => setModalOpen(false)}>Cancel</Button>
            <Button onClick={() => setModalOpen(false)}>Export</Button>
          </Row>
        </Modal>
      </Section>

      <Section title="ContextMenu">
        <div
          ref={contextTargetRef}
          onContextMenu={e => {
            e.preventDefault()
            setMenu({ x: e.clientX, y: e.clientY })
          }}
          className="flex h-16 w-72 items-center justify-center rounded-[var(--radius-m)] border border-dashed border-border text-[12px] text-text-3"
        >
          Right-click here
        </div>
        <ContextMenu
          open={!!menu}
          x={menu?.x ?? 0}
          y={menu?.y ?? 0}
          onClose={() => setMenu(null)}
          items={[
            { label: 'Play from here', onSelect: () => {} },
            { label: 'Split at playhead', onSelect: () => {} },
            { separator: true },
            { label: 'Delete', onSelect: () => {}, danger: true },
          ]}
        />
      </Section>

      <Section title="Toast">
        <Row>
          <Button variant="secondary" onClick={() => toast.info('Model download started')}>Info</Button>
          <Button variant="secondary" onClick={() => toast.success('Export complete')}>Success</Button>
          <Button variant="secondary" onClick={() => toast.error('Export failed')}>Error</Button>
        </Row>
      </Section>

      <Section title="Template thumbnails (P2-T3)">
        <div className="grid grid-cols-6 gap-3">
          {LAYOUT_TEMPLATES.map(t => (
            <div key={t.id} className="flex flex-col gap-1">
              <img
                src={renderTemplateThumb(t.id)}
                alt={t.name}
                className="aspect-video w-full rounded-[var(--radius-s)] border border-border object-cover"
              />
              <span className="text-center text-[11px] text-text-2">{t.name}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Wave style mini previews (P2-T3)">
        <div className="grid grid-cols-5 gap-3">
          {wavePoint.list().map(w => (
            <div key={w.manifest.id} className="flex flex-col gap-1">
              <div className="h-11 w-full overflow-hidden rounded-[var(--radius-s)] border border-border bg-bg-elevated">
                <WaveMiniPreview extensionId={w.manifest.id} />
              </div>
              <span className="text-center text-[11px] text-text-2">{w.manifest.label}</span>
            </div>
          ))}
        </div>
      </Section>

      <ToastViewport />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-3">{title}</h2>
      <div className="flex flex-col gap-3">{children}</div>
    </section>
  )
}

function Row({ children }: { children: React.ReactNode }) {
  return <div className="flex flex-wrap items-center gap-3">{children}</div>
}
