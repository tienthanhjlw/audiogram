// Session + recents persistence — TECH_ARCHITECTURE.md §2.2
// (`core/persistence/`), §2.5 (schema/partialize/recents). Doesn't import
// the store (like AudioEngine — see core/audio/AudioEngine.ts's header);
// attach.ts is the seam that reads store state and calls into this.
import {
  BaseDirectory, exists, mkdir, readTextFile, writeTextFile,
} from '@tauri-apps/plugin-fs'
import { migrate, type SessionFile } from './migrations'

const SESSION_FILE = 'audiogram/session.json'
const RECENTS_FILE = 'audiogram/recents.json'
const MAX_RECENTS = 8

export interface RecentEntry {
  audioPath: string
  audioName: string
  title: string
  duration: number
  thumbnailPng: string | null
  savedAt: string
}

// All writes go through this queue, one at a time — a debounced session
// save landing while a recents write from a prior call is still in flight
// (both hit the same `audiogram/` directory) would otherwise risk a
// torn/interleaved write; a plain FIFO queue is simpler than a file lock and
// this directory only ever has two writers in the whole app.
let writeQueue: Promise<unknown> = Promise.resolve()

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const result = writeQueue.then(fn, fn)
  writeQueue = result.catch(() => {})
  return result
}

async function ensureDir(): Promise<void> {
  const dirExists = await exists('audiogram', { baseDir: BaseDirectory.AppData })
  if (!dirExists) await mkdir('audiogram', { baseDir: BaseDirectory.AppData, recursive: true })
}

async function readJson<T>(path: string): Promise<T | null> {
  try {
    const fileExists = await exists(path, { baseDir: BaseDirectory.AppData })
    if (!fileExists) return null
    const text = await readTextFile(path, { baseDir: BaseDirectory.AppData })
    return JSON.parse(text) as T
  } catch (e) {
    console.warn(`[persistence] failed to read ${path}:`, e)
    return null
  }
}

async function writeJson(path: string, data: unknown): Promise<void> {
  return enqueue(async () => {
    try {
      await ensureDir()
      await writeTextFile(path, JSON.stringify(data, null, 2), { baseDir: BaseDirectory.AppData })
    } catch (e) {
      console.warn(`[persistence] failed to write ${path}:`, e)
    }
  })
}

/** Loads and validates the last session, or null if there isn't one / it's
 * corrupt (migrate() never throws — see migrations.ts). */
export async function loadSession(): Promise<SessionFile | null> {
  const raw = await readJson<unknown>(SESSION_FILE)
  if (raw === null) return null
  return migrate(raw)
}

export async function saveSession(session: SessionFile): Promise<void> {
  await writeJson(SESSION_FILE, session)
}

export async function listRecents(): Promise<RecentEntry[]> {
  const raw = await readJson<RecentEntry[]>(RECENTS_FILE)
  return Array.isArray(raw) ? raw : []
}

/** Adds/updates one entry (deduped by audioPath, moved to the front) and
 * trims to MAX_RECENTS, newest first. */
export async function pushRecent(entry: RecentEntry): Promise<void> {
  const current = await listRecents()
  const withoutDup = current.filter(e => e.audioPath !== entry.audioPath)
  const next = [entry, ...withoutDup].slice(0, MAX_RECENTS)
  await writeJson(RECENTS_FILE, next)
}

export async function removeRecent(audioPath: string): Promise<void> {
  const current = await listRecents()
  const next = current.filter(e => e.audioPath !== audioPath)
  await writeJson(RECENTS_FILE, next)
}

/** Best-effort check for whether a recent entry's audio file still exists on
 * disk — used by RecentGrid (P2-T5) to show the "File missing" badge.
 * `exists()` is scoped to AppData by our capabilities (T4); an arbitrary
 * absolute audio path is outside that scope, so a permission error here is
 * expected and just means "assume it's still there, let decode surface the
 * real error" rather than widening the fs scope app-wide (PHASE2_TASKS.md
 * T4 step 1). */
export async function audioFileExists(audioPath: string): Promise<boolean> {
  try {
    return await exists(audioPath)
  } catch {
    return true
  }
}
