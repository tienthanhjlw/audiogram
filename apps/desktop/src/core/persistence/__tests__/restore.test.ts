import { describe, expect, it, vi } from 'vitest'
import type { SessionFile } from '../migrations'

const loadSession = vi.fn<() => Promise<SessionFile | null>>()
const audioFileExists = vi.fn<(path: string) => Promise<boolean>>()

vi.mock('../SessionRepository', () => ({ loadSession, audioFileExists }))

const { restoreLastSession, sessionToPatch } = await import('../restore')

function makeSession(): SessionFile {
  return {
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
}

function fakeStore(getState: () => { set: ReturnType<typeof vi.fn> }) {
  return { getState } as unknown as Parameters<typeof restoreLastSession>[0]
}

describe('sessionToPatch', () => {
  it('maps every session field onto the flat store shape and jumps to Studio', () => {
    const patch = sessionToPatch(makeSession())
    expect(patch.audioPath).toBe('/a.mp3')
    expect(patch.layoutTemplate).toBe('minimal')
    expect(patch.segments).toEqual([])
    expect(patch.screen).toBe('studio')
  })
})

describe('restoreLastSession', () => {
  it('does nothing when there is no saved session', async () => {
    loadSession.mockResolvedValue(null)
    const set = vi.fn()
    await restoreLastSession(fakeStore(() => ({ set })))
    expect(set).not.toHaveBeenCalled()
  })

  it('restores straight into Studio when the audio file still exists', async () => {
    loadSession.mockResolvedValue(makeSession())
    audioFileExists.mockResolvedValue(true)
    const set = vi.fn()
    await restoreLastSession(fakeStore(() => ({ set })))
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ screen: 'studio', audioPath: '/a.mp3' }))
  })

  it('stashes pendingMissingSession instead of restoring when the audio file is gone', async () => {
    const session = makeSession()
    loadSession.mockResolvedValue(session)
    audioFileExists.mockResolvedValue(false)
    const set = vi.fn()
    await restoreLastSession(fakeStore(() => ({ set })))
    expect(set).toHaveBeenCalledWith({ pendingMissingSession: session })
  })
})
