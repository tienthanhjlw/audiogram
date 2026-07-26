// Extension kernel — TECH_ARCHITECTURE.md §3.1–3.2 "Cấp 0" (built-in,
// compile-time extensions registered through one mechanism instead of each
// content category — templates, wave styles, palettes, export presets —
// growing its own ad-hoc array). Everything registered here today is
// builtin; Cấp 1 (data extensions loaded from app_data_dir) and Cấp 2
// (wave effect DSL/WASM) are later phases that reuse this same registry
// shape without changing any call site.

export interface ExtensionManifest {
  /** Reverse-DNS-ish stable id, e.g. 'com.audiogram.wave.bar'. */
  id: string
  kind: 'wave' | 'template' | 'palette' | 'export-preset'
  /** Semver — unused by builtins today, reserved for Cấp 1 data extension migrations. */
  version: string
  label: string
  builtin: boolean
}

export type Unsub = () => void

/**
 * Registry for one extension kind. `list()` is order-stable: registration
 * order (builtins register in file-declaration order at bootstrap), never
 * re-sorted by label — the template/wave gallery order is a product
 * decision (UI_DESIGN_SPEC.md §4.1), not alphabetical.
 */
export class ExtensionPoint<T extends { manifest: ExtensionManifest }> {
  private items = new Map<string, T>()
  private listeners = new Set<() => void>()

  register(ext: T): void {
    if (this.items.has(ext.manifest.id)) {
      throw new Error(`Extension id already registered: ${ext.manifest.id}`)
    }
    this.items.set(ext.manifest.id, ext)
    this.listeners.forEach(cb => cb())
  }

  get(id: string): T | undefined {
    return this.items.get(id)
  }

  list(): readonly T[] {
    return Array.from(this.items.values())
  }

  onChange(cb: () => void): Unsub {
    this.listeners.add(cb)
    return () => this.listeners.delete(cb)
  }
}

export const wavePoint = new ExtensionPoint<WaveExtension>()
export const templatePoint = new ExtensionPoint<TemplateExtension>()
export const palettePoint = new ExtensionPoint<PaletteExtension>()
export const presetPoint = new ExtensionPoint<ExportPresetExtension>()

// ── Per-kind contracts (TECH_ARCHITECTURE.md §3.2) ──────────────────────────

import type { WaveDrawCtx } from '@audiogram/wave-effects'
import type { LayoutZones } from '../types'

export interface WaveExtension {
  manifest: ExtensionManifest
  draw(c: WaveDrawCtx): void
  /** Must match the Rust-side WaveStyle id — validated by kernel.test.ts against WAVE_STYLES. */
  rustId: string
}

export interface TemplateExtension {
  manifest: ExtensionManifest
  zones: LayoutZones
  defaults: { waveColor: string; bgColor: string; waveStyle: string; karaoke: boolean }
  needsAvatar: boolean
  tags: string[]
  // TODO(p3): composition: CompositionSpec — draw() still lives in
  // domain/preview/renderer.ts's per-layout match arm (P2-T2) until the
  // CompositionSpec refactor (Phase 3, TECH_ARCHITECTURE §3.3).
}

export interface PaletteExtension {
  manifest: ExtensionManifest
  colors: { hex: string; name: string }[]
  for: 'wave' | 'bg' | 'subtitle' | 'karaoke'
}

export interface ExportPresetExtension {
  manifest: ExtensionManifest
  canvasSize: string
  fps: number
  note: string
}
