import { describe, expect, it } from 'vitest'
import { estimateSize, estimateTime } from '../estimate'

describe('estimateSize', () => {
  it('gives a plausible range for a 720p 30fps 60s export', () => {
    const bytes = estimateSize(60, '16:9', 30)
    const mb = bytes / (1024 * 1024)
    expect(mb).toBeGreaterThan(5)
    expect(mb).toBeLessThan(60)
  })

  it('is monotonically increasing in duration', () => {
    expect(estimateSize(120, '16:9', 30)).toBeGreaterThan(estimateSize(60, '16:9', 30))
  })

  it('is monotonically increasing in fps', () => {
    expect(estimateSize(60, '16:9', 60)).toBeGreaterThan(estimateSize(60, '16:9', 30))
  })

  it('is monotonically increasing in resolution (more pixels)', () => {
    expect(estimateSize(60, '9:16', 30)).toBeGreaterThan(estimateSize(60, '16:9', 30))
  })
})

describe('estimateTime', () => {
  it('returns a positive number of seconds', () => {
    expect(estimateTime(60, 30, '16:9')).toBeGreaterThan(0)
  })

  it('is monotonically increasing in duration', () => {
    expect(estimateTime(120, 30, '16:9')).toBeGreaterThan(estimateTime(60, 30, '16:9'))
  })

  it('is monotonically increasing in fps', () => {
    expect(estimateTime(60, 60, '16:9')).toBeGreaterThan(estimateTime(60, 30, '16:9'))
  })

  it('is monotonically increasing in resolution (more pixels)', () => {
    expect(estimateTime(60, 30, '9:16')).toBeGreaterThan(estimateTime(60, 30, '16:9'))
  })
})
