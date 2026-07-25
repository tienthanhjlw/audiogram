// Wave effect registry — single source of truth for all visual styles.
// To add a style: create `<name>.ts`, import it, add one entry below.
// Each effect pairs 1:1 with a Rust counterpart in render/wave/effects/<name>.rs.
import type { WaveStyle } from '../types'
import type { WaveEffect } from './types'
import { barEffect } from './bar'
import { lineEffect } from './line'
import { mirrorEffect } from './mirror'
import { dotEffect } from './dot'
import { neonEffect } from './neon'
import { orbEffect } from './orb'
import { pulseEffect } from './pulse'
import { eqEffect } from './eq'
import { playerEffect } from './player'

export const WAVE_EFFECTS: Record<WaveStyle, WaveEffect> = {
  bar:    barEffect,
  line:   lineEffect,
  mirror: mirrorEffect,
  dot:    dotEffect,
  neon:   neonEffect,
  orb:    orbEffect,
  pulse:  pulseEffect,
  eq:     eqEffect,
  player: playerEffect,
}

/** UI list (id/label/desc) derived from the registry — no separate duplicate. */
export const WAVE_STYLES: { id: WaveStyle; label: string; desc: string }[] =
  Object.values(WAVE_EFFECTS).map(({ id, label, desc }) => ({ id, label, desc }))

export type { WaveEffect, WaveDrawCtx } from './types'
