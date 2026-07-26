import { describe, expect, it, beforeAll } from 'vitest'
import { ExtensionPoint, type ExtensionManifest } from '../kernel'
import { registerBuiltins, templatePoint, wavePoint, palettePoint } from '../index'
import { LAYOUT_TEMPLATES, WAVE_STYLES } from '../../types'

interface Fake { manifest: ExtensionManifest }

function fake(id: string): Fake {
  return { manifest: { id, kind: 'wave', version: '0.0.0', label: id, builtin: true } }
}

describe('ExtensionPoint', () => {
  it('throws when registering a duplicate id', () => {
    const point = new ExtensionPoint<Fake>()
    point.register(fake('a'))
    expect(() => point.register(fake('a'))).toThrow()
  })

  it('list() preserves registration order', () => {
    const point = new ExtensionPoint<Fake>()
    point.register(fake('z'))
    point.register(fake('a'))
    point.register(fake('m'))
    expect(point.list().map(x => x.manifest.id)).toEqual(['z', 'a', 'm'])
  })

  it('onChange fires when a new extension registers', () => {
    const point = new ExtensionPoint<Fake>()
    let calls = 0
    point.onChange(() => { calls++ })
    point.register(fake('a'))
    expect(calls).toBe(1)
  })

  it('onChange unsubscribe stops further notifications', () => {
    const point = new ExtensionPoint<Fake>()
    let calls = 0
    const unsub = point.onChange(() => { calls++ })
    point.register(fake('a'))
    unsub()
    point.register(fake('b'))
    expect(calls).toBe(1)
  })
})

describe('builtin registries', () => {
  beforeAll(() => {
    registerBuiltins()
  })

  it('registers exactly the 6 built-in templates', () => {
    const ids = templatePoint.list().map(t => t.manifest.id.replace('com.audiogram.template.', ''))
    expect(ids).toEqual(LAYOUT_TEMPLATES.map(t => t.id))
  })

  it('registers exactly the 9 built-in wave styles', () => {
    const ids = wavePoint.list().map(w => w.rustId)
    expect(ids.sort()).toEqual(WAVE_STYLES.map(w => w.id).sort())
  })

  it('registers 4 built-in palettes (wave/bg/subtitle/karaoke)', () => {
    expect(palettePoint.list().map(p => p.for).sort()).toEqual(['bg', 'karaoke', 'subtitle', 'wave'])
  })

  it('registerBuiltins is idempotent (safe to call twice)', () => {
    expect(() => registerBuiltins()).not.toThrow()
    expect(templatePoint.list()).toHaveLength(6)
  })
})
