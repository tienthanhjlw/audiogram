import { useCallback, useRef, useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { AppState, CANVAS_SIZES, CanvasSize } from '../types'

interface Props {
  state: AppState
  onChange: (patch: Partial<AppState>) => void
  onNext: () => void
}

export default function StepUpload({ state, onChange, onNext }: Props) {
  const [dragging, setDragging] = useState(false)
  const dropRef = useRef<HTMLDivElement>(null)

  const pickFile = useCallback(async () => {
    const file = await open({
      multiple: false,
      filters: [{ name: 'Audio', extensions: ['mp3', 'wav', 'm4a', 'flac', 'aac', 'ogg'] }],
    })
    if (!file) return
    const path = String(file)
    const name = path.replace(/\\/g, '/').split('/').pop() || path
    const title = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
    onChange({ audioPath: path, audioName: name, title })
  }, [onChange])

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (!f) return
    // In Tauri, dropped files have a path property (non-standard)
    const path = (f as any).path || f.name
    const name = f.name
    const title = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
    onChange({ audioPath: path, audioName: name, title })
  }

  const hasFile = !!state.audioPath

  return (
    <div className="fade-up" style={{ display: 'flex', gap: 24, height: '100%' }}>
      {/* Left: Upload zone */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 16 }}>
        {/* Drop zone */}
        <div
          ref={dropRef}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={pickFile}
          style={{
            border: `2px dashed ${dragging ? '#6C4FF6' : '#E5E7EB'}`,
            borderRadius: 16,
            background: dragging ? '#F3F0FF' : '#fff',
            padding: 40,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 12,
            cursor: 'pointer',
            transition: 'all 0.18s',
            minHeight: 260,
          }}
        >
          <div style={{
            width: 64, height: 64, borderRadius: 32,
            background: '#EDE9FF',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <UploadIcon />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontWeight: 600, fontSize: 17, color: '#111827', marginBottom: 4 }}>
              Drop your audio file here
            </div>
            <div style={{ fontSize: 13, color: '#9CA3AF' }}>
              or click to browse · MP3, WAV, M4A, FLAC up to 500 MB
            </div>
          </div>
          <button
            onClick={e => { e.stopPropagation(); pickFile() }}
            style={{
              background: '#6C4FF6', color: '#fff',
              border: 'none', borderRadius: 8, padding: '9px 20px',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              marginTop: 4,
            }}
          >
            Browse files
          </button>
        </div>

        {/* File info card */}
        {hasFile && (
          <div style={{
            background: '#fff', borderRadius: 12, padding: '14px 16px',
            border: '1px solid #E5E7EB',
            display: 'flex', alignItems: 'center', gap: 14,
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
          }}>
            <div style={{
              width: 44, height: 44, borderRadius: 10,
              background: '#EDE9FF',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <MusicIcon />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: '#111827', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {state.audioName}
              </div>
              <div style={{ fontSize: 12, color: '#22C55E', marginTop: 2 }}>
                ✓  Ready to use
              </div>
            </div>
            <button
              onClick={() => onChange({ audioPath: '', audioName: '', title: '' })}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 18, lineHeight: 1, padding: 4 }}
            >×</button>
          </div>
        )}

        {/* Title input */}
        {hasFile && (
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#6B7280', display: 'block', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              Episode Title
            </label>
            <input
              value={state.title}
              onChange={e => onChange({ title: e.target.value })}
              placeholder="My Podcast Episode"
              style={{
                width: '100%', padding: '10px 14px',
                border: '1px solid #E5E7EB', borderRadius: 8,
                fontSize: 14, color: '#111827', outline: 'none',
                fontFamily: 'inherit', background: '#fff',
                boxSizing: 'border-box',
              }}
              onFocus={e => (e.target.style.borderColor = '#6C4FF6')}
              onBlur={e => (e.target.style.borderColor = '#E5E7EB')}
            />
          </div>
        )}
      </div>

      {/* Right: Settings panel */}
      <div style={{
        width: 280, background: '#fff', borderRadius: 16,
        border: '1px solid #E5E7EB', padding: 20,
        display: 'flex', flexDirection: 'column', gap: 20,
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
        overflowY: 'auto',
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: '#111827' }}>Settings</div>

        {/* Canvas size */}
        <div>
          <SectionLabel>Canvas size</SectionLabel>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {(['16:9', '1:1', '9:16'] as CanvasSize[]).map(size => {
              const info = CANVAS_SIZES[size]
              const active = state.canvasSize === size
              return (
                <button
                  key={size}
                  onClick={() => onChange({ canvasSize: size })}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    padding: '9px 12px', borderRadius: 8, cursor: 'pointer',
                    border: `1.5px solid ${active ? '#6C4FF6' : '#E5E7EB'}`,
                    background: active ? '#EDE9FF' : '#fff',
                    fontFamily: 'inherit',
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: active ? 600 : 400, color: active ? '#6C4FF6' : '#374151' }}>
                    {info.label}
                  </span>
                  <span style={{ fontSize: 11, color: '#9CA3AF' }}>
                    {info.w}×{info.h}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* FPS */}
        <div>
          <SectionLabel>Frame rate</SectionLabel>
          <div style={{ display: 'flex', gap: 8 }}>
            {[24, 30, 60].map(f => (
              <button
                key={f}
                onClick={() => onChange({ fps: f })}
                style={{
                  flex: 1, padding: '8px 0', borderRadius: 8, cursor: 'pointer',
                  border: `1.5px solid ${state.fps === f ? '#6C4FF6' : '#E5E7EB'}`,
                  background: state.fps === f ? '#EDE9FF' : '#fff',
                  fontSize: 13, fontWeight: state.fps === f ? 600 : 400,
                  color: state.fps === f ? '#6C4FF6' : '#374151',
                  fontFamily: 'inherit',
                }}
              >{f} fps</button>
            ))}
          </div>
        </div>

        {/* Spacer + CTA */}
        <div style={{ flex: 1 }} />
        <button
          disabled={!hasFile}
          onClick={onNext}
          style={{
            background: hasFile ? '#6C4FF6' : '#E5E7EB',
            color: hasFile ? '#fff' : '#9CA3AF',
            border: 'none', borderRadius: 10, padding: '12px 0',
            fontSize: 14, fontWeight: 600, cursor: hasFile ? 'pointer' : 'default',
            fontFamily: 'inherit', width: '100%',
            transition: 'all 0.15s',
          }}
        >
          Next: Customise →
        </button>
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>
      {children}
    </div>
  )
}

function UploadIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
      <path d="M12 15V3M8 7l4-4 4 4" stroke="#6C4FF6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M3 15v4a2 2 0 002 2h14a2 2 0 002-2v-4" stroke="#6C4FF6" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

function MusicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
      <path d="M9 18V6l12-2v12" stroke="#6C4FF6" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="6" cy="18" r="3" stroke="#6C4FF6" strokeWidth="1.8"/>
      <circle cx="18" cy="16" r="3" stroke="#6C4FF6" strokeWidth="1.8"/>
    </svg>
  )
}
