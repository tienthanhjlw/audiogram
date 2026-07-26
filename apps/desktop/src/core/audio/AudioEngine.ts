import { convertFileSrc } from '@tauri-apps/api/core'
import { buildEnvelope, fallbackEnvelope } from './envelope'

export interface AudioEnvelope {
  peaks: number[]
  duration: number
}

export interface AudioEngineTick {
  currentTime: number
  playing: boolean
  duration: number
}

const MAX_CACHE_ENTRIES = 2

/** TECH_ARCHITECTURE.md §2.6 — singleton that lives outside React, owns the
 * one `<audio>` element for the app, and decodes each file exactly once.
 * core/ (this module included) must not import the store — bootstrap.ts is
 * the seam that wires this engine's callbacks into playback.slice, so this
 * class stays reusable and independently testable. */
class AudioEngine {
  private audioEl = new Audio()
  private cache = new Map<string, AudioEnvelope>()
  private loadedPath = ''
  private tickCbs = new Set<(tick: AudioEngineTick) => void>()
  private frameCbs = new Set<(currentTime: number) => void>()
  private rafId: number | null = null
  private lastTickAt = 0

  constructor() {
    this.audioEl.addEventListener('timeupdate', this.handleTimeUpdate)
    this.audioEl.addEventListener('play', this.emitTick)
    this.audioEl.addEventListener('pause', this.emitTick)
    this.audioEl.addEventListener('ended', this.emitTick)
  }

  /** Decode once per path (cached), swap the `<audio>` element's source, and
   * return the envelope + duration for playback.slice. */
  async load(path: string): Promise<AudioEnvelope> {
    this.loadedPath = path
    this.audioEl.pause()
    this.audioEl.src = path ? convertFileSrc(path) : ''
    this.audioEl.currentTime = 0

    const cached = this.cache.get(path)
    if (cached) {
      this.emitTick()
      return cached
    }

    const envelope = await this.decode(path)
    this.cache.set(path, envelope)
    if (this.cache.size > MAX_CACHE_ENTRIES) {
      const oldest = this.cache.keys().next().value
      if (oldest !== undefined) this.cache.delete(oldest)
    }
    // A rapid re-navigation could have changed the target path while this
    // decode was in flight; only surface the result if it's still current.
    if (this.loadedPath === path) this.emitTick()
    return envelope
  }

  private async decode(path: string): Promise<AudioEnvelope> {
    try {
      const buf = await fetch(convertFileSrc(path)).then(r => r.arrayBuffer())
      const decoded = await new AudioContext().decodeAudioData(buf)
      const peaks = buildEnvelope(decoded.getChannelData(0), decoded.duration)
      return { peaks, duration: decoded.duration }
    } catch {
      return fallbackEnvelope()
    }
  }

  play(): void {
    void this.audioEl.play()
  }

  pause(): void {
    this.audioEl.pause()
  }

  toggle(): void {
    if (this.audioEl.paused) this.play()
    else this.pause()
  }

  seek(t: number): void {
    const max = Number.isFinite(this.audioEl.duration) ? this.audioEl.duration : t
    this.audioEl.currentTime = Math.max(0, Math.min(t, max))
  }

  seekBy(dt: number): void {
    this.seek(this.audioEl.currentTime + dt)
  }

  /** Store-facing subscription, throttled to 10Hz (TECH_ARCHITECTURE §4.3) —
   * bootstrap.ts is the only caller in Phase 1. */
  onTick(cb: (tick: AudioEngineTick) => void): () => void {
    this.tickCbs.add(cb)
    return () => this.tickCbs.delete(cb)
  }

  /** Hot-path subscription for canvas/transport-bar consumers that need
   * `currentTime` every animation frame without going through the store
   * (TECH_ARCHITECTURE §4.3). The rAF loop only runs while someone's
   * subscribed. */
  onFrame(cb: (currentTime: number) => void): () => void {
    this.frameCbs.add(cb)
    this.ensureFrameLoop()
    return () => this.frameCbs.delete(cb)
  }

  private ensureFrameLoop(): void {
    if (this.rafId !== null) return
    const tick = () => {
      if (this.frameCbs.size === 0) { this.rafId = null; return }
      const t = this.audioEl.currentTime
      this.frameCbs.forEach(cb => cb(t))
      this.rafId = requestAnimationFrame(tick)
    }
    this.rafId = requestAnimationFrame(tick)
  }

  private handleTimeUpdate = (): void => {
    const now = performance.now()
    if (now - this.lastTickAt < 100) return // throttle to 10Hz
    this.lastTickAt = now
    this.emitTick()
  }

  private emitTick = (): void => {
    const tick: AudioEngineTick = {
      currentTime: this.audioEl.currentTime,
      playing: !this.audioEl.paused,
      duration: Number.isFinite(this.audioEl.duration) ? this.audioEl.duration : 0,
    }
    this.tickCbs.forEach(cb => cb(tick))
  }
}

export const audioEngine = new AudioEngine()
