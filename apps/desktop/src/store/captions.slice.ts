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
})
