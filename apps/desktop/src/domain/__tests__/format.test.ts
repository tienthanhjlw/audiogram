import { describe, expect, it } from 'vitest'
import { formatBytes, formatDuration, formatRelativeTime, slugify } from '../format'

const NOW = new Date('2026-07-27T12:00:00.000Z').getTime()

describe('formatRelativeTime', () => {
  it('< 1 minute → "Just now"', () => {
    expect(formatRelativeTime(new Date(NOW - 10_000).toISOString(), NOW)).toBe('Just now')
  })

  it('minutes ago', () => {
    expect(formatRelativeTime(new Date(NOW - 5 * 60_000).toISOString(), NOW)).toBe('5 minutes ago')
  })

  it('singular minute', () => {
    expect(formatRelativeTime(new Date(NOW - 1 * 60_000).toISOString(), NOW)).toBe('1 minute ago')
  })

  it('hours ago', () => {
    expect(formatRelativeTime(new Date(NOW - 3 * 3_600_000).toISOString(), NOW)).toBe('3 hours ago')
  })

  it('days ago', () => {
    expect(formatRelativeTime(new Date(NOW - 2 * 86_400_000).toISOString(), NOW)).toBe('2 days ago')
  })

  it('weeks ago (>7 days, <30 days)', () => {
    expect(formatRelativeTime(new Date(NOW - 10 * 86_400_000).toISOString(), NOW)).toBe('1 week ago')
  })

  it('falls back to a locale date beyond 30 days', () => {
    const then = new Date(NOW - 40 * 86_400_000)
    expect(formatRelativeTime(then.toISOString(), NOW)).toBe(then.toLocaleDateString())
  })

  it('invalid input returns empty string', () => {
    expect(formatRelativeTime('not a date', NOW)).toBe('')
  })
})

describe('formatDuration', () => {
  it('formats seconds as m:ss', () => {
    expect(formatDuration(84)).toBe('1:24')
    expect(formatDuration(5)).toBe('0:05')
    expect(formatDuration(600)).toBe('10:00')
  })

  it('handles invalid input', () => {
    expect(formatDuration(NaN)).toBe('0:00')
    expect(formatDuration(-5)).toBe('0:00')
  })
})

describe('slugify', () => {
  it('lowercases and hyphenates', () => {
    expect(slugify('My Episode Title')).toBe('my-episode-title')
  })

  it('collapses punctuation and trims stray hyphens', () => {
    expect(slugify('  Ep. 12: The Return!! ')).toBe('ep-12-the-return')
  })

  it('falls back to "audiogram" for an empty or all-punctuation title', () => {
    expect(slugify('')).toBe('audiogram')
    expect(slugify('***')).toBe('audiogram')
  })
})

describe('formatBytes', () => {
  it('formats sub-1000MB sizes with one decimal under 10MB', () => {
    expect(formatBytes(5.5 * 1024 * 1024)).toBe('5.5 MB')
  })

  it('formats double/triple-digit MB with no decimal', () => {
    expect(formatBytes(45 * 1024 * 1024)).toBe('45 MB')
  })

  it('formats GB past 1000MB', () => {
    expect(formatBytes(1536 * 1024 * 1024)).toBe('1.5 GB')
  })

  it('handles invalid/zero input', () => {
    expect(formatBytes(0)).toBe('0 MB')
    expect(formatBytes(NaN)).toBe('0 MB')
  })
})
