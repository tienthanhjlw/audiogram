import { useEffect, useRef, useState } from 'react'
import { Virtuoso, type VirtuosoHandle } from 'react-virtuoso'
import { mergeWithNext, remove, splitAt } from '@audiogram/segments'
import { useAppStore } from '../../store'
import { audioEngine } from '../../core/audio/AudioEngine'
import { ipc } from '../../core/ipc/client'
import { ContextMenu, Textarea } from '../../ui'
import type { Segment } from '../../types'

const MIN_SPLIT_DURATION = 0.6

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  return target.tagName === 'INPUT' || target.tagName === 'TEXTAREA'
}

// UI_DESIGN_SPEC.md §5.1 cụm 3 / §8.6 — virtualized, editable, with a
// split/merge/delete context menu (PHASE3_TASKS.md T7). Renders `items`
// (the search-filtered list from CaptionsPanel) but every mutation looks up
// the target's real position in the full unfiltered `segments` array first —
// filtering must never shift what index split/merge/delete act on.
export function SegmentList({ items }: { items: Segment[] }) {
  const segments    = useAppStore(s => s.segments)
  const currentTime = useAppStore(s => s.currentTime)
  const selectedId  = useAppStore(s => s.selectedSegmentId)
  const selectSegment = useAppStore(s => s.selectSegment)
  const set         = useAppStore(s => s.set)

  const [editingId, setEditingId] = useState<number | null>(null)
  const [menu, setMenu] = useState<{ x: number; y: number; seg: Segment } | null>(null)

  const virtuosoRef = useRef<VirtuosoHandle>(null)
  const lastScrolledId = useRef<number | null>(null)

  const activeId = segments.find(s => currentTime >= s.start && currentTime < s.end)?.id ?? null

  useEffect(() => {
    if (activeId === null || activeId === lastScrolledId.current) return
    const idx = items.findIndex(s => s.id === activeId)
    if (idx < 0) return
    lastScrolledId.current = activeId
    virtuosoRef.current?.scrollToIndex({ index: idx, behavior: 'smooth', align: 'center' })
  }, [activeId, items])

  // ↑/↓ move selection, Enter starts editing the selected row — only while
  // nothing else is capturing keystrokes (the search input, an already-open
  // textarea) so this never fights the global shortcuts table's own
  // `notTyping` guard (app/shortcuts.ts) for Space/arrow-seek.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (editingId !== null) return
      if (isTypingTarget(e.target)) return
      if (selectedId === null) return
      const idx = items.findIndex(s => s.id === selectedId)
      if (idx < 0) return
      if (e.key === 'ArrowDown') {
        const next = items[idx + 1]
        if (next) { e.preventDefault(); selectSegment(next.id) }
      } else if (e.key === 'ArrowUp') {
        const prev = items[idx - 1]
        if (prev) { e.preventDefault(); selectSegment(prev.id) }
      } else if (e.key === 'Enter') {
        e.preventDefault()
        setEditingId(selectedId)
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [editingId, selectedId, items, selectSegment])

  const seekAndPlay = (seg: Segment) => {
    audioEngine.seek(seg.start)
    audioEngine.play()
  }

  const commitEdit = (seg: Segment, text: string, selectNext: boolean) => {
    const updated = segments.map(s => s.id === seg.id ? { ...s, text } : s)
    set({ segments: updated })
    ipc.writeSrt(updated).then(srtPath => set({ srtPath })).catch(() => {})
    setEditingId(null)
    if (selectNext) {
      const idx = segments.findIndex(s => s.id === seg.id)
      const next = segments[idx + 1]
      selectSegment(next?.id ?? null)
    }
  }

  const applyOp = (fn: (segs: Segment[], index: number) => Segment[], seg: Segment) => {
    const index = segments.findIndex(s => s.id === seg.id)
    if (index < 0) return
    const updated = fn(segments, index)
    set({ segments: updated })
    ipc.writeSrt(updated).then(srtPath => set({ srtPath })).catch(() => {})
  }

  const openMenu = (e: React.MouseEvent, seg: Segment) => {
    e.preventDefault()
    setMenu({ x: e.clientX, y: e.clientY, seg })
  }

  return (
    <>
      <Virtuoso
        ref={virtuosoRef}
        className="user-select-text"
        data={items}
        itemContent={(_, seg) => (
          <div className="px-3 pb-1">
            <SegmentRow
              seg={seg}
              active={seg.id === activeId}
              selected={seg.id === selectedId}
              editing={seg.id === editingId}
              onSeek={() => seekAndPlay(seg)}
              onSelect={() => selectSegment(seg.id)}
              onStartEdit={() => setEditingId(seg.id)}
              onCommit={(text, selectNext) => commitEdit(seg, text, selectNext)}
              onCancelEdit={() => setEditingId(null)}
              onContextMenu={e => openMenu(e, seg)}
            />
          </div>
        )}
      />

      {menu && (
        <ContextMenu
          open
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={buildMenuItems({
            seg: menu.seg,
            segments,
            currentTime,
            onSeek: () => seekAndPlay(menu.seg),
            onEdit: () => { selectSegment(menu.seg.id); setEditingId(menu.seg.id) },
            onSplit: () => applyOp((segs, i) => splitAt(segs, i, currentTime), menu.seg),
            onMerge: () => applyOp(mergeWithNext, menu.seg),
            onDelete: () => applyOp(remove, menu.seg),
          })}
        />
      )}
    </>
  )
}

