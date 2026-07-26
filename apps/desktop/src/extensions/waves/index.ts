// Built-in WaveExtension registrations — wraps @audiogram/wave-effects'
// WAVE_EFFECTS registry (already the single source of truth for draw
// functions, P1-T17) rather than moving that code here. Registration order
// mirrors WAVE_EFFECTS' key order (bar/line/mirror/dot/neon/orb/pulse/eq/
// player — the gallery order in UI_DESIGN_SPEC.md §4.1).
import { WAVE_EFFECTS } from '@audiogram/wave-effects'
import { wavePoint, type WaveExtension } from '../kernel'

export function registerBuiltinWaves(): void {
  for (const effect of Object.values(WAVE_EFFECTS)) {
    const ext: WaveExtension = {
      manifest: {
        id: `com.audiogram.wave.${effect.id}`,
        kind: 'wave',
        version: '0.0.0',
        label: effect.label,
        builtin: true,
      },
      draw: effect.draw,
      rustId: effect.id,
    }
    if (!wavePoint.get(ext.manifest.id)) wavePoint.register(ext)
  }
}
