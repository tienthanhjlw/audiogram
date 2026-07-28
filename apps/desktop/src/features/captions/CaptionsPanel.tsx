import { useMemo, useRef, useState } from 'react'
import { useAppStore } from '../../store'
import { matchesSearch } from '../../domain/search'
import { useTranscribe } from './useTranscribe'
import { ModelPopover } from './ModelPopover'
import { SegmentList } from './SegmentList'
import { Button, Input, Modal, ProgressBar } from '../../ui'

// UI_DESIGN_SPEC.md §5.1 — LEFT PANEL for Captions mode, replacing
// StepTranscript's monolithic layout (PHASE3_TASKS.md T6/T7). Cluster 1
// (Transcribe/Model), cluster 2 (Search), cluster 3 (SegmentList, T7 —
// virtualized/editable/context-menu).
export function CaptionsPanel() {
  const segments      = useAppStore(s => s.segments)
  const whisperModel  = useAppStore(s => s.whisperModel)
  const { run, error, setError, elapsed, hasSegments, isTranscribing } = useTranscribe()

  const [confirmOpen, setConfirmOpen] = useState(false)
  const [modelOpen, setModelOpen] = useState(false)
  const [query, setQuery] = useState('')
  const modelTriggerRef = useRef<HTMLButtonElement>(null)

  const filtered = useMemo(
    () => segments.filter(s => matchesSearch(s.text, query)),
    [segments, query],
  )

  const handleTranscribeClick = () => {
    if (hasSegments) setConfirmOpen(true)
    else run()
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
            ? <>Transcribing… <span className="tabular">{elapsed}</span>s</>
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

      {/* Cụm 3 — Segment list */}
      <div className="min-h-0 flex-1">
        {filtered.length === 0 ? (
          <div className="p-4 text-center text-[12px] text-text-3">
            {segments.length === 0 ? 'No captions yet — transcribe to get started.' : 'No matches.'}
          </div>
        ) : (
          <SegmentList items={filtered} />
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
