import { describe, expect, it } from 'vitest'
import { mergeWithNext, remove, splitAt } from './ops'
import type { Segment } from './types'

function segs(): Segment[] {
  return [
    { id: 0, start: 0, end: 4, text: 'one two three four' },
    { id: 1, start: 4, end: 6, text: 'five six' },
    { id: 2, start: 6, end: 9, text: 'seven eight nine' },
  ]
}

describe('splitAt', () => {
  it('splits the target segment at the given time, dividing its text proportionally', () => {
    const result = splitAt(segs(), 0, 2) // midpoint of a 4s, 4-word segment
    expect(result).toHaveLength(4)
    expect(result[0]).toMatchObject({ start: 0, end: 2 })
    expect(result[1]).toMatchObject({ start: 2, end: 4 })
    expect(result[0].text + ' ' + result[1].text).toBe('one two three four')
  })

  it('re-ids sequentially after the split', () => {
    const result = splitAt(segs(), 1, 5)
    expect(result.map(s => s.id)).toEqual([0, 1, 2, 3])
  })

  it('is a no-op when t is outside the target segment', () => {
    const original = segs()
    expect(splitAt(original, 0, 5)).toEqual(original)
    expect(splitAt(original, 0, 0)).toEqual(original)
    expect(splitAt(original, 0, 4)).toEqual(original)
  })

  it('is a no-op on a single-word segment (nothing to divide)', () => {
    const original: Segment[] = [{ id: 0, start: 0, end: 4, text: 'onlyword' }]
    expect(splitAt(original, 0, 2)).toEqual(original)
  })
})

describe('mergeWithNext', () => {
  it('merges a segment with the one after it, spanning both time ranges', () => {
    const result = mergeWithNext(segs(), 0)
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ start: 0, end: 6, text: 'one two three four five six' })
    expect(result[1]).toMatchObject({ start: 6, end: 9 })
  })

  it('re-ids sequentially after merging', () => {
    const result = mergeWithNext(segs(), 1)
    expect(result.map(s => s.id)).toEqual([0, 1])
  })

  it('is a no-op on the last segment (nothing after it)', () => {
    const original = segs()
    expect(mergeWithNext(original, 2)).toEqual(original)
  })
})

describe('remove', () => {
  it('removes the segment at the given index', () => {
    const result = remove(segs(), 1)
    expect(result.map(s => s.text)).toEqual(['one two three four', 'seven eight nine'])
  })

  it('re-ids sequentially after removing', () => {
    const result = remove(segs(), 0)
    expect(result.map(s => s.id)).toEqual([0, 1])
  })
})
