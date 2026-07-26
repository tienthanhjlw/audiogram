// Moved verbatim out of StepTranscript.tsx (PHASE2_TASKS.md T11 /
// TECH_ARCHITECTURE.md §1.2 F4 — "business logic in the UI, not testable,
// not reusable"). Arithmetic unchanged from the original.
import { SPLIT_BPS } from '@audiogram/contract'
import type { Segment } from './types'

/** Finds the quietest point in `envelope` (an amplitude array at SPLIT_BPS
 * buckets/second) between `startSec` and `endSec` — used to split a long
 * segment at a natural pause instead of mid-word. */
export function findSilence(envelope: number[], startSec: number, endSec: number): number {
  const s = Math.floor(startSec * SPLIT_BPS)
  const e = Math.ceil(endSec * SPLIT_BPS)
  if (e <= s + 1 || envelope.length === 0) return (startSec + endSec) / 2
  let minVal = Infinity, minIdx = Math.floor((s + e) / 2)
  for (let i = s; i <= Math.min(e, envelope.length - 1); i++) {
    if (envelope[i] < minVal) { minVal = envelope[i]; minIdx = i }
  }
  return minIdx / SPLIT_BPS
}

/** Recursively splits any segment longer than `maxDur` seconds at its
 * quietest point (via findSilence when an envelope is available, else the
 * midpoint), dividing its text proportionally at the split time. Re-ids
 * every returned segment sequentially. */
export function splitSegments(segs: Segment[], envelope: number[], maxDur = 3.5): Segment[] {
  function recurse(seg: Segment, depth: number): Segment[] {
    const dur = seg.end - seg.start
    if (dur <= maxDur || depth > 6 || !seg.text.trim()) return [seg]
    const margin = Math.min(0.5, dur * 0.15)
    const splitAt = envelope.length > 0
      ? findSilence(envelope, seg.start + margin, seg.end - margin)
      : (seg.start + seg.end) / 2
    const words = seg.text.split(/\s+/).filter(Boolean)
    if (words.length < 2) return [seg]
    const ratio = Math.max(0.1, Math.min(0.9, (splitAt - seg.start) / dur))
    const splitWord = Math.max(1, Math.min(words.length - 1, Math.round(words.length * ratio)))
    const left:  Segment = { id: 0, start: seg.start, end: splitAt,  text: words.slice(0, splitWord).join(' ') }
    const right: Segment = { id: 0, start: splitAt,   end: seg.end,  text: words.slice(splitWord).join(' ') }
    return [...recurse(left, depth + 1), ...recurse(right, depth + 1)]
  }
  let id = 0
  return segs.flatMap(seg => recurse(seg, 0)).filter(s => s.text.trim()).map(s => ({ ...s, id: id++ }))
}
