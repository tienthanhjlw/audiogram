import { useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { convertFileSrc } from '@tauri-apps/api/core'
import {
  AppState, WAVE_COLORS, BG_COLORS, WAVE_STYLES, CANVAS_SIZES,
  WaveStyle, LAYOUT_TEMPLATES, LayoutTemplateDef,
} from '../types'
import WaveformCanvas from './WaveformCanvas'

interface Props {
  state: AppState
  onChange: (patch: Partial<AppState>) => void
  onBack: () => void
  onNext: () => void
}

export default function StepCustomize({ state, onChange, onBack, onNext }: Props) {
  const [finetune, setFinetune] = useState(false)
  const ratio = CANVAS_SIZES[state.canvasSize].w / CANVAS_SIZES[state.canvasSize].h
  const currentTpl = LAYOUT_TEMPLATES.find(t => t.id === state.layoutTemplate)!

  const selectTemplate = (tpl: LayoutTemplateDef) => {
    onChange({
      layoutTemplate: tpl.id,
      waveColor: tpl.defaultWaveColor,
      bgColor: tpl.defaultBgColor,
      waveStyle: tpl.defaultWaveStyle,
      karaokeEnabled: tpl.defaultKaraoke,
    })
  }

  const pickCoverImage = async () => {
    const file = await open({
      multiple: false,
      filters: [{ name: 'Image', extensions: ['jpg', 'jpeg', 'png', 'webp', 'heic'] }],
    })
    if (file) onChange({ coverImagePath: String(file) })
  }

  return (
    <div className="fade-up" style={{ display: 'flex', height: '100%' }}>

      {/* ── Left panel ── */}
      <div style={{
        width: 220, flexShrink: 0, display: 'flex', flexDirection: 'column',
        background: '#fff', borderRight: '1px solid #E5E7EB',
        padding: '14px 12px', overflowY: 'auto',
      }}>

        {/* LAYOUT section */}
        <PanelLabel label="Layout" badge={`${LAYOUT_TEMPLATES.length} templates`} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 7, marginBottom: 14 }}>
          {LAYOUT_TEMPLATES.map(tpl => (
            <TemplateCard
              key={tpl.id}
              tpl={tpl}
              selected={state.layoutTemplate === tpl.id}
              onClick={() => selectTemplate(tpl)}
            />
          ))}
        </div>

        {/* Cover image picker (only for avatar-based templates) */}
        {currentTpl.needsAvatar && (
          <>
            <PanelLabel label="Cover Image" badge="optional" />
            {state.coverImagePath ? (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '7px 9px', background: '#F9FAFB',
                borderRadius: 8, border: '1px solid #E5E7EB', marginBottom: 14,
              }}>
                <img
                  src={convertFileSrc(state.coverImagePath)}
                  style={{ width: 32, height: 32, borderRadius: 6, objectFit: 'cover', flexShrink: 0 }}
                  alt=""
                />
                <div style={{ flex: 1, fontSize: 10, color: '#374151', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {state.coverImagePath.replace(/\\/g, '/').split('/').pop()}
                </div>
                <button onClick={() => onChange({ coverImagePath: '' })}
                  style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 18, lineHeight: 1, padding: '0 2px' }}>
                  ×
                </button>
              </div>
            ) : (
              <button onClick={pickCoverImage} style={{
                width: '100%', padding: '8px 0', borderRadius: 8,
                border: '1.5px dashed #E5E7EB', background: '#F9FAFB',
                fontSize: 11, color: '#9CA3AF', cursor: 'pointer',
                fontFamily: 'inherit', marginBottom: 14,
              }}>
                + Import cover image
              </button>
            )}
          </>
        )}

        {/* Divider */}
        <div style={{ height: 1, background: '#F3F4F6', margin: '0 -12px 12px' }} />

        {/* FINE-TUNE toggle */}
        <button onClick={() => setFinetune(f => !f)} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'none', border: 'none', cursor: 'pointer',
          padding: '0 0 10px', width: '100%', fontFamily: 'inherit',
        }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Fine-tune</span>
          <span style={{ fontSize: 10, color: '#9CA3AF' }}>{finetune ? '▲' : '▼'}</span>
        </button>

        {finetune && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 13, marginBottom: 12 }}>

            <MiniSection label="Waveform">
              <div style={{ display: 'flex', gap: 5 }}>
                {WAVE_STYLES.map(s => (
                  <button key={s.id} onClick={() => onChange({ waveStyle: s.id as WaveStyle })} style={{
                    flex: 1, padding: '6px 0', borderRadius: 7, cursor: 'pointer',
                    border: `1.5px solid ${state.waveStyle === s.id ? '#6C4FF6' : '#E5E7EB'}`,
                    background: state.waveStyle === s.id ? '#EDE9FF' : '#F9FAFB',
                    fontSize: 11, fontWeight: state.waveStyle === s.id ? 600 : 400,
                    color: state.waveStyle === s.id ? '#6C4FF6' : '#374151',
                    fontFamily: 'inherit',
                  }}>{s.label}</button>
                ))}
              </div>
            </MiniSection>

            <MiniSection label="Wave Color">
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                {WAVE_COLORS.map(c => (
                  <button key={c.hex} title={c.name} onClick={() => onChange({ waveColor: c.hex })} style={{
                    width: 22, height: 22, borderRadius: 11, background: c.hex,
                    border: 'none', cursor: 'pointer',
                    boxShadow: state.waveColor === c.hex ? `0 0 0 2px #fff, 0 0 0 3.5px ${c.hex}` : '0 1px 3px rgba(0,0,0,.15)',
                    outline: c.hex === '#FFFFFF' ? '1px solid #E5E7EB' : 'none',
                  }} />
                ))}
                <input type="color" value={state.waveColor} onChange={e => onChange({ waveColor: e.target.value })}
                  style={{ width: 22, height: 22, border: '1px solid #E5E7EB', borderRadius: 5, padding: 2, cursor: 'pointer', background: 'none' }} />
              </div>
            </MiniSection>

            <MiniSection label="Background">
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
                {BG_COLORS.map(c => (
                  <button key={c.hex} title={c.name} onClick={() => onChange({ bgColor: c.hex })} style={{
                    width: 22, height: 22, borderRadius: 11, background: c.hex,
                    border: 'none', cursor: 'pointer', outline: '1px solid rgba(0,0,0,.1)',
                    boxShadow: state.bgColor === c.hex ? `0 0 0 2px #fff, 0 0 0 3.5px #6C4FF6` : '0 1px 3px rgba(0,0,0,.2)',
                  }} />
                ))}
                <input type="color" value={state.bgColor} onChange={e => onChange({ bgColor: e.target.value })}
                  style={{ width: 22, height: 22, border: '1px solid #E5E7EB', borderRadius: 5, padding: 2, cursor: 'pointer', background: 'none' }} />
              </div>
            </MiniSection>

            <MiniSection label="Font">
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
                {(['Arial', 'Georgia', 'Impact', 'Verdana'] as const).map(f => (
                  <button key={f} onClick={() => onChange({ fontName: f })} style={{
                    padding: '5px 7px', borderRadius: 6, cursor: 'pointer',
                    border: `1.5px solid ${state.fontName === f ? '#6C4FF6' : '#E5E7EB'}`,
                    background: state.fontName === f ? '#EDE9FF' : '#F9FAFB',
                    fontSize: 11, fontWeight: state.fontName === f ? 700 : 400,
                    color: state.fontName === f ? '#6C4FF6' : '#374151',
                    fontFamily: f,
                  }}>{f}</button>
                ))}
              </div>
            </MiniSection>

            <MiniSection label={`Font Size — ${state.fontSize}%`}>
              <input type="range" min={70} max={140} step={5} value={state.fontSize}
                onChange={e => onChange({ fontSize: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#6C4FF6' }} />
            </MiniSection>

          </div>
        )}

        <div style={{ flex: 1 }} />

        <div style={{ display: 'flex', gap: 7, paddingTop: 10 }}>
          <button onClick={onBack} style={btnSecondary}>← Back</button>
          <button onClick={onNext} style={btnPrimary}>Transcript →</button>
        </div>
      </div>

      {/* ── Preview ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #1a0f3a 0%, #0f0a1e 100%)',
        padding: 24, gap: 14, overflow: 'hidden',
      }}>
        {/* Ratio pills */}
        <div style={{ display: 'flex', gap: 6 }}>
          {(['16:9', '1:1', '9:16'] as const).map(s => (
            <button key={s} onClick={() => onChange({ canvasSize: s })} style={{
              padding: '4px 10px', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: state.canvasSize === s ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.06)',
              color: state.canvasSize === s ? '#fff' : 'rgba(255,255,255,0.4)',
              fontSize: 11, fontWeight: 600, fontFamily: 'inherit',
            }}>{s}</button>
          ))}
          {state.segments.length > 0 && (
            <div style={{
              padding: '4px 10px', borderRadius: 20,
              background: state.showSubtitles ? 'rgba(108,79,246,0.4)' : 'rgba(255,255,255,0.06)',
              color: state.showSubtitles ? '#C4B5FD' : 'rgba(255,255,255,0.4)',
              fontSize: 11, fontWeight: 600,
            }}>
              {state.showSubtitles ? '💬 ON' : '💬 OFF'}
            </div>
          )}
        </div>

        {/* Canvas */}
        <div style={{
          aspectRatio: String(ratio),
          width: ratio >= 1 ? '85%' : undefined,
          height: ratio < 1 ? '78%' : undefined,
          borderRadius: 16, overflow: 'hidden',
          boxShadow: '0 24px 80px rgba(108,79,246,0.35)',
        }}>
          <WaveformCanvas
            audioPath={state.audioPath}
            color={state.waveColor}
            bgColor={state.bgColor}
            waveStyle={state.waveStyle}
            title={state.title}
            canvasRatio={ratio}
            segments={state.showSubtitles ? state.segments : []}
            onPeaksReady={peaks => onChange({ peaks })}
            fontSize={state.fontSize}
            fontName={state.fontName}
            karaokeEnabled={state.karaokeEnabled}
            karaokeColor={state.karaokeColor}
            layoutTemplate={state.layoutTemplate}
            coverImagePath={state.coverImagePath}
          />
        </div>

        <div style={{ fontSize: 11, color: 'rgba(255,255,255,.35)', textAlign: 'center' }}>
          {currentTpl.name} · {currentTpl.desc}
        </div>
      </div>
    </div>
  )
}

