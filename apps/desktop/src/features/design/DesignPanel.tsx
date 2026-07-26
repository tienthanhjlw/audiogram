import { useRef, useState, type ReactNode } from 'react'
import { useAppStore } from '../../store'
import { templatePoint, wavePoint, type TemplateExtension, type WaveExtension } from '../../extensions'
import { renderTemplateThumb } from '../preview/thumbnailer'
import { WaveMiniPreview } from '../preview/WaveMiniPreview'
import { Button, Popover } from '../../ui'
import type { LayoutTemplate, WaveStyle } from '../../types'

// features/design/DesignPanel.tsx — UI_DESIGN_SPEC.md §4.1: LEFT PANEL for
// Design mode. Two galleries (template, wave style), both rendering real
// output (thumbnailer.ts / WaveMiniPreview.tsx, P2-T3) rather than
// hand-drawn art — clicking either binds straight to the design slice.
export function DesignPanel() {
  const layoutTemplate = useAppStore(s => s.layoutTemplate)
  const waveStyle      = useAppStore(s => s.waveStyle)
  const waveColor      = useAppStore(s => s.waveColor)
  const bgColor        = useAppStore(s => s.bgColor)
  const zones          = useAppStore(s => s.zones)
  const applyTemplate  = useAppStore(s => s.applyTemplate)
  const set            = useAppStore(s => s.set)
  const selectEl       = useAppStore(s => s.selectEl)

  const currentExt = templatePoint.get(`com.audiogram.template.${layoutTemplate}`)
  const isCustomized = zones !== null || (
    !!currentExt && (waveColor !== currentExt.defaults.waveColor || bgColor !== currentExt.defaults.bgColor)
  )

  const switchTemplate = (id: LayoutTemplate) => {
    applyTemplate(id)
    selectEl(null)
  }

  return (
    <div className="flex flex-col gap-6 p-4">
      <GallerySection label="Template">
        <div className="grid grid-cols-2 gap-2">
          {templatePoint.list().map(ext => {
            const id = templateIdOf(ext)
            return (
              <TemplateCard
                key={ext.manifest.id}
                ext={ext}
                id={id}
                selected={id === layoutTemplate}
                confirmSwitch={isCustomized}
                onSwitch={() => switchTemplate(id)}
              />
            )
          })}
        </div>
      </GallerySection>

      <GallerySection label="Wave style">
        <div className="grid grid-cols-2 gap-2">
          {wavePoint.list().map(ext => {
            const id = waveIdOf(ext)
            return (
              <WaveCard
                key={ext.manifest.id}
                ext={ext}
                selected={id === waveStyle}
                onSelect={() => set({ waveStyle: id })}
              />
            )
          })}
        </div>
      </GallerySection>
    </div>
  )
}

function templateIdOf(ext: TemplateExtension): LayoutTemplate {
  return ext.manifest.id.replace('com.audiogram.template.', '') as LayoutTemplate
}
function waveIdOf(ext: WaveExtension): WaveStyle {
  return ext.rustId as WaveStyle
}

function GallerySection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-3">{label}</div>
      {children}
    </section>
  )
}

interface TemplateCardProps {
  ext: TemplateExtension
  id: LayoutTemplate
  selected: boolean
  confirmSwitch: boolean
  onSwitch: () => void
}

function TemplateCard({ ext, id, selected, confirmSwitch, onSwitch }: TemplateCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)

  const handleClick = () => {
    if (selected) return
    if (confirmSwitch) setConfirmOpen(true)
    else onSwitch()
  }

  return (
    <div className="relative">
      <button
        ref={anchorRef}
        type="button"
        onClick={handleClick}
        className={[
          'flex w-full flex-col overflow-hidden rounded-[var(--radius-s)] border text-left transition-colors',
          selected ? 'border-[1.5px] border-accent' : 'border-border hover:border-text-3',
        ].join(' ')}
      >
        <div className="relative aspect-video w-full bg-bg-elevated">
          <img src={renderTemplateThumb(id)} alt={ext.manifest.label} className="h-full w-full object-cover" />
          {selected && (
            <span className="absolute right-1 top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-accent text-[9px] text-text-1">✓</span>
          )}
        </div>
        <div className="px-2 py-1.5">
          <div className="text-[12px] font-semibold text-text-1">{ext.manifest.label}</div>
          <div className="text-[9px] text-text-3">{ext.tags.join(' · ')}</div>
        </div>
      </button>

      <Popover anchorRef={anchorRef} open={confirmOpen} onClose={() => setConfirmOpen(false)}>
        <div className="w-[220px] p-3">
          <p className="text-[12px] leading-relaxed text-text-2">
            Switching template resets layout &amp; colors.
          </p>
          <div className="mt-2.5 flex justify-end gap-1.5">
            <Button variant="ghost" size="sm" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={() => { setConfirmOpen(false); onSwitch() }}>Switch</Button>
          </div>
        </div>
      </Popover>
    </div>
  )
}

function WaveCard({ ext, selected, onSelect }: { ext: WaveExtension; selected: boolean; onSelect: () => void }) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'flex w-full flex-col gap-1 rounded-[var(--radius-s)] border p-1.5 text-center transition-colors',
        selected ? 'border-[1.5px] border-accent' : 'border-border hover:border-text-3',
      ].join(' ')}
    >
      <div className="h-11 w-full overflow-hidden rounded-[4px] bg-bg-elevated">
        <WaveMiniPreview extensionId={ext.manifest.id} />
      </div>
      <span className="text-[11px] font-medium text-text-1">{ext.manifest.label}</span>
    </button>
  )
}
