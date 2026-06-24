import { useCallback, useRef, useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { useAppStore } from '../store'

export default function StepUpload() {
  const audioPath = useAppStore(s => s.audioPath)
  const audioName = useAppStore(s => s.audioName)
  const title     = useAppStore(s => s.title)
  const set       = useAppStore(s => s.set)
  const next      = useAppStore(s => s.next)

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
    const newTitle = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
    set({ audioPath: path, audioName: name, title: newTitle })
  }, [set])

  const onDragOver  = (e: React.DragEvent) => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault(); setDragging(false)
    const f = e.dataTransfer.files[0]
    if (!f) return
    const path = (f as any).path || f.name
    const name = f.name
    const newTitle = name.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
    set({ audioPath: path, audioName: name, title: newTitle })
  }

  const hasFile = !!audioPath

  return (
    <div className="fade-up" style={{ maxWidth: 560, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 4 }}>Import audio</div>
        <div style={{ fontSize: 13, color: '#9CA3AF' }}>Choose your audio file to get started</div>
      </div>

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
          padding: '48px 40px',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: 14, cursor: 'pointer',
          transition: 'all 0.18s',
          boxShadow: dragging ? '0 0 0 4px #EDE9FF' : '0 1px 4px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{
          width: 72, height: 72, borderRadius: 36,
          background: '#EDE9FF',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <UploadIcon />
        </div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontWeight: 600, fontSize: 17, color: '#111827', marginBottom: 6 }}>
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
            border: 'none', borderRadius: 8, padding: '10px 24px',
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
              {audioName}
            </div>
            <div style={{ fontSize: 12, color: '#22C55E', marginTop: 2 }}>Ready</div>
          </div>
          <button
            onClick={() => set({ audioPath: '', audioName: '', title: '' })}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', fontSize: 20, lineHeight: 1, padding: 4 }}
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
            value={title}
            onChange={e => set({ title: e.target.value })}
            placeholder="My Podcast Episode"
            style={{
              width: '100%', padding: '11px 14px',
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

      {hasFile && (
        <button
          onClick={next}
          style={{
            background: '#6C4FF6', color: '#fff',
            border: 'none', borderRadius: 10, padding: '13px 0',
            fontSize: 14, fontWeight: 600, cursor: 'pointer',
            fontFamily: 'inherit', width: '100%',
            transition: 'all 0.15s',
          }}
        >
          Next: Layout →
        </button>
      )}
    </div>
  )
}

function UploadIcon() {
  return (
    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
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
