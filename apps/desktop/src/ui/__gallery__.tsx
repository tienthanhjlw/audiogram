import { useState } from 'react'
import { Button } from './Button'
import { Field, FieldStack } from './Field'
import { SegmentedControl } from './SegmentedControl'
import { Slider } from './Slider'
import { Toggle } from './Toggle'
import { Tooltip } from './Tooltip'

// Temporary visual QA route — open with ?gallery=1. Not part of the app
// bundle's normal navigation; wired directly from main.tsx (T4/T5).
export default function UiGallery() {
  const [mode, setMode] = useState<'design' | 'captions'>('design')
  const [fontSize, setFontSize] = useState(100)
  const [showCaptions, setShowCaptions] = useState(true)
  const [karaoke, setKaraoke] = useState(false)

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
