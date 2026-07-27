import { describe, it, expect } from 'vitest'
import { matchesSearch, normalizeForSearch } from '../search'

describe('normalizeForSearch', () => {
  it('strips Vietnamese diacritics and lowercases', () => {
    expect(normalizeForSearch('Kinh thánh')).toBe('kinh thanh')
    expect(normalizeForSearch('ĐIỀU NÀY')).toBe('dieu nay')
  })
})

describe('matchesSearch', () => {
  it('matches an undecorated query against accented text', () => {
    expect(matchesSearch('Kinh thánh là nơi', 'kinh thanh')).toBe(true)
  })

  it('matches đ/Đ folded to d/D', () => {
    expect(matchesSearch('Điều này đúng', 'dieu nay dung')).toBe(true)
  })

  it('is case-insensitive both ways', () => {
    expect(matchesSearch('Hello World', 'WORLD')).toBe(true)
  })

  it('returns false when the query does not appear', () => {
    expect(matchesSearch('Kinh thánh là nơi', 'khong co')).toBe(false)
  })

  it('treats an empty or whitespace query as matching everything', () => {
    expect(matchesSearch('anything', '')).toBe(true)
    expect(matchesSearch('anything', '   ')).toBe(true)
  })
})
