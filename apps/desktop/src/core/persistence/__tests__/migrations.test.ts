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
  it('passes through a valid v1 session, backfilling nodes (P5-T6)', () => {
    const result = migrate(VALID)
    expect(result).not.toBeNull()
    // Everything except `design.nodes` (absent on VALID, backfilled below) is unchanged.
    expect({ ...result, design: { ...result!.design, nodes: undefined } })
      .toEqual({ ...VALID, design: { ...VALID.design, nodes: undefined } })
    // waveStyle:'bar' + title:'A' (from project.title) → at least a waveform + title node.
    expect(result!.design.nodes!.length).toBeGreaterThanOrEqual(2)
    expect(result!.design.nodes!.some(n => n.type === 'waveform')).toBe(true)
    expect(result!.design.nodes!.some(n => n.type === 'text')).toBe(true)
  })

  it('does not re-derive nodes when the session already has them (idempotent)', () => {
    const first = migrate(VALID)!
    const second = migrate(first)!
    expect(second.design.nodes).toEqual(first.design.nodes)
    // Re-migrating a second time must not double up or regenerate ids.
    const third = migrate(second)!
    expect(third.design.nodes).toEqual(first.design.nodes)
  })

  it('backfills an empty nodes array when the legacy fields have nothing to convert', () => {
    const bare: SessionFileV1 = {
      ...VALID,
      project: { ...VALID.project, title: '' },
      design: { ...VALID.design, waveStyle: 'bar' },
      captions: { ...VALID.captions, showSubtitles: false },
    }
    const result = migrate(bare)
    // Waveform node always exists (it's the one thing every layout draws);
    // no title text, no cover image, no captions → nothing else.
    expect(result!.design.nodes!.length).toBe(1)
    expect(result!.design.nodes![0].type).toBe('waveform')
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
