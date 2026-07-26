// Built-in TemplateExtension registrations — wraps the existing
// LAYOUT_TEMPLATES/DEFAULT_ZONES data (types.ts) rather than redeclaring it,
// per PHASE2_TASKS.md T1 ("Không viết lại data"). Registration order mirrors
// LAYOUT_TEMPLATES's declaration order, which is the product's intended
// gallery order (UI_DESIGN_SPEC.md §4.1) — not re-sorted.
import { DEFAULT_ZONES, LAYOUT_TEMPLATES } from '../../types'
import { templatePoint, type TemplateExtension } from '../kernel'

export function registerBuiltinTemplates(): void {
  for (const t of LAYOUT_TEMPLATES) {
    const ext: TemplateExtension = {
      manifest: {
        id: `com.audiogram.template.${t.id}`,
        kind: 'template',
        version: '0.0.0',
        label: t.name,
        builtin: true,
      },
      zones: DEFAULT_ZONES[t.id],
      defaults: {
        waveColor: t.defaultWaveColor,
        bgColor: t.defaultBgColor,
        waveStyle: t.defaultWaveStyle,
        karaoke: t.defaultKaraoke,
      },
      needsAvatar: t.needsAvatar,
      tags: t.tags,
    }
    if (!templatePoint.get(ext.manifest.id)) templatePoint.register(ext)
  }
}
