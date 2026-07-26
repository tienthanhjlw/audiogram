import { describe, expect, it } from 'vitest'
import { findSilence, splitSegments } from './split'
import type { Segment } from './types'

describe('findSilence', () => {
  it('finds the index of the quietest point in range', () => {
    // SPLIT_BPS=30 buckets/sec; a clear dip at bucket 15 (=0.5s) between 0-1s.
    const envelope = Array.from({ length: 60 }, (_, i) => (i === 15 ? 0 : 1))
    expect(findSilence(envelope, 0, 2)).toBeCloseTo(0.5, 1)
  })

  it('falls back to the midpoint when the envelope is empty', () => {
    expect(findSilence([], 2, 6)).toBe(4)
  })

  it('falls back to the midpoint when the range is too narrow to search', () => {
    const envelope = Array.from({ length: 60 }, () => 1)
    expect(findSilence(envelope, 1.0, 1.01)).toBeCloseTo(1.005, 2)
  })
})

describe('splitSegments', () => {
  // A long segment (6s, well over the 3.5s default maxDur) with a clear
  // quiet dip near its middle, plus one already-short segment that should
  // pass through unchanged.
  function fixture(): { segs: Segment[]; envelope: number[] } {
    const envelope = Array.from({ length: 180 }, (_, i) => (i >= 88 && i <= 92 ? 0 : 1)) // dip at ~3s
    const segs: Segment[] = [
      { id: 0, start: 0, end: 6, text: 'the quick brown fox jumps over the lazy dog while running fast' },
      { id: 1, start: 6, end: 8, text: 'short one' },
    ]
    return { segs, envelope }
  }

  it('splits the long segment and leaves the short one alone', () => {
    const { segs, envelope } = fixture()
    const result = splitSegments(segs, envelope, 3.5)
    expect(result.length).toBeGreaterThan(segs.length)
    expect(result.at(-1)!.text).toBe('short one')
  })

  it('produces contiguous, non-overlapping segments spanning the original range', () => {
    const { segs, envelope } = fixture()
    const result = splitSegments(segs, envelope, 3.5)
    expect(result[0].start).toBe(segs[0].start)
    expect(result.at(-1)!.end).toBe(segs.at(-1)!.end)
    for (let i = 1; i < result.length; i++) {
      expect(result[i].start).toBe(result[i - 1].end)
    }
  })

  it('re-ids sequentially from 0', () => {
    const { segs, envelope } = fixture()
    const result = splitSegments(segs, envelope, 3.5)
    expect(result.map(s => s.id)).toEqual(result.map((_, i) => i))
  })

  it('preserves all words across the split (no text lost or duplicated)', () => {
    const { segs, envelope } = fixture()
    const result = splitSegments(segs, envelope, 3.5)
    const originalWords = segs.flatMap(s => s.text.split(/\s+/)).join(' ')
    const resultWords = result.map(s => s.text).join(' ')
    expect(resultWords).toBe(originalWords)
  })

  it('leaves segments already under maxDur untouched', () => {
    const segs: Segment[] = [{ id: 0, start: 0, end: 2, text: 'already short' }]
    const result = splitSegments(segs, [], 3.5)
    expect(result).toEqual(segs)
  })
})
