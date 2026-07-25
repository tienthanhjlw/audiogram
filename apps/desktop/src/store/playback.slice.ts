import type { StateCreator } from 'zustand'
import type { AppStore } from './index'

// `peaks` existed pre-Phase-1 (populated by WaveformCanvas's onPeaksReady).
// `playing`/`currentTime`/`duration` are new (T7) — AudioEngine (T10) will
// be the sole writer for those three; nothing sets them yet.
export interface PlaybackSlice {
  peaks: number[]
  playing: boolean
  currentTime: number
  duration: number
}

export const createPlaybackSlice: StateCreator<AppStore, [], [], PlaybackSlice> = () => ({
  peaks: [],
  playing: false,
  currentTime: 0,
  duration: 0,
})
