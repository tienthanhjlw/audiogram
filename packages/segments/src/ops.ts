// Segment list operations for the Captions mode context menu
// (split/merge/delete — UI_DESIGN_SPEC.md §8.6, Phase 3). Every function
// takes the full list + a target index and returns a new list with ids
// re-sequenced 0..n-1, same convention splitSegments() already uses.
import type { Segment } from './types'

/** Splits segment `index` at absolute time `t`, dividing its text
 * proportionally by time (same idea as split.ts's automatic long-segment
 * splitting, but for one explicit user-chosen cut point). No-op — returns
 * `segs` unchanged — if `t` isn't strictly inside that segment's range. */
export function splitAt(segs: Segment[], index: number, t: number): Segment[] {
  const seg = segs[index]
  if (!seg || t <= seg.start || t >= seg.end) return segs

  const words = seg.text.split(/\s+/).filter(Boolean)
  if (words.length < 2) return segs

  const ratio = (t - seg.start) / (seg.end - seg.start)
  const splitWord = Math.max(1, Math.min(words.length - 1, Math.round(words.length * ratio)))
  const left: Segment = { id: 0, start: seg.start, end: t, text: words.slice(0, splitWord).join(' ') }
  const right: Segment = { id: 0, start: t, end: seg.end, text: words.slice(splitWord).join(' ') }

  const out = [...segs.slice(0, index), left, right, ...segs.slice(index + 1)]
  return reindex(out)
}

/** Merges segment `index` with the one immediately after it — text joined
 * with a space, time range spans both. No-op if there's no next segment. */
export function mergeWithNext(segs: Segment[], index: number): Segment[] {
  const a = segs[index]
  const b = segs[index + 1]
  if (!a || !b) return segs
  const merged: Segment = { id: 0, start: a.start, end: b.end, text: `${a.text} ${b.text}`.trim() }
  const out = [...segs.slice(0, index), merged, ...segs.slice(index + 2)]
  return reindex(out)
}

/** Removes segment `index`. */
export function remove(segs: Segment[], index: number): Segment[] {
  return reindex(segs.filter((_, i) => i !== index))
}

function reindex(segs: Segment[]): Segment[] {
  return segs.map((s, i) => ({ ...s, id: i }))
}
