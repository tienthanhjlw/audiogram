import { describe, expect, it } from 'vitest'
import { buildNodesFromLegacy, type LegacySceneInput } from '../scene/fromLegacy'

function baseInput(overrides: Partial<LegacySceneInput> = {}): LegacySceneInput {
  return {
    layoutTemplate: 'minimal',
    zones: null,
    waveStyle: 'bar',
    waveColor: '#7C5CFF',
    title: 'My Podcast',
    titleColor: '#FFFFFF',
    titleAlign: 'center',
    titleBold: false,
    titleItalic: false,
    fontName: 'Arial',
    fontSize: 100,
    coverImagePath: '',
    showSubtitles: false,
    subtitleColor: '#FFFFFF',
    ...overrides,
  }
}

describe('buildNodesFromLegacy', () => {
  it('always produces a waveform node from zones.waveform/waveStyle/waveColor', () => {
    const nodes = buildNodesFromLegacy(baseInput({ title: '' }))
    expect(nodes).toHaveLength(1)
    expect(nodes[0]).toMatchObject({
      type: 'waveform',
      transform: { x: 0.02, y: 0.3, w: 0.96, h: 0.36 }, // minimal's default zone
      props: { type: 'waveform', style: 'bar', color: '#7C5CFF' },
    })
  })

  it('produces a title text node from zones.title/title/titleColor/... when title is set', () => {
    const nodes = buildNodesFromLegacy(baseInput())
    const title = nodes.find(n => n.type === 'text' && n.props?.type === 'text' && n.props.role === 'title')
    expect(title).toBeDefined()
    expect(title).toMatchObject({
      transform: { x: 0.08, y: 0.05, w: 0.84, h: 0.16 }, // minimal's default title zone
      props: { type: 'text', text: 'My Podcast', color: '#FFFFFF', align: 'center', bold: false, italic: false },
    })
  })

  it('omits the title node when title is empty', () => {
    const nodes = buildNodesFromLegacy(baseInput({ title: '' }))
    expect(nodes.some(n => n.type === 'text')).toBe(false)
  })

  it('adds an avatar image node only when the layout has one and a cover image is set', () => {
    const withoutCover = buildNodesFromLegacy(baseInput({ layoutTemplate: 'spotify', title: '' }))
    expect(withoutCover.some(n => n.type === 'image')).toBe(false)

    const withCover = buildNodesFromLegacy(baseInput({ layoutTemplate: 'spotify', title: '', coverImagePath: '/a.jpg' }))
    const avatar = withCover.find(n => n.type === 'image')
    expect(avatar).toBeDefined()
    expect(avatar).toMatchObject({
      transform: { x: 0.32, y: 0.08, w: 0.36, h: 0.36 }, // spotify's default avatar zone
      props: { type: 'image', src: '/a.jpg', fit: 'cover', shape: 'circle' },
    })

    // minimal has no avatar zone at all — cover image alone isn't enough.
    const minimalWithCover = buildNodesFromLegacy(baseInput({ title: '', coverImagePath: '/a.jpg' }))
    expect(minimalWithCover.some(n => n.type === 'image')).toBe(false)
  })

  it('adds a caption text node bound to transcript when captions are enabled', () => {
    const nodes = buildNodesFromLegacy(baseInput({ title: '', showSubtitles: true, subtitleColor: '#FFD60A' }))
    const caption = nodes.find(n => n.type === 'text')
    expect(caption).toBeDefined()
    expect(caption).toMatchObject({
      props: { type: 'text', role: 'caption', boundToTranscript: true, color: '#FFD60A' },
    })
  })

  it('falls back to DEFAULT_ZONES when zones is null, and uses an explicit override when set', () => {
    const overridden = buildNodesFromLegacy(baseInput({
      title: '',
      zones: { waveform: { x: 0.1, y: 0.1, w: 0.5, h: 0.2 }, title: { x: 0, y: 0, w: 1, h: 1 } },
    }))
    expect(overridden[0].transform).toMatchObject({ x: 0.1, y: 0.1, w: 0.5, h: 0.2 })
  })

  it('produces the full node set (waveform + title + avatar + caption) for a real-ish session', () => {
    const nodes = buildNodesFromLegacy(baseInput({
      layoutTemplate: 'spotify',
      coverImagePath: '/cover.jpg',
      showSubtitles: true,
    }))
    expect(nodes.map(n => n.type).sort()).toEqual(['image', 'text', 'text', 'waveform'])
  })
})
