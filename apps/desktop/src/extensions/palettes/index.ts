// Built-in PaletteExtension registrations — 4 color palettes. `wave`/`bg`
// wrap existing WAVE_COLORS/BG_COLORS (types.ts). `subtitle`/`karaoke` are
// moved verbatim (PHASE2_TASKS.md T1 step 4 — "copy giá trị nguyên văn")
// from StepTranscript.tsx's former local SUBTITLE_COLORS/KARAOKE_COLORS
// constants; StepTranscript now imports them from here instead of
// declaring its own copy.
import { BG_COLORS, WAVE_COLORS } from '../../types'
import { palettePoint, type PaletteExtension } from '../kernel'

export const KARAOKE_COLORS = [
  { hex: '#FFD60A', name: 'Yellow' }, { hex: '#06B6D4', name: 'Cyan' },
  { hex: '#EC4FC4', name: 'Pink'   }, { hex: '#6C4FF6', name: 'Purple' },
  { hex: '#22C55E', name: 'Green'  }, { hex: '#F97316', name: 'Orange' },
]

export const SUBTITLE_COLORS = [
  { hex: '#FFFFFF', name: 'White'    }, { hex: '#FEF9C3', name: 'Cream' },
  { hex: '#BAE6FD', name: 'Sky'      }, { hex: '#BBF7D0', name: 'Mint'  },
  { hex: '#FBCFE8', name: 'Rose'     }, { hex: '#E9D5FF', name: 'Lavender' },
]

export function registerBuiltinPalettes(): void {
  const palettes: PaletteExtension[] = [
    { manifest: { id: 'com.audiogram.palette.wave', kind: 'palette', version: '0.0.0', label: 'Wave', builtin: true }, colors: WAVE_COLORS, for: 'wave' },
    { manifest: { id: 'com.audiogram.palette.bg', kind: 'palette', version: '0.0.0', label: 'Background', builtin: true }, colors: BG_COLORS, for: 'bg' },
    { manifest: { id: 'com.audiogram.palette.subtitle', kind: 'palette', version: '0.0.0', label: 'Subtitle', builtin: true }, colors: SUBTITLE_COLORS, for: 'subtitle' },
    { manifest: { id: 'com.audiogram.palette.karaoke', kind: 'palette', version: '0.0.0', label: 'Karaoke', builtin: true }, colors: KARAOKE_COLORS, for: 'karaoke' },
  ]
  for (const p of palettes) {
    if (!palettePoint.get(p.manifest.id)) palettePoint.register(p)
  }
}