// ── Template card ─────────────────────────────────────────────────────────────

function TemplateCard({ tpl, selected, onClick }: { tpl: LayoutTemplateDef; selected: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      position: 'relative', borderRadius: 10, overflow: 'hidden', padding: 0,
      border: `1.5px solid ${selected ? '#6C4FF6' : '#E5E7EB'}`,
      background: tpl.defaultBgColor, cursor: 'pointer',
      aspectRatio: '1', display: 'flex', alignItems: 'stretch',
      boxShadow: selected ? '0 0 0 3px rgba(108,79,246,.15)' : undefined,
    }}>
      <LayoutSVG id={tpl.id} waveColor={tpl.defaultWaveColor} />
      {selected && (
        <div style={{
          position: 'absolute', top: 5, right: 5,
          width: 16, height: 16, borderRadius: 8, background: '#6C4FF6',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 9, color: '#fff', fontWeight: 700,
        }}>✓</div>
      )}
      <div style={{
        position: 'absolute', bottom: 5, left: 6,
        fontSize: 8, fontWeight: 700, color: 'rgba(255,255,255,.75)',
      }}>{tpl.name}</div>
    </button>
  )
}

function LayoutSVG({ id, waveColor }: { id: string; waveColor: string }) {
  const W = 100, H = 100
  const bars = Array.from({ length: 18 }, (_, i) => ({
    h: Math.max(5, 28 * (0.2 + 0.8 * Math.abs(Math.sin(i * 0.45 + Number(id.charCodeAt(0)) * 0.1)))),
  }))
  const bw = 3.2, gap = 1.0
  const totalW = bars.length * (bw + gap)

  const renderBars = (x0: number, y0: number, availW: number, availH: number, alpha = 1) => (
    bars.map((b, i) => {
      const scale = availW / totalW
      const bx = x0 + i * (bw + gap) * scale
      const bh = b.h * (availH / 30) * 0.7
      return <rect key={i} x={bx} y={y0 + availH / 2 - bh / 2} width={bw * scale} height={bh} rx={1} fill={waveColor} opacity={alpha} />
    })
  )

  switch (id) {
    case 'spotify':
      return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
          {/* avatar glow */}
          <ellipse cx={W/2} cy={34} rx={24} ry={20} fill={waveColor} opacity={0.15} />
          {/* avatar circle */}
          <circle cx={W/2} cy={32} r={18} fill="url(#av1)" />
          <defs><linearGradient id="av1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#EC4FC4"/><stop offset="100%" stopColor={waveColor}/></linearGradient></defs>
          {/* title line */}
          <rect x={W*0.2} y={56} width={W*0.6} height={4} rx={2} fill="white" opacity={0.6} />
          <rect x={W*0.3} y={63} width={W*0.4} height={3} rx={1.5} fill="white" opacity={0.3} />
          {/* waveform */}
          {renderBars(8, 68, W - 16, 20)}
          {/* subtitle hint */}
          <rect x={14} y={90} width={W-28} height={6} rx={3} fill="black" opacity={0.4} />
        </svg>
      )

    case 'split':
      return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
          {/* left image area */}
          <rect x={0} y={0} width={W/2} height={H} fill="url(#sp1)" />
          <defs>
            <linearGradient id="sp1" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#3D1A6E"/>
              <stop offset="100%" stopColor="#1A0A3E"/>
            </linearGradient>
          </defs>
          {/* mic icon placeholder */}
          <text x={W/4} y={H/2+8} textAnchor="middle" fontSize={24} opacity={0.6}>🎙</text>
          {/* gradient blend */}
          <defs>
            <linearGradient id="sp2" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="#0A1628" stopOpacity="0"/>
              <stop offset="100%" stopColor="#0A1628" stopOpacity="1"/>
            </linearGradient>
          </defs>
          <rect x={W*0.38} y={0} width={W*0.14} height={H} fill="url(#sp2)" />
          {/* right: title lines */}
          <rect x={W*0.55} y={22} width={W*0.37} height={4} rx={2} fill="white" opacity={0.7} />
          <rect x={W*0.55} y={30} width={W*0.25} height={3} rx={1.5} fill="white" opacity={0.35} />
          {/* right: waveform */}
          {renderBars(W * 0.54, 44, W * 0.42, 26)}
          {/* subtitle */}
          <rect x={W*0.54} y={78} width={W*0.40} height={14} rx={4} fill="black" opacity={0.35} />
        </svg>
      )

    case 'minimal':
      return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
          {/* subtle grid */}
          {[25, 50, 75].map(y => <line key={y} x1={0} y1={y} x2={W} y2={y} stroke="white" strokeWidth={0.4} opacity={0.06} />)}
          {/* title */}
          <rect x={W*0.15} y={12} width={W*0.7} height={5} rx={2.5} fill="white" opacity={0.8} />
          <rect x={W*0.25} y={20} width={W*0.5} height={3} rx={1.5} fill="white" opacity={0.3} />
          {/* large waveform */}
          {renderBars(5, 30, W - 10, 36, 0.9)}
          {/* subtitle box */}
          <rect x={10} y={74} width={W-20} height={16} rx={5} fill="white" opacity={0.07} />
          <rect x={W*0.15} y={79} width={W*0.7} height={5} rx={2.5} fill="white" opacity={0.5} />
        </svg>
      )

    case 'fullbg':
      return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
          {/* bg blobs */}
          <ellipse cx={30} cy={30} rx={40} ry={34} fill="#EC4FC4" opacity={0.25} />
          <ellipse cx={70} cy={55} rx={46} ry={38} fill={waveColor} opacity={0.2} />
          {/* dark overlay */}
          <rect x={0} y={0} width={W} height={H} fill="black" opacity={0.45} />
          {/* avatar circle */}
          <circle cx={W/2} cy={28} r={16} fill="url(#fb1)" />
          <defs><linearGradient id="fb1" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="#EC4FC4"/><stop offset="100%" stopColor={waveColor}/></linearGradient></defs>
          <circle cx={W/2} cy={28} r={17} fill="none" stroke="white" strokeWidth={1} opacity={0.3} />
          {/* title */}
          <rect x={W*0.2} y={49} width={W*0.6} height={4} rx={2} fill="white" opacity={0.8} />
          {/* dark gradient bottom */}
          <defs><linearGradient id="fb2" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="black" stopOpacity="0"/><stop offset="100%" stopColor="black" stopOpacity="0.65"/></linearGradient></defs>
          <rect x={0} y={60} width={W} height={H-60} fill="url(#fb2)" />
          {/* waveform */}
          {renderBars(8, 63, W-16, 20)}
          {/* sub */}
          <rect x={W*0.15} y={87} width={W*0.7} height={5} rx={2.5} fill="white" opacity={0.5} />
        </svg>
      )

    case 'karaoke':
      return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
          {/* spotlight */}
          <ellipse cx={W/2} cy={50} rx={40} ry={34} fill={waveColor} opacity={0.07} />
          {/* large lyric lines */}
          <rect x={W*0.08} y={26} width={W*0.5} height={7} rx={3.5} fill="white" opacity={0.85} />
          {/* highlight word */}
          <rect x={W*0.08+W*0.5+4} y={26} width={W*0.32} height={7} rx={3.5} fill={waveColor} opacity={0.9} />
          <rect x={W*0.15} y={37} width={W*0.7} height={6} rx={3} fill="white" opacity={0.85} />
          {/* dim next line */}
          <rect x={W*0.2} y={48} width={W*0.6} height={4} rx={2} fill="white" opacity={0.22} />
          {/* progress bar */}
          <rect x={14} y={70} width={W-28} height={2} rx={1} fill="white" opacity={0.1} />
          <rect x={14} y={70} width={(W-28)*0.38} height={2} rx={1} fill={waveColor} opacity={0.8} />
          <circle cx={14+(W-28)*0.38} cy={71} r={3} fill={waveColor} />
          {/* thin waveform */}
          {renderBars(8, 76, W-16, 14, 0.65)}
        </svg>
      )

    case 'brand':
      return (
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: '100%' }}>
          {/* left accent bar */}
          <rect x={0} y={0} width={4} height={H} fill="url(#br1)" />
          <defs><linearGradient id="br1" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={waveColor}/><stop offset="100%" stopColor="#EC4FC4"/></linearGradient></defs>
          {/* avatar circle left */}
          <circle cx={22} cy={H/2} r={14} fill="url(#br2)" />
          <defs><linearGradient id="br2" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor={waveColor}/><stop offset="100%" stopColor="#EC4FC4"/></linearGradient></defs>
          {/* channel + episode text */}
          <rect x={40} y={H/2-10} width={W*0.23} height={4} rx={2} fill="white" opacity={0.8} />
          <rect x={40} y={H/2-2} width={W*0.18} height={3} rx={1.5} fill="white" opacity={0.4} />
          <rect x={40} y={H/2+5} width={W*0.14} height={3} rx={1.5} fill={waveColor} opacity={0.7} />
          {/* divider */}
          <line x1={W*0.52} y1={12} x2={W*0.52} y2={H-12} stroke="white" strokeWidth={0.5} opacity={0.1} />
          {/* tall waveform right */}
          {renderBars(W * 0.55, 10, W * 0.42, H - 20, 0.9)}
        </svg>
      )

    default:
      return null
  }
}

// ── Small helpers ─────────────────────────────────────────────────────────────

function PanelLabel({ label, badge }: { label: string; badge?: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <div style={{ fontSize: 9, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {label}
      </div>
      {badge && (
        <div style={{ fontSize: 8, fontWeight: 600, color: '#6C4FF6', background: '#EDE9FF', padding: '2px 6px', borderRadius: 4 }}>
          {badge}
        </div>
      )}
    </div>
  )
}

function MiniSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div style={{ fontSize: 9, fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 6 }}>
        {label}
      </div>
      {children}
    </div>
  )
}

const btnPrimary: React.CSSProperties = {
  flex: 1, background: '#6C4FF6', color: '#fff', border: 'none',
  borderRadius: 10, padding: '11px 0', fontSize: 12, fontWeight: 600,
  cursor: 'pointer', fontFamily: 'inherit',
}
const btnSecondary: React.CSSProperties = {
  flex: 1, background: '#F3F4F6', color: '#374151', border: 'none',
  borderRadius: 10, padding: '11px 0', fontSize: 12, fontWeight: 500,
  cursor: 'pointer', fontFamily: 'inherit',
}
