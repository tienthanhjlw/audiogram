import { create } from 'zustand'
import { AppState, Step } from './types'

const STEPS: Step[] = ['upload', 'layout', 'transcript', 'export']

export const DEFAULT_STATE: AppState = {
  step: 'upload',
  audioPath: '',
  audioName: '',
  title: '',
  canvasSize: '1:1',
  layoutTemplate: 'minimal',
  coverImagePath: '',
  waveStyle: 'bar',
  waveColor: '#FFFFFF',
  bgColor: '#111827',
  fps: 30,
  logs: [],
  isRendering: false,
  lastOutput: '',
  segments: [],
  srtPath: '',
  isTranscribing: false,
  showSubtitles: true,
  whisperModel: 'base',
  peaks: [],
  fontSize: 100,
  fontName: 'Arial',
  karaokeEnabled: false,
  karaokeColor: '#FFD60A',
  subtitleColor: '#FFFFFF',
  subtitleYPct: null,
  zones: null,
  titleColor:  '#FFFFFF',
  titleAlign:  'center',
  titleBold:   false,
  titleItalic: false,
}

interface AppStore extends AppState {
  set: (patch: Partial<AppState>) => void
  goTo: (step: Step) => void
  next: () => void
  back: () => void
}

export const useAppStore = create<AppStore>((setState, get) => ({
  ...DEFAULT_STATE,

  set: (patch) => setState(patch),

  goTo: (step) => setState({ step }),

  next: () => {
    const idx = STEPS.indexOf(get().step)
    if (idx < STEPS.length - 1) setState({ step: STEPS[idx + 1] })
  },

  back: () => {
    const idx = STEPS.indexOf(get().step)
    if (idx > 0) setState({ step: STEPS[idx - 1] })
  },
}))