function buildMenuItems(args: {
  seg: Segment
  segments: Segment[]
  currentTime: number
  onSeek: () => void
  onEdit: () => void
  onSplit: () => void
  onMerge: () => void
  onDelete: () => void
}) {
  const { seg, segments, currentTime, onSeek, onEdit, onSplit, onMerge, onDelete } = args
  const isLast = segments[segments.length - 1]?.id === seg.id
  const playheadInside = currentTime > seg.start && currentTime < seg.end
  const tooShort = seg.end - seg.start < MIN_SPLIT_DURATION
  const splitDisabledReason = !playheadInside
    ? 'Playhead is not inside this segment'
    : tooShort
      ? 'Segment is too short to split'
      : undefined

  return [
    { label: 'Play from here', onSelect: onSeek },
    { label: 'Edit text ↵', onSelect: onEdit },
    { separator: true as const },
    { label: 'Split at playhead', onSelect: onSplit, disabled: !!splitDisabledReason, disabledReason: splitDisabledReason },
    { label: 'Merge with next', onSelect: onMerge, disabled: isLast, disabledReason: isLast ? 'No next segment' : undefined },
    { separator: true as const },
    { label: 'Delete', onSelect: onDelete, danger: true },
  ]
}

interface SegmentRowProps {
  seg: Segment
  active: boolean
  selected: boolean
  editing: boolean
  onSeek: () => void
  onSelect: () => void
  onStartEdit: () => void
  onCommit: (text: string, selectNext: boolean) => void
  onCancelEdit: () => void
  onContextMenu: (e: React.MouseEvent) => void
}

function SegmentRow({
  seg, active, selected, editing, onSeek, onSelect, onStartEdit, onCommit, onCancelEdit, onContextMenu,
}: SegmentRowProps) {
  const [val, setVal] = useState(seg.text)
  const committedRef = useRef(false)

  useEffect(() => { if (editing) { setVal(seg.text); committedRef.current = false } }, [editing, seg.text])

  const dur = seg.end - seg.start

  const commit = (selectNext: boolean) => {
    if (committedRef.current) return
    committedRef.current = true
    onCommit(val, selectNext)
  }

  return (
    <div
      onDoubleClick={onSeek}
      onContextMenu={onContextMenu}
      className={[
        'flex flex-col gap-0.5 rounded-[var(--radius-s)] border px-2.5 py-1.5 transition-colors',
        active ? 'border-l-2 border-accent bg-accent-soft' : 'border border-transparent hover:bg-bg-elevated',
        selected && !active ? 'border-accent' : '',
      ].join(' ')}
    >
      <div className="flex items-center gap-1.5 font-mono text-[10px] text-text-3">
        <button type="button" onClick={onSeek} title="Play from here" className="cursor-pointer">▶</button>
        <span>{fmtTime(seg.start)} → {fmtTime(seg.end)}</span>
        <span
          className="rounded-[4px] px-1 py-[1px]"
          style={dur < 1.2 ? { background: 'rgba(245,158,11,0.25)', color: '#F59E0B' } : undefined}
        >
          {dur.toFixed(1)}s
        </span>
      </div>

      {editing ? (
        <Textarea
          autoFocus
          value={val}
          onChange={e => setVal(e.target.value)}
          onBlur={() => commit(false)}
          onKeyDown={e => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); commit(true) }
            else if (e.key === 'Enter') { e.preventDefault(); commit(false) }
            else if (e.key === 'Escape') { e.preventDefault(); onCancelEdit() }
          }}
          className="text-[12.5px]"
        />
      ) : (
        <span
          onClick={() => { if (selected) onStartEdit(); else onSelect() }}
          className={`cursor-text text-[12.5px] leading-[1.5] ${selected ? 'font-medium text-text-1' : 'text-text-2'}`}
        >
          {seg.text}
        </span>
      )}
    </div>
  )
}

function fmtTime(s: number): string {
  if (!isFinite(s)) return '0:00.0'
  const m = Math.floor(s / 60)
  const rem = (s % 60).toFixed(1)
  return `${m}:${rem.padStart(4, '0')}`
}
