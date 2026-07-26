import type { StateCreator } from 'zustand'
import type { AppStore } from './index'

// `peaks` existed pre-Phase-1 (populated by WaveformCanvas's onPeaksReady).
// `playing`/`currentTime`/`duration` are new (T7). AudioEngine (T10, via
// core/audio/bootstrap.ts) is the sole writer for all four — everything
// else must treat them as read-only and call `audioEngine` methods instead.
export interface PlaybackSlice {
  peaks: number[]
  playing: boolean
  currentTime: number
  duration: number
  /** Engine-only setter (core/audio/bootstrap.ts). Not part of the public
   * store contract any component should call directly. */
  _setFromEngine: (patch: Partial<Pick<PlaybackSlice, 'peaks' | 'playing' | 'currentTime' | 'duration'>>) => void
}

export const createPlaybackSlice: StateCreator<AppStore, [], [], PlaybackSlice> = set => ({
  peaks: [],
  playing: false,
  currentTime: 0,
  duration: 0,
  _setFromEngine: patch => set(patch),
})
