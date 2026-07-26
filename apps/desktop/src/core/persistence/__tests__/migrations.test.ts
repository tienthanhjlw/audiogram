import { describe, expect, it } from 'vitest'
import { migrate, type SessionFileV1 } from '../migrations'

const VALID: SessionFileV1 = {
  version: 1,
  savedAt: '2026-07-27T00:00:00.000Z',
  project: { audioPath: '/a.mp3', audioName: 'a.mp3', title: 'A' },
  design: {
    layoutTemplate: 'minimal', waveStyle: 'bar', waveColor: '#fff', bgColor: '#000',
    coverImagePath: '', zones: null, titleColor: '#fff', titleAlign: 'center',
    titleBold: false, titleItalic: false, fontSize: 100, fontName: 'Arial',
  },
  captions: {
    segments: [], srtPath: '', showSubtitles: true, whisperModel: 'base',
    karaokeEnabled: false, karaokeColor: '#FFD60A', subtitleColor: '#fff', subtitleYPct: null,
  },
}

describe('migrate', () => {
  it('passes through a valid v1 session unchanged', () => {
    expect(migrate(VALID)).toEqual(VALID)
  })

  it('rejects null/undefined/non-objects', () => {
    expect(migrate(null)).toBeNull()
    expect(migrate(undefined)).toBeNull()
    expect(migrate('not json')).toBeNull()
    expect(migrate(42)).toBeNull()
  })

  it('rejects an unrecognized version', () => {
    expect(migrate({ ...VALID, version: 99 })).toBeNull()
  })

  it('rejects a v1 session missing a required section', () => {
    const { project, ...rest } = VALID
    void project
    expect(migrate(rest)).toBeNull()
  })

  it('rejects a v1 session with a non-string savedAt', () => {
    expect(migrate({ ...VALID, savedAt: 12345 })).toBeNull()
  })
})
