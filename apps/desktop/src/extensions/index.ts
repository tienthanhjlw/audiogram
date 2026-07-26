// Bootstrap entry point — called once from main.tsx. Idempotent: each
// registerBuiltin* guards with `.get(id)` before registering, so calling
// this twice (e.g. Vite HMR re-running module bodies) doesn't throw on a
// duplicate id.
import { registerBuiltinPalettes } from './palettes'
import { registerBuiltinTemplates } from './templates'
import { registerBuiltinWaves } from './waves'

export function registerBuiltins(): void {
  registerBuiltinTemplates()
  registerBuiltinWaves()
  registerBuiltinPalettes()
}

export { wavePoint, templatePoint, palettePoint, presetPoint } from './kernel'
export type {
  ExtensionManifest,
  WaveExtension,
  TemplateExtension,
  PaletteExtension,
  ExportPresetExtension,
} from './kernel'
