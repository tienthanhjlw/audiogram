import { useCallback, useEffect, useRef, useState } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { Rnd } from 'react-rnd'
import {
  BG_COLORS, CANVAS_SIZES, CanvasSize,
  DEFAULT_ZONES, LAYOUT_TEMPLATES, LayoutTemplate, LayoutZone,
  LayoutZones, WAVE_COLORS, WAVE_STYLES, WaveStyle,
} from '../types'
import WaveformCanvas from './WaveformCanvas'
import { useAppStore } from '../store'

type SelectedEl = 'wave' | 'title' | 'subtitle' | 'avatar' | null

type ZoneKey = keyof LayoutZones

const ZONE_TO_EL: Partial<Record<ZoneKey, Exclude<SelectedEl, null>>> = {
  waveform: 'wave', title: 'title', subtitle: 'subtitle', avatar: 'avatar',
}

const EL_META: Record<Exclude<SelectedEl, null>, { label: string; color: string }> = {
  wave:     { label: 'Waveform', color: '#6C4FF6' },
  title:    { label: 'Title',    color: '#F59E0B' },
  subtitle: { label: 'Subtitle', color: '#22C55E' },
  avatar:   { label: 'Avatar',   color: '#EC4FC4' },
}

export default function StepLayout() {
  const audioPath      = useAppStore(s => s.audioPath)
  const title          = useAppStore(s => s.title)
  const waveStyle      = useAppStore(s => s.waveStyle)
  const waveColor      = useAppStore(s => s.waveColor)
  const bgColor        = useAppStore(s => s.bgColor)
  const canvasSize     = useAppStore(s => s.canvasSize)
  const layoutTemplate = useAppStore(s => s.layoutTemplate)
  const coverImagePath = useAppStore(s => s.coverImagePath)
  const fps            = useAppStore(s => s.fps)
  const fontSize       = useAppStore(s => s.fontSize)
  const fontName       = useAppStore(s => s.fontName)
  const karaokeEnabled = useAppStore(s => s.karaokeEnabled)
  const karaokeColor   = useAppStore(s => s.karaokeColor)
  const subtitleColor  = useAppStore(s => s.subtitleColor)
  const zones          = useAppStore(s => s.zones)
  const titleColor     = useAppStore(s => s.titleColor)
  const titleAlign     = useAppStore(s => s.titleAlign)
  const titleBold      = useAppStore(s => s.titleBold)
  const titleItalic    = useAppStore(s => s.titleItalic)
  const set            = useAppStore(s => s.set)
  const next           = useAppStore(s => s.next)
  const back           = useAppStore(s => s.back)

  const containerRef    = useRef<HTMLDivElement>(null)
  const titleEditRef    = useRef<HTMLDivElement>(null)
  const titleDraggedRef = useRef(false)
  const [containerSize, setContainerSize] = useState({ w: 1, h: 1 })
  const [selectedEl, setSelectedEl]       = useState<SelectedEl>(null)
  const [hoveredZone, setHoveredZone]     = useState<ZoneKey | null>(null)
  const [editingTitle, setEditingTitle]   = useState(false)

  const effectiveZones = zones ?? DEFAULT_ZONES[layoutTemplate]
  const template       = LAYOUT_TEMPLATES.find(t => t.id === layoutTemplate)!
  const ratio          = CANVAS_SIZES[canvasSize].w / CANVAS_SIZES[canvasSize].h

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setContainerSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!editingTitle) return
    const el = titleEditRef.current
    if (!el) return
    el.textContent = title
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingTitle])

  const exitTitleEdit = useCallback(() => setEditingTitle(false), [])

  const handleTemplateChange = useCallback((id: LayoutTemplate) => {
    const tDef = LAYOUT_TEMPLATES.find(t => t.id === id)!
    set({
      layoutTemplate: id,
      zones: null,
      waveColor: tDef.defaultWaveColor,
      bgColor: tDef.defaultBgColor,
      waveStyle: tDef.defaultWaveStyle,
      karaokeEnabled: tDef.defaultKaraoke,
    })
    setSelectedEl(null)
  }, [set])

  const pickCoverImage = useCallback(async () => {
    const file = await open({
      multiple: false,
      filters: [{ name: 'Image', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] }],
    })
    if (!file) return
    set({ coverImagePath: String(file) })
  }, [set])

  const updateZone = useCallback((key: ZoneKey, patch: Partial<LayoutZone>) => {
    const current = effectiveZones[key]
    if (!current) return
    set({ zones: { ...effectiveZones, [key]: { ...current, ...patch } } as LayoutZones })
  }, [effectiveZones, set])

  const navButtons = (
    <div style={{ display: 'flex', gap: 8, marginTop: 'auto', paddingTop: 12 }}>
      <button onClick={back} style={navBtnStyle('#F3F4F6', '#374151')}>← Back</button>
      <button onClick={next} style={{ ...navBtnStyle('#6C4FF6', '#fff'), flex: 2 }}>Next: Transcript →</button>
    </div>
  )

  return (
    <div className="fade-up" style={{ display: 'flex', gap: 20, height: '100%', minHeight: 0 }}>

      {/* ── Left panel ── */}
      <div style={{
        width: 296, flexShrink: 0,
        background: '#fff', borderRadius: 16, border: '1px solid #E5E7EB',
        padding: '16px 16px 20px', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 18,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}>
        {selectedEl === null ? (
          <GlobalPanel
            layoutTemplate={layoutTemplate}
            canvasSize={canvasSize}
            fps={fps}
            bgColor={bgColor}
            template={template}
            coverImagePath={coverImagePath}
            onTemplateChange={handleTemplateChange}
            onPickCover={pickCoverImage}
            onRemoveCover={() => set({ coverImagePath: '' })}
            onCanvasSize={s => set({ canvasSize: s })}
            onFps={f => set({ fps: f })}
            onBgColor={c => set({ bgColor: c })}
          />
        ) : (
          <InspectorPanel
            selectedEl={selectedEl}
            waveStyle={waveStyle}
            waveColor={waveColor}
            titleColor={titleColor}
            titleAlign={titleAlign}
            titleBold={titleBold}
            titleItalic={titleItalic}
            fontSize={fontSize}
            fontName={fontName}
            subtitleColor={subtitleColor}
            karaokeEnabled={karaokeEnabled}
            karaokeColor={karaokeColor}
            coverImagePath={coverImagePath}
            onBack={() => setSelectedEl(null)}
            onPickCover={pickCoverImage}
            onChange={set}
          />
        )}
        {navButtons}
      </div>

      {/* ── Right: Preview + zone editor ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Layout Preview
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>
            {selectedEl ? `Editing ${EL_META[selectedEl].label} · drag to move` : 'Click a zone to inspect'}
          </span>
          {zones && (
            <button onClick={() => { set({ zones: null }); setSelectedEl(null) }} style={{
              fontSize: 11, color: '#6C4FF6', background: 'none',
              border: '1px solid #C4B5FD', borderRadius: 5,
              padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit',
            }}>Reset layout</button>
          )}
        </div>

        {/* Canvas + overlays — onMouseDown (not onClick) so zone's stopPropagation works */}
        <div
          onMouseDown={() => { setSelectedEl(null); setEditingTitle(false) }}
          style={{
            flex: 1, background: 'linear-gradient(135deg, #1a0f3a 0%, #0f0a1e 100%)',
            borderRadius: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
            overflow: 'hidden', minHeight: 0,
          }}
        >
          <div style={{
            aspectRatio: String(ratio),
            width: ratio >= 1 ? '80%' : undefined,
            height: ratio < 1 ? '85%' : undefined,
            maxWidth: ratio >= 1 ? '80%' : undefined,
            position: 'relative', borderRadius: 10, overflow: 'hidden',
            boxShadow: '0 16px 56px rgba(0,0,0,0.55)',
          }}>
            <WaveformCanvas
              audioPath={audioPath}
              color={waveColor}
              bgColor={bgColor}
              waveStyle={waveStyle}
              title={editingTitle ? '' : (title || 'Lorem ipsum dolor')}
              canvasRatio={ratio}
              segments={[]}
              onPeaksReady={peaks => set({ peaks })}
              fontSize={fontSize}
              fontName={fontName}
              karaokeEnabled={false}
              karaokeColor={karaokeColor}
              layoutTemplate={layoutTemplate}
              coverImagePath={coverImagePath}
              subtitleYPct={null}
              zones={effectiveZones}
              titleColor={titleColor}
              titleAlign={titleAlign}
              titleBold={titleBold}
              titleItalic={titleItalic}
              subtitlePreview={!!effectiveZones.subtitle}
            />

            {/* Zone overlays */}
            <div ref={containerRef} style={{ position: 'absolute', inset: 0 }}>
              {(Object.keys(effectiveZones) as ZoneKey[]).map(key => {
                const zone = effectiveZones[key]
                if (!zone) return null
                const el   = ZONE_TO_EL[key]
                if (!el) return null
                const meta = EL_META[el]
                const sel  = selectedEl === el
                const hov  = hoveredZone === key
                const { w: cW, h: cH } = containerSize
                const isTitleZone = el === 'title'

                return (
                  <Rnd
                    key={key}
                    bounds="parent"
                    position={{ x: zone.x * cW, y: zone.y * cH }}
                    size={{ width: zone.w * cW, height: zone.h * cH }}
                    minWidth={cW * 0.05}
                    minHeight={cH * 0.04}
                    enableResizing={sel && !editingTitle}
                    onMouseDown={e => {
                      e.stopPropagation()
                      setSelectedEl(el)
                      if (isTitleZone) {
                        titleDraggedRef.current = false
                        if (editingTitle) setEditingTitle(false)
                      }
                    }}
                    onDrag={() => { if (isTitleZone) titleDraggedRef.current = true }}
                    onDragStop={(_, d) => {
                      if (isTitleZone && !titleDraggedRef.current) {
                        setEditingTitle(true)
                      } else {
                        updateZone(key, {
                          x: Math.max(0, Math.min(1 - zone.w, d.x / cW)),
                          y: Math.max(0, Math.min(1 - zone.h, d.y / cH)),
                        })
                      }
                    }}
                    onResizeStop={(_, __, ref, ___, pos) => {
                      set({ zones: { ...effectiveZones, [key]: {
                        x: pos.x / cW,
                        y: pos.y / cH,
                        w: ref.offsetWidth  / cW,
                        h: ref.offsetHeight / cH,
                      } } as LayoutZones })
                    }}
                    onMouseEnter={() => setHoveredZone(key)}
                    onMouseLeave={() => setHoveredZone(null)}
                    style={{
                      border: sel
                        ? `2px solid ${meta.color}`
                        : hov
                          ? `2px dashed ${meta.color}88`
                          : '2px solid transparent',
                      background: sel ? `${meta.color}08` : hov ? `${meta.color}05` : 'transparent',
                      borderRadius: 5,
                      boxSizing: 'border-box',
                      zIndex: sel ? 10 : hov ? 5 : 1,
                      cursor: editingTitle && isTitleZone ? 'text' : 'move',
                    }}
                  >
                    {(sel || hov) && !editingTitle && (
                      <div style={{
                        position: 'absolute', top: 3, left: 3,
                        background: meta.color, borderRadius: 3,
                        padding: '1px 5px', fontSize: 9, color: '#fff', fontWeight: 700,
                        whiteSpace: 'nowrap', pointerEvents: 'none', opacity: 0.9,
                      }}>
                        {meta.label}{isTitleZone ? ' · click to edit' : ''}
                      </div>
                    )}
                  </Rnd>
                )
              })}
            </div>

            {/* Inline title editor — click on title zone to activate */}
            {editingTitle && (() => {
              const tz = effectiveZones.title
              const fSize = Math.round(containerSize.h * 0.058 * (fontSize / 100))
              const justifyMap = { left: 'flex-start', center: 'center', right: 'flex-end' } as const
              return (
                <div
                  onMouseDown={e => e.stopPropagation()}
                  style={{
                    position: 'absolute',
                    left: `${tz.x * 100}%`, top: `${tz.y * 100}%`,
                    width: `${tz.w * 100}%`, height: `${tz.h * 100}%`,
                    display: 'flex', alignItems: 'center',
                    justifyContent: justifyMap[titleAlign],
                    padding: '0 4px', zIndex: 20, boxSizing: 'border-box',
                  }}
                >
                  <div
                    ref={titleEditRef}
                    contentEditable
                    suppressContentEditableWarning
                    onInput={e => set({ title: e.currentTarget.textContent ?? '' })}
                    onKeyDown={e => {
                      e.stopPropagation()
                      if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); exitTitleEdit() }
                    }}
                    onBlur={exitTitleEdit}
                    style={{
                      minWidth: 40, maxWidth: '100%',
                      color: titleColor,
                      fontSize: fSize,
                      fontWeight: titleBold ? 700 : 400,
                      fontStyle: titleItalic ? 'italic' : 'normal',
                      fontFamily: `'${fontName}', Arial, sans-serif`,
                      textAlign: titleAlign,
                      lineHeight: 1.4,
                      outline: 'none',
                      wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                      cursor: 'text', padding: '3px 6px', borderRadius: 4,
                      background: 'rgba(0,0,0,0.30)',
                      boxShadow: `0 0 0 1.5px ${EL_META.title.color}99`,
                      caretColor: titleColor,
                    }}
                  />
                </div>
              )
            })()}
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

