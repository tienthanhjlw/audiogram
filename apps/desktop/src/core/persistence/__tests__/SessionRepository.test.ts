import { beforeEach, describe, expect, it, vi } from 'vitest'

// In-memory fake filesystem, scoped to this test file — SessionRepository
// only ever touches two files (session.json, recents.json) inside one
// AppData subdirectory, so a Map keyed by path is enough; no need for a
// real filesystem or the native `@tauri-apps/plugin-fs` binding in tests.
const fakeFs = new Map<string, string>()

vi.mock('@tauri-apps/plugin-fs', () => ({
  BaseDirectory: { AppData: 'AppData' },
  exists: vi.fn(async (path: string) => path === 'audiogram' || fakeFs.has(path)),
  mkdir: vi.fn(async () => {}),
  readTextFile: vi.fn(async (path: string) => {
    if (!fakeFs.has(path)) throw new Error(`not found: ${path}`)
    return fakeFs.get(path)!
  }),
  writeTextFile: vi.fn(async (path: string, data: string) => { fakeFs.set(path, data) }),
}))

const {
  loadSession, saveSession, clearSession, listRecents, pushRecent, removeRecent,
  hasSeenDesignHint, markDesignHintSeen,
} = await import('../SessionRepository')
const { CURRENT_SESSION_VERSION } = await import('../migrations')
import type { SessionFile } from '../migrations'
import type { RecentEntry } from '../SessionRepository'

function makeSession(): SessionFile {
  return {
    version: CURRENT_SESSION_VERSION,
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

function makeRecent(i: number): RecentEntry {
  return {
    audioPath: `/audio-${i}.mp3`,
    audioName: `audio-${i}.mp3`,
    title: `Episode ${i}`,
    duration: 60 + i,
    thumbnailPng: null,
    savedAt: new Date(2026, 0, i).toISOString(),
  }
}

beforeEach(() => {
  fakeFs.clear()
})

describe('session.json', () => {
  it('loadSession returns null when nothing has been saved', async () => {
    expect(await loadSession()).toBeNull()
  })

  it('round-trips through saveSession/loadSession', async () => {
    const session = makeSession()
    await saveSession(session)
    expect(await loadSession()).toEqual(session)
  })

  it('clearSession makes loadSession behave as if nothing was ever saved', async () => {
    await saveSession(makeSession())
    await clearSession()
    expect(await loadSession()).toBeNull()
  })
})

describe('onboarding.json', () => {
  it('hasSeenDesignHint is false until markDesignHintSeen is called', async () => {
    expect(await hasSeenDesignHint()).toBe(false)
    await markDesignHintSeen()
    expect(await hasSeenDesignHint()).toBe(true)
  })
})

describe('recents.json', () => {
  it('listRecents returns [] when nothing has been saved', async () => {
    expect(await listRecents()).toEqual([])
  })

  it('pushRecent adds entries newest-first', async () => {
    await pushRecent(makeRecent(1))
    await pushRecent(makeRecent(2))
    const list = await listRecents()
    expect(list.map(e => e.audioPath)).toEqual(['/audio-2.mp3', '/audio-1.mp3'])
  })

  it('pushing the same audioPath again dedupes and moves it to the front', async () => {
    await pushRecent(makeRecent(1))
    await pushRecent(makeRecent(2))
    const updated = { ...makeRecent(1), title: 'Retitled' }
    await pushRecent(updated)
    const list = await listRecents()
    expect(list).toHaveLength(2)
    expect(list[0]).toEqual(updated)
  })

  it('trims to a maximum of 8 entries, newest first', async () => {
    for (let i = 1; i <= 10; i++) await pushRecent(makeRecent(i))
    const list = await listRecents()
    expect(list).toHaveLength(8)
    expect(list.map(e => e.audioPath)).toEqual([
      '/audio-10.mp3', '/audio-9.mp3', '/audio-8.mp3', '/audio-7.mp3',
      '/audio-6.mp3', '/audio-5.mp3', '/audio-4.mp3', '/audio-3.mp3',
    ])
  })

  it('removeRecent drops just the matching entry', async () => {
    await pushRecent(makeRecent(1))
    await pushRecent(makeRecent(2))
    await removeRecent('/audio-1.mp3')
    const list = await listRecents()
    expect(list.map(e => e.audioPath)).toEqual(['/audio-2.mp3'])
  })
})
