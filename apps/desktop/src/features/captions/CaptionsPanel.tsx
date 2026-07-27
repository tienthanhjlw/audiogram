import { useMemo, useRef, useState } from 'react'
import { Virtuoso } from 'react-virtuoso'
import { useAppStore } from '../../store'
import { audioEngine } from '../../core/audio/AudioEngine'
import { matchesSearch } from '../../domain/search'
import { useTranscribe } from './useTranscribe'
import { ModelPopover } from './ModelPopover'
import { Button, Input, Modal, ProgressBar } from '../../ui'
import type { Segment } from '../../types'

// UI_DESIGN_SPEC.md §5.1 — LEFT PANEL for Captions mode, replacing
// StepTranscript's monolithic layout (PHASE3_TASKS.md T6). Only clusters 1
// (Transcribe/Model) and 2 (Search) are this task's job; the segment list
// below is a plain (non-virtualized-features) bridge — editing, keyboard
// nav, and the context menu are T7's job, built on top of this same list.
export function CaptionsPanel() {
  const segments      = useAppStore(s => s.segments)
  const whisperModel  = useAppStore(s => s.whisperModel)
  const currentTime   = useAppStore(s => s.currentTime)
  const { run, error, setError, elapsed, hasSegments, isTranscribing } = useTranscribe()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [query, setQuery] = useState('')
  const modelTriggerRef = useRef<HTMLButtonElement>(null)

  const activeId = useMemo(() => {
    const seg = segments.find(s => currentTime >= s.start && currentTime < s.end)
    return seg?.id ?? null
  }, [segments, currentTime])

  const filtered = useMemo(
    () => segments.filter(s => matchesSearch(s.text, query)),
    [segments, query],
  )

  const handleTranscribeClick = () => {
    if (hasSegments) setConfirmOpen(true)
    else run()
  }

  const seek = (seg: Segment) => {
    audioEngine.seek(seg.start)
    audioEngine.play()
  }

  return (
    <div className="flex h-full flex-col">
      {/* Cụm 1 — Transcribe */}
      <div className="flex flex-col gap-2 border-b border-border p-3">
        <button
          ref={modelTriggerRef}
          type="button"
          onClick={() => setModelOpen(o => !o)}
          className="flex h-8 items-center justify-between rounded-[var(--radius-s)] border border-border bg-bg-app px-2.5 text-[12.5px] text-text-1 hover:border-text-3"
        >
          <span>Model: <span className="font-semibold">{whisperModel}</span></span>
          <span className="text-text-3">▾</span>
        </button>
        <ModelPopover anchorRef={modelTriggerRef} open={modelOpen} onClose={() => setModelOpen(false)} />

        <Button
          variant={hasSegments ? 'secondary' : 'primary'}
          size="md"
          loading={isTranscribing}
          disabled={isTranscribing}
          onClick={handleTranscribeClick}
          className="w-full"
        >
          {isTranscribing
            ? `Transcribing… ${elapsed}s`
            : hasSegments ? '↺ Re-transcribe' : '🎙 Transcribe'}
        </Button>
        {isTranscribing && <ProgressBar />}

        {error && (
          <div className="flex items-center justify-between gap-2 rounded-[var(--radius-s)] border border-danger/40 bg-danger/10 px-2.5 py-2 text-[12px] text-danger">
            <span className="min-w-0 flex-1 truncate">{error}</span>
            <Button variant="ghost" size="sm" onClick={() => { setError(null); run() }}>Retry</Button>
          </div>
        )}
      </div>

      {/* Cụm 2 — Search */}
      <div className="border-b border-border p-3">
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') setQuery('') }}
          placeholder="🔍 Search captions…"
        />
        <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-3">
          {query.trim()
            ? `${filtered.length} of ${segments.length} segments`
            : `${segments.length} segments`}
        </div>
      </div>

      {/* Cụm 3 — Segment list (bridge; virtualized/edit/context-menu = T7) */}
      <div className="min-h-0 flex-1">
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-[12px] text-text-3">
            {segments.length === 0 ? 'No captions yet — transcribe to get started.' : 'No matches.'}
          </div>
        ) : (
          <Virtuoso
            data={filtered}
            itemContent={(_, seg) => (
              <div className="px-3 pb-1">
                <SegmentRowStub seg={seg} active={seg.id === activeId} onSeek={() => seek(seg)} />
              </div>
            )}
          />
        )}
      </div>

      <Modal open={confirmOpen} onClose={() => setConfirmOpen(false)} className="w-[400px] p-5">
        <div className="text-[15px] font-semibold text-text-1">Replace current captions?</div>
        <p className="mt-2 text-[13px] text-text-2">
          {segments.length} segments — including your edits — will be replaced.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button>
          <Button variant="danger" onClick={() => { setConfirmOpen(false); run() }}>Re-transcribe</Button>
        </div>
      </Modal>
    </div>
  )
}

function SegmentRowStub({ seg, active, onSeek }: { seg: Segment; active: boolean; onSeek: () => void }) {
  const dur = seg.end - seg.start
  return (
    <button
      type="button"
      onDoubleClick={onSeek}
      className={[
        'flex w-full flex-col gap-0.5 rounded-[var(--radius-s)] px-2.5 py-1.5 text-left transition-colors',
        active ? 'border-l-2 border-accent bg-accent/10' : 'border-l-2 border-transparent hover:bg-bg-elevated',
      ].join(' ')}
    >
      <div className="flex items-center gap-1.5 font-mono text-[10px] text-text-3">
        <span onClick={e => { e.stopPropagation(); onSeek() }}>▶</span>
        <span>{fmtTime(seg.start)} → {fmtTime(seg.end)}</span>
        <span
          className="rounded-[4px] px-1 py-[1px]"
          style={dur < 1.2 ? { background: 'rgba(245,158,11,0.25)', color: '#F59E0B' } : undefined}
        >
          {dur.toFixed(1)}s
        </span>
      </div>
      <span className="text-[12.5px] leading-[1.5] text-text-1">{seg.text}</span>
    </button>
  )
}

function fmtTime(s: number): string {
  if (!isFinite(s)) return '0:00.0'
  const m = Math.floor(s / 60)
  const rem = (s % 60).toFixed(1)
  return `${m}:${rem.padStart(4, '0')}`
}
