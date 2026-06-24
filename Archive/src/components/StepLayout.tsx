import { useCallback, useEffect, useRef, useState } from 'react'
import { convertFileSrc } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import { Rnd } from 'react-rnd'
import {
  AppState, BG_COLORS, CANVAS_SIZES, CanvasSize,
  DEFAULT_ZONES, LAYOUT_TEMPLATES, LayoutTemplate, LayoutZone,
  LayoutZones, WAVE_COLORS, WAVE_STYLES, WaveStyle,
} from '../types'
import WaveformCanvas from './WaveformCanvas'

interface Props {
  state: AppState
  onChange: (patch: Partial<AppState>) => void
  onBack: () => void
  onNext: () => void
}

type ZoneKey = keyof LayoutZones

const ZONE_META: Record<ZoneKey, { label: string; color: string }> = {
  waveform: { label: 'Waveform', color: '#6C4FF6' },
  title:    { label: 'Title',    color: '#F59E0B' },
  avatar:   { label: 'Avatar',   color: '#EC4FC4' },
}

export default function StepLayout({ state, onChange, onBack, onNext }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = useState({ w: 1, h: 1 })
  const [selectedZone, setSelectedZone]   = useState<ZoneKey | null>(null)

  const effectiveZones = state.zones ?? DEFAULT_ZONES[state.layoutTemplate]
  const template       = LAYOUT_TEMPLATES.find(t => t.id === state.layoutTemplate)!
  const ratio          = CANVAS_SIZES[state.canvasSize].w / CANVAS_SIZES[state.canvasSize].h
  const zoneKeys       = (Object.keys(effectiveZones) as ZoneKey[]).filter(k => effectiveZones[k] != null)

  // Track canvas container pixel size so we can convert fractions ↔ pixels for react-rnd
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

  const handleTemplateChange = useCallback((id: LayoutTemplate) => {
    const tDef = LAYOUT_TEMPLATES.find(t => t.id === id)!
    onChange({
      layoutTemplate: id,
      zones: null,
      waveColor: tDef.defaultWaveColor,
      bgColor: tDef.defaultBgColor,
      waveStyle: tDef.defaultWaveStyle,
      karaokeEnabled: tDef.defaultKaraoke,
    })
    setSelectedZone(null)
  }, [onChange])

  const pickCoverImage = useCallback(async () => {
    const file = await open({
      multiple: false,
      filters: [{ name: 'Image', extensions: ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'] }],
    })
    if (!file) return
    onChange({ coverImagePath: String(file) })
  }, [onChange])

  const updateZone = useCallback((key: ZoneKey, patch: Partial<LayoutZone>) => {
    const current = effectiveZones[key]
    if (!current) return
    onChange({ zones: { ...effectiveZones, [key]: { ...current, ...patch } } })
  }, [effectiveZones, onChange])

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

        {/* Template picker */}
        <Section label="Template">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {LAYOUT_TEMPLATES.map(t => {
              const active = state.layoutTemplate === t.id
              return (
                <button key={t.id} onClick={() => handleTemplateChange(t.id)} style={{
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

        {/* Cover image */}
        {template.needsAvatar && (
          <Section label="Cover image">
            <div onClick={pickCoverImage} style={{
              border: '1.5px dashed #E5E7EB', borderRadius: 10,
              cursor: 'pointer', overflow: 'hidden',
              minHeight: 72, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 6,
              background: '#F9FAFB', position: 'relative',
            }}>
              {state.coverImagePath ? (
                <img
                  src={convertFileSrc(state.coverImagePath)}
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
            {state.coverImagePath && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                <button onClick={pickCoverImage} style={linkBtnStyle}>Change image</button>
                <button onClick={() => onChange({ coverImagePath: '' })} style={{ ...linkBtnStyle, color: '#EF4444' }}>Remove</button>
              </div>
            )}
          </Section>
        )}

        {/* Wave style */}
        <Section label="Wave style">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
            {WAVE_STYLES.map(ws => {
              const active = state.waveStyle === ws.id
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

        {/* Wave color */}
        <Section label="Wave color">
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            {WAVE_COLORS.map(c => (
              <Swatch key={c.hex} hex={c.hex} selected={state.waveColor === c.hex} onClick={() => onChange({ waveColor: c.hex })} ring="#111827" />
            ))}
            <input type="color" value={state.waveColor} onChange={e => onChange({ waveColor: e.target.value })} style={colorInputStyle} title="Custom" />
          </div>
        </Section>

        {/* Background color */}
        <Section label="Background">
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
            {BG_COLORS.map(c => (
              <Swatch key={c.hex} hex={c.hex} selected={state.bgColor === c.hex} onClick={() => onChange({ bgColor: c.hex })} ring="#6C4FF6" />
            ))}
            <input type="color" value={state.bgColor} onChange={e => onChange({ bgColor: e.target.value })} style={colorInputStyle} title="Custom" />
          </div>
        </Section>

        {/* Canvas size */}
        <Section label="Canvas size">
          {(['16:9', '1:1', '9:16'] as CanvasSize[]).map(size => {
            const info = CANVAS_SIZES[size]
            const active = state.canvasSize === size
            return (
              <button key={size} onClick={() => onChange({ canvasSize: size })} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
                border: `1.5px solid ${active ? '#6C4FF6' : '#E5E7EB'}`,
                background: active ? '#EDE9FF' : '#F9FAFB',
                marginBottom: 5,
              }}>
                <span style={{ fontSize: 12, fontWeight: active ? 600 : 400, color: active ? '#6C4FF6' : '#374151' }}>{info.label}</span>
                <span style={{ fontSize: 10, color: '#9CA3AF' }}>{info.w}×{info.h}</span>
              </button>
            )
          })}
        </Section>

        {/* FPS */}
        <Section label="Frame rate">
          <div style={{ display: 'flex', gap: 6 }}>
            {[24, 30, 60].map(f => (
              <button key={f} onClick={() => onChange({ fps: f })} style={{
                flex: 1, padding: '7px 0', borderRadius: 7, cursor: 'pointer', fontFamily: 'inherit',
                border: `1.5px solid ${state.fps === f ? '#6C4FF6' : '#E5E7EB'}`,
                background: state.fps === f ? '#EDE9FF' : '#F9FAFB',
                fontSize: 12, fontWeight: state.fps === f ? 600 : 400,
                color: state.fps === f ? '#6C4FF6' : '#374151',
              }}>{f} fps</button>
            ))}
          </div>
        </Section>

        {/* Font */}
        <Section label="Font">
          <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
            {(['Arial', 'Georgia', 'Impact', 'Verdana'] as const).map(f => (
              <button key={f} onClick={() => onChange({ fontName: f })} style={{
                padding: '5px 10px', borderRadius: 6, cursor: 'pointer',
                border: `1.5px solid ${state.fontName === f ? '#6C4FF6' : '#E5E7EB'}`,
                background: state.fontName === f ? '#EDE9FF' : '#F9FAFB',
                fontFamily: f, fontSize: 12,
                color: state.fontName === f ? '#6C4FF6' : '#374151',
                fontWeight: state.fontName === f ? 600 : 400,
              }}>{f}</button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ fontSize: 11, color: '#6B7280' }}>Size</span>
            <span style={{ fontSize: 11, color: '#374151', fontWeight: 500 }}>{state.fontSize}%</span>
          </div>
          <input type="range" min={70} max={140} step={5} value={state.fontSize}
            onChange={e => onChange({ fontSize: Number(e.target.value) })}
            style={{ width: '100%', accentColor: '#6C4FF6' }} />
        </Section>

        <div style={{ flex: 1 }} />

        {/* Navigation */}
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onBack} style={{
            flex: 1, background: '#F3F4F6', color: '#374151', border: 'none',
            borderRadius: 9, padding: '10px 0', fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>← Back</button>
          <button onClick={onNext} style={{
            flex: 2, background: '#6C4FF6', color: '#fff', border: 'none',
            borderRadius: 9, padding: '10px 0', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>Next: Transcript →</button>
        </div>
      </div>

      {/* ── Right: Preview + zone editor ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10, minWidth: 0 }}>

        {/* Toolbar row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Layout Preview
          </span>
          <div style={{ flex: 1 }} />
          <span style={{ fontSize: 11, color: '#9CA3AF' }}>Drag zone boxes to reposition · corner to resize</span>
          {state.zones && (
            <button onClick={() => { onChange({ zones: null }); setSelectedZone(null) }} style={{
              fontSize: 11, color: '#6C4FF6', background: 'none',
              border: '1px solid #C4B5FD', borderRadius: 5,
              padding: '3px 8px', cursor: 'pointer', fontFamily: 'inherit',
            }}>Reset layout</button>
          )}
        </div>

        {/* Canvas + overlay */}
        <div
          onClick={() => setSelectedZone(null)}
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
            {/* Canvas rendering */}
            <WaveformCanvas
              audioPath={state.audioPath}
              color={state.waveColor}
              bgColor={state.bgColor}
              waveStyle={state.waveStyle}
              title={state.title || 'Lorem ipsum dolor'}
              canvasRatio={ratio}
              segments={[]}
              onPeaksReady={peaks => onChange({ peaks })}
              fontSize={state.fontSize}
              fontName={state.fontName}
              karaokeEnabled={false}
              karaokeColor={state.karaokeColor}
              layoutTemplate={state.layoutTemplate}
              coverImagePath={state.coverImagePath}
              subtitleYPct={null}
              zones={effectiveZones}
            />

            {/* Zone overlay — react-rnd handles drag + resize */}
            <div
              ref={containerRef}
              style={{ position: 'absolute', inset: 0 }}
            >
              {zoneKeys.map(key => {
                const zone = effectiveZones[key]
                if (!zone) return null
                const meta = ZONE_META[key]
                const sel  = selectedZone === key
                const { w: cW, h: cH } = containerSize

                return (
                  <Rnd
                    key={key}
                    bounds="parent"
                    position={{ x: zone.x * cW, y: zone.y * cH }}
                    size={{ width: zone.w * cW, height: zone.h * cH }}
                    minWidth={cW * 0.05}
                    minHeight={cH * 0.04}
                    onMouseDown={e => { e.stopPropagation(); setSelectedZone(key) }}
                    onDragStop={(_, d) => {
                      updateZone(key, {
                        x: Math.max(0, Math.min(1 - zone.w, d.x / cW)),
                        y: Math.max(0, Math.min(1 - zone.h, d.y / cH)),
                      })
                      onChange({ zones: { ...effectiveZones, [key]: { ...zone, x: Math.max(0, Math.min(1 - zone.w, d.x / cW)), y: Math.max(0, Math.min(1 - zone.h, d.y / cH)) } } })
                    }}
                    onResizeStop={(_, __, ref, ___, pos) => {
                      onChange({ zones: { ...effectiveZones, [key]: {
                        x: pos.x / cW,
                        y: pos.y / cH,
                        w: ref.offsetWidth  / cW,
                        h: ref.offsetHeight / cH,
                      } } })
                    }}
                    style={{
                      border: `2px solid ${meta.color}${sel ? 'FF' : '77'}`,
                      background: `${meta.color}${sel ? '1A' : '0D'}`,
                      borderRadius: 5,
                      boxSizing: 'border-box',
                      transition: sel ? 'none' : 'border-color 0.15s, background 0.15s',
                      zIndex: sel ? 10 : 1,
                    }}
                  >
                    {/* Drag handle label */}
                    <div style={{
                      position: 'absolute', top: 0, left: 0, right: 0, height: 18,
                      background: `${meta.color}${sel ? 'CC' : '99'}`,
                      borderRadius: '3px 3px 0 0',
                      display: 'flex', alignItems: 'center', padding: '0 6px', gap: 4,
                      cursor: 'grab', fontSize: 10, color: '#fff', fontWeight: 700,
                      pointerEvents: 'none',
                    }}>
                      <span style={{ fontSize: 8, opacity: 0.7, letterSpacing: '-1px' }}>⣿⣿</span>
                      <span style={{ fontSize: 9 }}>{meta.label}</span>
                    </div>

                    {/* Placeholder content */}
                    <div style={{
                      position: 'absolute', top: 20, left: 0, right: 0, bottom: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      overflow: 'hidden', pointerEvents: 'none',
                    }}>
                      <ZonePlaceholder label={meta.label} color={meta.color} />
                    </div>
                  </Rnd>
                )
              })}
            </div>
          </div>
        </div>

        {/* Zone info bar */}
        {selectedZone && effectiveZones[selectedZone] && (
          <ZoneInfoBar
            zoneKey={selectedZone}
            zone={effectiveZones[selectedZone]!}
            color={ZONE_META[selectedZone].color}
            onChange={newZone => onChange({ zones: { ...effectiveZones, [selectedZone]: newZone } })}
            onDeselect={() => setSelectedZone(null)}
          />
        )}
      </div>
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

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

function ZonePlaceholder({ label, color }: { label: string; color: string }) {
  if (label === 'Waveform') {
    return (
      <div style={{ display: 'flex', gap: 2, alignItems: 'flex-end', height: '50%', padding: '0 8px', opacity: 0.55 }}>
        {[0.4, 0.7, 0.5, 1.0, 0.6, 0.8, 0.35, 0.9, 0.55, 0.7, 0.45, 0.85].map((h, i) => (
          <div key={i} style={{ flex: 1, background: color, borderRadius: 2, height: `${h * 100}%` }} />
        ))}
      </div>
    )
  }
  if (label === 'Title') {
    return (
      <div style={{
        fontSize: 9, color, opacity: 0.7, padding: '0 10px',
        textAlign: 'center', fontStyle: 'italic', lineHeight: 1.5,
        overflow: 'hidden',
      }}>
        Lorem ipsum dolor sit amet
      </div>
    )
  }
  if (label === 'Avatar') {
    return (
      <div style={{
        width: 28, height: 28, borderRadius: '50%',
        background: color, opacity: 0.5,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="5" r="3" stroke="white" strokeWidth="1.2"/>
          <path d="M1 13c0-3.31 2.69-6 6-6s6 2.69 6 6" stroke="white" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
      </div>
    )
  }
  return null
}

interface ZoneInfoBarProps {
  zoneKey: ZoneKey
  zone: LayoutZone
  color: string
  onChange: (z: LayoutZone) => void
  onDeselect: () => void
}

function ZoneInfoBar({ zoneKey, zone, color, onChange, onDeselect }: ZoneInfoBarProps) {
  return (
    <div style={{
      background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB',
      padding: '8px 14px', display: 'flex', alignItems: 'center', gap: 12,
      flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <div style={{ width: 8, height: 8, borderRadius: 2, background: color, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', minWidth: 60 }}>
          {ZONE_META[zoneKey].label}
        </span>
      </div>
      {(['x', 'y', 'w', 'h'] as const).map(k => (
        <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, color: '#9CA3AF', textTransform: 'uppercase', width: 10 }}>{k}</span>
          <input
            type="number" min={0} max={1} step={0.01}
            value={Math.round(zone[k] * 100) / 100}
            onChange={e => {
              const v = Math.max(0, Math.min(1, Number(e.target.value)))
              onChange({ ...zone, [k]: v })
            }}
            style={{
              width: 52, padding: '3px 6px', fontSize: 11,
              border: '1px solid #E5E7EB', borderRadius: 5,
              fontFamily: 'monospace', color: '#374151', outline: 'none',
            }}
          />
        </label>
      ))}
      <div style={{ flex: 1 }} />
      <button onClick={onDeselect} style={{
        background: 'none', border: 'none', cursor: 'pointer',
        fontSize: 16, color: '#9CA3AF', lineHeight: 1, padding: 2,
      }}>×</button>
    </div>
  )
}
