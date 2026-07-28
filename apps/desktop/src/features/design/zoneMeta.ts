import type { SelectedEl } from '../../store'

/** Per-element accent colors for the zone editor (selection outline, badge
 * background, inspector header dot) — a fixed color-per-element-type
 * scheme distinct from the app's theme tokens (ui/tokens.css), so not
 * drawn from --color-accent/etc. Was duplicated verbatim in CanvasStage.tsx
 * and DesignInspector.tsx (P4-T7 audit); shared here instead. */
export const EL_META: Record<Exclude<SelectedEl, null>, { label: string; color: string }> = {
  wave:     { label: 'Waveform', color: '#6C4FF6' },
  title:    { label: 'Title',    color: '#F59E0B' },
  subtitle: { label: 'Subtitle', color: '#22C55E' },
  avatar:   { label: 'Avatar',   color: '#EC4FC4' },
}