interface GlobalPanelProps {
  layoutTemplate: LayoutTemplate
  canvasSize: CanvasSize
  fps: number
  bgColor: string
  template: typeof LAYOUT_TEMPLATES[number]
  coverImagePath: string
  onTemplateChange: (id: LayoutTemplate) => void
  onPickCover: () => void
  onRemoveCover: () => void
  onCanvasSize: (s: CanvasSize) => void
  onFps: (f: number) => void
  onBgColor: (c: string) => void
}

function GlobalPanel({
  layoutTemplate, canvasSize, fps, bgColor, template,
  coverImagePath, onTemplateChange, onPickCover, onRemoveCover,
  onCanvasSize, onFps, onBgColor,
}: GlobalPanelProps) {
  return (
    <>
      <Section label="Template">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {LAYOUT_TEMPLATES.map(t => {
            const active = layoutTemplate === t.id
            return (
              <button key={t.id} onClick={() => onTemplateChange(t.id)} style={{
                padding: '8px 10px', borderRadius: 8, textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer',
                border: `1.5px solid ${active ? '#6C4FF6' : '#E5E7EB'}`,
                background: active ? '#EDE9FF' : '#F9FAFB',
              }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: active ? '#6C4FF6' : '#374151' }}>{t.name}</div>
                <div style={{ fontSize: 10, color: '#9CA3AF', marginTop: 2, lineHeight: 1.3 }}>{t.desc}</div>
              </button>
            )
          })}
        </div>
      </Section>

      {template.needsAvatar && (
        <Section label="Cover image">
          <div onClick={onPickCover} style={{
            border: '1.5px dashed #E5E7EB', borderRadius: 10, cursor: 'pointer', overflow: 'hidden',
            minHeight: 72, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 6,
            background: '#F9FAFB',
          }}>
            {coverImagePath ? (
              <img
                src={convertFileSrc(coverImagePath)}
                style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }}
                onError={e => { (e.target as HTMLImageElement).style.opacity = '0.2' }}
              />
            ) : (
              <>
                <span style={{ fontSize: 22 }}>🖼</span>
                <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>Add cover image</div>
                <div style={{ fontSize: 10, color: '#9CA3AF' }}>JPG · PNG · WEBP</div>
              </>
            )}
          </div>
          {coverImagePath && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <button onClick={onPickCover} style={linkBtnStyle}>Change image</button>
              <button onClick={onRemoveCover} style={{ ...linkBtnStyle, color: '#EF4444' }}>Remove</button>
            </div>
          )}
        </Section>
      )}

      <Section label="Background">
        <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
          {BG_COLORS.map(c => (
            <Swatch key={c.hex} hex={c.hex} selected={bgColor === c.hex} onClick={() => onBgColor(c.hex)} ring="#6C4FF6" />
          ))}
          <input type="color" value={bgColor} onChange={e => onBgColor(e.target.value)} style={colorInputStyle} title="Custom" />
        </div>
      </Section>

      <Section label="Canvas size">
        {(['16:9', '1:1', '9:16'] as CanvasSize[]).map(size => {
          const info = CANVAS_SIZES[size]
          const active = canvasSize === size
          return (
            <button key={size} onClick={() => onCanvasSize(size)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '8px 12px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
              border: `1.5px solid ${active ? '#6C4FF6' : '#E5E7EB'}`,
              background: active ? '#EDE9FF' : '#F9FAFB',
              marginBottom: 5, width: '100%',
            }}>
              <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? '#6C4FF6' : '#374151' }}>{info.label}</span>
              <span style={{ fontSize: 10, color: '#9CA3AF' }}>{info.w}×{info.h}</span>
            </button>
          )
        })}
      </Section>

      <Section label="Frame rate">
        <div style={{ display: 'flex', gap: 6 }}>
          {[24, 30, 60].map(f => (
            <button key={f} onClick={() => onFps(f)} style={{
              flex: 1, padding: '7px 0', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
              border: `1.5px solid ${fps === f ? '#6C4FF6' : '#E5E7EB'}`,
              background: fps === f ? '#EDE9FF' : '#F9FAFB',
              fontSize: 12, fontWeight: fps === f ? 600 : 400,
              color: fps === f ? '#6C4FF6' : '#374151',
            }}>{f} fps</button>
          ))}
        </div>
      </Section>
    </>
  )
}

