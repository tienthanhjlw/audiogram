// features/design/TimingTimeline.tsx — P5-T9. Single-track timeline (NOT a
// multi-clip NLE — plan §8) for setting when scene nodes show/hide. Lives
// below CanvasStage when the Layers beta (layersBetaEnabled) is on; shares
// the transport's own timebase (0 → duration) and playhead/seek behavior
// (features/transport/TransportBar.tsx — same audioEngine.seek() call, no
// invented interaction). One horizontal bar per node: nodes with `timing`
// show as a bar spanning [start,end]; nodes without one show as a faint
// full-width bar (always visible). Body-drag shifts the whole window; edge-
// drag resizes start/end independently; both snap (±8px) to the playhead
// and to other bars' edges, same convention as the zone editor (P2-T7,
// domain/zones.ts's snapToCenterPx).
import { useCallback, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useAppStore } from '../../store'
import { audioEngine } from '../../core/audio/AudioEngine'
import type { SceneNode } from '../../types'

const SNAP_PX = 8
const ROW_H = 22
const ROW_GAP = 4

interface DragState {
  nodeId: string
  mode: 'move' | 'resize-start' | 'resize-end'
  pointerStartPx: number
  origStart: number
  origEnd: number
}

function snapCandidates(nodes: SceneNode[], excludeId: string, playheadT: number): number[] {
  const points = [0, playheadT]
  for (const n of nodes) {
    if (n.id === excludeId || !n.timing) continue
    points.push(n.timing.start, n.timing.end)
  }
  return points
}

function snap(valuePx: number, candidatesPx: number[]): number {
  for (const c of candidatesPx) {
    if (Math.abs(valuePx - c) <= SNAP_PX) return c
  }
  return valuePx
}

export function TimingTimeline() {
  const nodes = useAppStore(s => s.nodes)
  const duration = useAppStore(s => s.duration)
  const currentTime = useAppStore(s => s.currentTime)
  const selectedNodeIds = useAppStore(s => s.selectedNodeIds)
  const setSelectedNodeIds = useAppStore(s => s.setSelectedNodeIds)
  const updateNodeTiming = useAppStore(s => s.updateNodeTiming)

  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<DragState | null>(null)
  const [, forceRender] = useState(0)

  const total = duration > 0 ? duration : 1

  const pxToSec = useCallback((px: number) => {
    const el = trackRef.current
    if (!el) return 0
    return Math.min(Math.max((px / el.clientWidth) * total, 0), total)
  }, [total])

  const secToPx = useCallback((sec: number) => {
    const el = trackRef.current
    const w = el?.clientWidth ?? 0
    return (sec / total) * w
  }, [total])

  const handlePointerDown = (node: SceneNode, mode: DragState['mode']) => (e: ReactPointerEvent) => {
    e.stopPropagation()
    setSelectedNodeIds([node.id])
    const timing = node.timing ?? { start: 0, end: total }
    dragRef.current = {
      nodeId: node.id, mode,
      pointerStartPx: e.clientX,
      origStart: timing.start, origEnd: timing.end,
    };
    (e.target as Element).setPointerCapture(e.pointerId)
  }

  const handlePointerMove = (e: ReactPointerEvent) => {
    const drag = dragRef.current
    if (!drag) return
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const deltaPx = e.clientX - drag.pointerStartPx
    const deltaSec = (deltaPx / rect.width) * total
    const node = nodes.find(n => n.id === drag.nodeId)
    if (!node) return

    const candidatesPx = snapCandidates(nodes, drag.nodeId, currentTime).map(secToPx)

    if (drag.mode === 'move') {
      const span = drag.origEnd - drag.origStart
      let newStart = Math.min(Math.max(drag.origStart + deltaSec, 0), total - span)
      const snappedStartPx = snap(secToPx(newStart), candidatesPx)
      newStart = pxToSec(snappedStartPx)
      updateNodeTiming(node.id, { start: newStart, end: newStart + span })
    } else if (drag.mode === 'resize-start') {
      let newStart = Math.min(Math.max(drag.origStart + deltaSec, 0), drag.origEnd)
      newStart = pxToSec(snap(secToPx(newStart), candidatesPx))
      updateNodeTiming(node.id, { start: newStart, end: drag.origEnd })
    } else {
      let newEnd = Math.max(Math.min(drag.origEnd + deltaSec, total), drag.origStart)
      newEnd = pxToSec(snap(secToPx(newEnd), candidatesPx))
      updateNodeTiming(node.id, { start: drag.origStart, end: newEnd })
    }
    forceRender(n => n + 1)
  }

  const handlePointerUp = () => { dragRef.current = null }

  const seekAt = (e: ReactPointerEvent) => {
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const pct = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1)
    audioEngine.seek(pct * total)
  }

  const sorted = useMemo(() => [...nodes].sort((a, b) => b.z - a.z), [nodes])
  const playheadPct = total > 0 ? (currentTime / total) * 100 : 0

  if (nodes.length === 0) return null

  return (
    <div className="border-t border-border bg-bg-pit px-3 py-2">
      <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.05em] text-text-3">Timing</div>
      <div
        ref={trackRef}
        onPointerDown={seekAt}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative w-full select-none"
        style={{ height: sorted.length * (ROW_H + ROW_GAP) + 4 }}
      >
        <div className="pointer-events-none absolute inset-y-0 z-20 w-px bg-accent" style={{ left: `${playheadPct}%` }} />
        {sorted.map((node, i) => {
          const selected = selectedNodeIds.includes(node.id)
          const hasTiming = !!node.timing
          const startPct = hasTiming ? ((node.timing!.start / total) * 100) : 0
          const widthPct = hasTiming ? (((node.timing!.end - node.timing!.start) / total) * 100) : 100
          return (
            <div
              key={node.id}
              className="absolute"
              style={{ top: i * (ROW_H + ROW_GAP), left: `${startPct}%`, width: `${widthPct}%`, height: ROW_H }}
            >
              <div
                onPointerDown={hasTiming ? handlePointerDown(node, 'move') : () => setSelectedNodeIds([node.id])}
                className={[
                  'relative h-full rounded-[4px] px-1.5 text-[10px] leading-[22px] text-text-1',
                  hasTiming ? 'cursor-grab' : 'cursor-default',
                  selected ? 'bg-accent/70' : hasTiming ? 'bg-accent/35' : 'bg-text-3/10',
                ].join(' ')}
              >
                <span className="truncate">{node.type}</span>
                {hasTiming && node.animIn && (
                  <div className="absolute inset-y-0 left-0 w-2 rounded-l-[4px] bg-gradient-to-r from-transparent to-accent/50" />
                )}
                {hasTiming && node.animOut && (
                  <div className="absolute inset-y-0 right-0 w-2 rounded-r-[4px] bg-gradient-to-l from-transparent to-accent/50" />
                )}
                {hasTiming && (
                  <>
                    <div
                      onPointerDown={handlePointerDown(node, 'resize-start')}
                      className="absolute inset-y-0 left-0 w-1.5 cursor-ew-resize"
                    />
                    <div
                      onPointerDown={handlePointerDown(node, 'resize-end')}
                      className="absolute inset-y-0 right-0 w-1.5 cursor-ew-resize"
                    />
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
