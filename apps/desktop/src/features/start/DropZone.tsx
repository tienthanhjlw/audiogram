import { useEffect, useRef, useState, type MouseEvent } from 'react'
import { Button, toast } from '../../ui'
import { actions } from '../../app/actions'
import { onFileDrop } from '../../core/ipc/dragDrop'
import { isAudioFile } from '../../domain/audio'

// UI_DESIGN_SPEC.md §2.2 — the entire zone is one click target (the "Open
// Audio…" button is visually inside it, not a second separate target);
// drag-over/invalid-drop states come from the webview's native drag/drop
// event (core/ipc/dragDrop.ts) rather than HTML5 drag events, since Tauri
// intercepts the OS-level file drop before it'd ever reach onDrop.
export function DropZone() {
  const [dragOver, setDragOver] = useState(false)
  const [shake, setShake] = useState(false)
  const shakeTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return onFileDrop(event => {
      if (event.type === 'enter' || event.type === 'over') {
        setDragOver(true)
      } else if (event.type === 'leave') {
        setDragOver(false)
      } else if (event.type === 'drop') {
        setDragOver(false)
        const path = event.paths[0]
        if (path && isAudioFile(path)) {
          actions.importAudioPath(path)
        } else {
          if (shakeTimer.current) clearTimeout(shakeTimer.current)
          setShake(true)
          shakeTimer.current = setTimeout(() => setShake(false), 300)
          toast.error('Unsupported format. Use MP3, WAV, M4A, FLAC, AAC or OGG.')
        }
      }
    })
  }, [])

  useEffect(() => () => {
    if (shakeTimer.current) clearTimeout(shakeTimer.current)
  }, [])

  const openAudio = (e: MouseEvent) => {
    e.stopPropagation()
    void actions.openAudio()
  }

  return (
    <div
      onClick={openAudio}
      className={[
        'flex w-full max-w-[520px] cursor-pointer flex-col items-center justify-center gap-3 rounded-[var(--radius-l)] px-10 py-14 text-center transition-colors',
        'min-h-[260px] border-[1.5px] border-dashed',
        dragOver ? 'border-accent bg-accent-soft' : 'border-border bg-bg-panel hover:border-text-3',
        shake ? 'animate-shake' : '',
      ].join(' ')}
    >
      <TildeIcon scaled={dragOver} />
      <div className="text-[17px] font-semibold text-text-1">
        {dragOver ? 'Release to import' : 'Drop audio here'}
      </div>
      <div className="text-[12px] text-text-3">MP3 · WAV · M4A · FLAC · AAC · OGG</div>
      <Button variant="primary" size="md" shortcutHint="⌘O" onClick={openAudio}>
        Open Audio…
      </Button>
    </div>
  )
}

function TildeIcon({ scaled }: { scaled: boolean }) {
  return (
    <svg
      width="48" height="48" viewBox="0 0 48 48" fill="none"
      className="text-accent transition-transform duration-[120ms]"
      style={{ transform: scaled ? 'scale(1.08)' : 'scale(1)' }}
    >
      <path
        d="M8 28c3-8 7-8 10 0s7 8 10 0 7-8 10 0"
        stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none"
      />
    </svg>
  )
}