interface InspectorPanelProps {
  selectedEl: Exclude<SelectedEl, null>
  waveStyle: WaveStyle
  waveColor: string
  titleColor: string
  titleAlign: 'left' | 'center' | 'right'
  titleBold: boolean
  titleItalic: boolean
  fontSize: number
  fontName: string
  subtitleColor: string
  karaokeEnabled: boolean
  karaokeColor: string
  coverImagePath: string
  onBack: () => void
  onPickCover: () => void
  onChange: (patch: Record<string, unknown>) => void
}

function InspectorPanel({
  selectedEl, waveStyle, waveColor, titleColor, titleAlign, titleBold, titleItalic,
  fontSize, fontName, subtitleColor, karaokeEnabled, karaokeColor,
  coverImagePath, onBack, onPickCover, onChange,
}: InspectorPanelProps) {
  const meta = EL_META[selectedEl]

  return (
    <>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <button onClick={onBack} style={{
          background: 'none', border: '1px solid #E5E7EB', borderRadius: 6,
          padding: '4px 8px', cursor: 'pointer', fontSize: 12, color: '#6B7280',
          fontFamily: 'inherit',
        }}>←</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 8, height: 8, borderRadius: 2, background: meta.color, flexShrink: 0 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{meta.label}</span>
        </div>
      </div>

      {selectedEl === 'wave' && (
        <>
          <Section label="Wave style">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
              {WAVE_STYLES.map(ws => {
                const active = waveStyle === ws.id
                return (
                  <button key={ws.id} onClick={() => onChange({ waveStyle: ws.id as WaveStyle })} style={{
                    padding: '7px 10px', borderRadius: 7, textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer',
                    border: `1.5px solid ${active ? '#6C4FF6' : '#E5E7EB'}`,
                    background: active ? '#EDE9FF' : '#F9FAFB',
                  }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: active ? '#6C4FF6' : '#374151' }}>{ws.label}</div>
                    <div style={{ fontSize: 10, color: '#9CA3AF' }}>{ws.desc}</div>
                  </button>
                )
              })}
            </div>
          </Section>
          <Section label="Wave color">
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              {WAVE_COLORS.map(c => (
                <Swatch key={c.hex} hex={c.hex} selected={waveColor === c.hex} onClick={() => onChange({ waveColor: c.hex })} ring="#111827" />
              ))}
              <input type="color" value={waveColor} onChange={e => onChange({ waveColor: e.target.value })} style={colorInputStyle} title="Custom" />
            </div>
          </Section>
        </>
      )}

      {selectedEl === 'title' && (
        <>
          <Section label="Title color">
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              {WAVE_COLORS.map(c => (
                <Swatch key={c.hex} hex={c.hex} selected={titleColor === c.hex} onClick={() => onChange({ titleColor: c.hex })} ring="#111827" />
              ))}
              <input type="color" value={titleColor} onChange={e => onChange({ titleColor: e.target.value })} style={colorInputStyle} title="Custom" />
            </div>
          </Section>
          <Section label="Font">
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
              {(['Arial', 'Georgia', 'Impact', 'Verdana'] as const).map(f => (
                <button key={f} onClick={() => onChange({ fontName: f })} style={{
                  padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                  border: `1.5px solid ${fontName === f ? '#6C4FF6' : '#E5E7EB'}`,
                  background: fontName === f ? '#EDE9FF' : '#F9FAFB',
                  fontFamily: f, fontSize: 12,
                  color: fontName === f ? '#6C4FF6' : '#374151',
                  fontWeight: fontName === f ? 600 : 400,
                }}>{f}</button>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: '#6B7280' }}>Size</span>
              <span style={{ fontSize: 11, color: '#374151', fontWeight: 500 }}>{fontSize}%</span>
            </div>
            <input type="range" min={70} max={140} step={5} value={fontSize}
              onChange={e => onChange({ fontSize: Number(e.target.value) })}
              style={{ width: '100%', accentColor: '#6C4FF6' }} />
          </Section>
          <Section label="Formatting">
            <div style={{ display: 'flex', gap: 6 }}>
              {(['left', 'center', 'right'] as const).map(align => (
                <button key={align} onClick={() => onChange({ titleAlign: align })} style={{
                  flex: 1, padding: '6px 0', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
                  border: `1.5px solid ${titleAlign === align ? '#6C4FF6' : '#E5E7EB'}`,
                  background: titleAlign === align ? '#EDE9FF' : '#F9FAFB',
                  fontSize: 13, color: titleAlign === align ? '#6C4FF6' : '#374151',
                }}>
                  {align === 'left' ? '⬅' : align === 'center' ? '↔' : '➡'}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
              <button onClick={() => onChange({ titleBold: !titleBold })} style={{
                flex: 1, padding: '6px 0', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
                border: `1.5px solid ${titleBold ? '#6C4FF6' : '#E5E7EB'}`,
                background: titleBold ? '#EDE9FF' : '#F9FAFB',
                fontSize: 13, fontWeight: 700, color: titleBold ? '#6C4FF6' : '#374151',
              }}>B</button>
              <button onClick={() => onChange({ titleItalic: !titleItalic })} style={{
                flex: 1, padding: '6px 0', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
                border: `1.5px solid ${titleItalic ? '#6C4FF6' : '#E5E7EB'}`,
                background: titleItalic ? '#EDE9FF' : '#F9FAFB',
                fontSize: 13, fontStyle: 'italic', color: titleItalic ? '#6C4FF6' : '#374151',
              }}>I</button>
            </div>
          </Section>
        </>
      )}

      {selectedEl === 'subtitle' && (
        <>
          <Section label="Subtitle color">
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
              {WAVE_COLORS.map(c => (
                <Swatch key={c.hex} hex={c.hex} selected={subtitleColor === c.hex} onClick={() => onChange({ subtitleColor: c.hex })} ring="#111827" />
              ))}
              <input type="color" value={subtitleColor} onChange={e => onChange({ subtitleColor: e.target.value })} style={colorInputStyle} title="Custom" />
            </div>
          </Section>
          <Section label="Karaoke">
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox" checked={karaokeEnabled}
                onChange={e => onChange({ karaokeEnabled: e.target.checked })}
                style={{ accentColor: '#6C4FF6', width: 14, height: 14 }}
              />
              <span style={{ fontSize: 12, color: '#374151' }}>Karaoke highlight</span>
            </label>
            {karaokeEnabled && (
              <div style={{ marginTop: 8, display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                {['#FFD60A', '#EC4FC4', '#6C4FF6', '#22C55E', '#EF4444', '#FFFFFF'].map(c => (
                  <Swatch key={c} hex={c} selected={karaokeColor === c} onClick={() => onChange({ karaokeColor: c })} ring="#111827" />
                ))}
                <input type="color" value={karaokeColor} onChange={e => onChange({ karaokeColor: e.target.value })} style={colorInputStyle} title="Custom" />
              </div>
            )}
          </Section>
        </>
      )}

      {selectedEl === 'avatar' && (
        <Section label="Cover image">
          <div onClick={onPickCover} style={{
            border: '1.5px dashed #E5E7EB', borderRadius: 10, cursor: 'pointer', overflow: 'hidden',
            minHeight: 72, display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 6,
            background: '#F9FAFB',
          }}>
            {coverImagePath ? (
              <img
                src={convertFileSrc(coverImagePath)}
                style={{ width: '100%', height: 80, objectFit: 'cover', display: 'block' }}
                onError={e => { (e.target as HTMLImageElement).style.opacity = '0.2' }}
              />
            ) : (
              <>
                <span style={{ fontSize: 22 }}>🖼</span>
                <div style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>Add cover image</div>
              </>
            )}
          </div>
          {coverImagePath && (
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
              <button onClick={onPickCover} style={linkBtnStyle}>Change image</button>
              <button onClick={() => onChange({ coverImagePath: '' })} style={{ ...linkBtnStyle, color: '#EF4444' }}>Remove</button>
            </div>
          )}
        </Section>
      )}
    </>
  )
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 600, color: '#6B7280',
        textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8,
      }}>{label}</div>
      {children}
    </div>
  )
}

function Swatch({ hex, selected, onClick, ring }: { hex: string; selected: boolean; onClick: () => void; ring: string }) {
  return (
    <button onClick={onClick} style={{
      width: 26, height: 26, borderRadius: 6, background: hex, cursor: 'pointer',
      border: selected ? `2.5px solid ${ring}` : '2.5px solid transparent',
      boxShadow: selected ? `0 0 0 2px #fff, 0 0 0 4px ${ring}` : 'none',
      boxSizing: 'border-box', flexShrink: 0,
    }} />
  )
}

const colorInputStyle: React.CSSProperties = {
  width: 26, height: 26, borderRadius: 6, border: '1.5px solid #E5E7EB',
  padding: 2, cursor: 'pointer', boxSizing: 'border-box',
}

const linkBtnStyle: React.CSSProperties = {
  fontSize: 11, color: '#6C4FF6', background: 'none', border: 'none',
  cursor: 'pointer', fontFamily: 'inherit', padding: 0,
}

function navBtnStyle(bg: string, color: string): React.CSSProperties {
  return {
    flex: 1, background: bg, color, border: 'none',
    borderRadius: 9, padding: '10px 0', fontSize: 13, fontWeight: color === '#fff' ? 600 : 500,
    cursor: 'pointer', fontFamily: 'inherit',
  }
}
