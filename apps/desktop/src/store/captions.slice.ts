import type { StateCreator } from 'zustand'
import type { Segment } from '../types'
import type { AppStore } from './index'

export interface CaptionsSlice {
  segments: Segment[]
  srtPath: string
  isTranscribing: boolean
  showSubtitles: boolean
  whisperModel: string
  karaokeEnabled: boolean
  karaokeColor: string
  subtitleColor: string
  subtitleYPct: number | null
  /** New in T8 — written once by core/ipc/events.ts's 'model_download_progress'
   * subscription, instead of each component keeping its own local listener. */
  modelDownload: { name: string; pct: number } | null
}

export const createCaptionsSlice: StateCreator<AppStore, [], [], CaptionsSlice> = () => ({
  segments: [],
  srtPath: '',
  isTranscribing: false,
  showSubtitles: true,
  whisperModel: 'base',
  karaokeEnabled: false,
  karaokeColor: '#FFD60A',
  subtitleColor: '#FFFFFF',
  subtitleYPct: null,
  modelDownload: null,
})
