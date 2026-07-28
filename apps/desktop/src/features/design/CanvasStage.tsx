import { useCallback, useEffect, useRef, useState } from 'react'
import { Rnd } from 'react-rnd'
import { useAppStore, type SelectedEl } from '../../store'
import {
  CANVAS_SIZES, CanvasSize, DEFAULT_ZONES, LayoutZone, LayoutZones,
} from '../../types'
import { PreviewCanvas } from '../preview/PreviewCanvas'
import { clampZoneFraction, snapToCenterPx } from '../../domain/zones'
import { Button, Modal, SegmentedControl, Tooltip } from '../../ui'
import { useFirstRunDesignHint } from './useFirstRunDesignHint'
import { TimingTimeline } from './TimingTimeline'
import { indexById, staticWorldTransform } from '../../domain/scene/group'
import { EL_META } from './zoneMeta'

type ZoneKey = keyof LayoutZones

const ZONE_TO_EL: Partial<Record<ZoneKey, Exclude<SelectedEl, null>>> = {
  waveform: 'wave', title: 'title', subtitle: 'subtitle', avatar: 'avatar',
}

const RATIO_OPTIONS: { value: CanvasSize; label: string }[] = [
  { value: '16:9', label: '16:9' },
  { value: '1:1', label: '1:1' },
  { value: '9:16', label: '9:16' },
]

// features/design/CanvasStage.tsx — UI_DESIGN_SPEC.md §4.2, ported from
// StepLayout.tsx's preview+Rnd-zone-editor half (the other half, the left
// panel, became DesignPanel.tsx in P2-T6). PreviewCanvas (P2-T2) replaces
// the direct WaveformCanvas call — same store-driven render, but now
// playhead-synced instead of running its own clock.
export function CanvasStage() {
  const layoutTemplate = useAppStore(s => s.layoutTemplate)
  const canvasSize     = useAppStore(s => s.canvasSize)
  const zones          = useAppStore(s => s.zones)
  const title          = useAppStore(s => s.title)
  const titleColor     = useAppStore(s => s.titleColor)
  const titleAlign     = useAppStore(s => s.titleAlign)
  const titleBold      = useAppStore(s => s.titleBold)
  const titleItalic    = useAppStore(s => s.titleItalic)
  const fontSize       = useAppStore(s => s.fontSize)
  const fontName       = useAppStore(s => s.fontName)
  const set            = useAppStore(s => s.set)
  const selectedEl     = useAppStore(s => s.selectedEl)
  const selectEl       = useAppStore(s => s.selectEl)
  const layersBetaEnabled = useAppStore(s => s.layersBetaEnabled)
  const nodes             = useAppStore(s => s.nodes)
  const selectedNodeIds   = useAppStore(s => s.selectedNodeIds)
  const setSelectedNodeIds = useAppStore(s => s.setSelectedNodeIds)

  const containerRef    = useRef<HTMLDivElement>(null)
  const titleEditRef    = useRef<HTMLDivElement>(null)
  const titleDraggedRef = useRef(false)
  const [containerSize, setContainerSize] = useState({ w: 1, h: 1 })
  const [hoveredZone, setHoveredZone]     = useState<ZoneKey | null>(null)
  const [editingTitle, setEditingTitle]   = useState(false)
  const [guides, setGuides]               = useState({ v: false, h: false })
  const [fullscreen, setFullscreen]       = useState(false)
  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const firstRunHint = useFirstRunDesignHint()

  const effectiveZones = zones ?? DEFAULT_ZONES[layoutTemplate]
  const ratio = CANVAS_SIZES[canvasSize].w / CANVAS_SIZES[canvasSize].h

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      if (width > 0 && height > 0) setContainerSize({ w: width, h: height })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (!editingTitle) return
    const el = titleEditRef.current
    if (!el) return
    el.textContent = title
    el.focus()
    const range = document.createRange()
    range.selectNodeContents(el)
    const sel = window.getSelection()
    sel?.removeAllRanges()
    sel?.addRange(range)
  }, [editingTitle, title])

  // Esc: fullscreen closes first, then deselect — the reset-confirm Modal
  // owns its own Escape handling (ui/Modal.tsx), so this skips entirely
  // while it's open rather than also firing a deselect on the same keypress.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || resetConfirmOpen) return
      if (fullscreen) { setFullscreen(false); return }
      if (selectedEl !== null) selectEl(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [fullscreen, resetConfirmOpen, selectedEl, selectEl])

  const exitTitleEdit = useCallback(() => setEditingTitle(false), [])

  const updateZone = useCallback((key: ZoneKey, patch: Partial<LayoutZone>) => {
    const current = effectiveZones[key]
    if (!current) return
    set({ zones: { ...effectiveZones, [key]: { ...current, ...patch } } as LayoutZones })
  }, [effectiveZones, set])

  const doResetLayout = () => {
    set({ zones: null })
    selectEl(null)
    setResetConfirmOpen(false)
  }

  return (
    <div className="flex h-full flex-col bg-bg-pit">
      <div
        onMouseDown={() => { selectEl(null); setEditingTitle(false); firstRunHint.dismiss() }}
        className="flex flex-1 items-center justify-center overflow-hidden p-8"
      >
        <div
          className="relative overflow-hidden rounded-[8px]"
          style={{
            aspectRatio: String(ratio),
            width: ratio >= 1 ? '80%' : undefined,
            height: ratio < 1 ? '85%' : undefined,
            maxWidth: ratio >= 1 ? '80%' : undefined,
            boxShadow: '0 16px 56px rgba(0,0,0,0.55)',
          }}
        >
          <PreviewCanvas ratio={ratio} />

          {firstRunHint.visible && (
            <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2">
              <div className="pointer-events-auto flex items-center gap-2 rounded-[var(--radius-m)] bg-black/85 px-3 py-1.5 text-[12px] text-text-1 shadow-[0_8px_24px_rgba(0,0,0,0.5)]">
                <span>Click any element on the canvas to edit it</span>
                <button
                  type="button"
                  onClick={firstRunHint.dismiss}
                  className="font-semibold text-accent"
                >
                  Got it
                </button>
              </div>
            </div>
          )}

          {/* Zone overlays — onMouseDown (not onClick) so a zone's stopPropagation works */}
          <div ref={containerRef} className="absolute inset-0">
            {(Object.keys(effectiveZones) as ZoneKey[]).map(key => {
              const zone = effectiveZones[key]
              if (!zone) return null
              const el = ZONE_TO_EL[key]
              if (!el) return null
              const meta = EL_META[el]
              const sel = selectedEl === el
              const hov = hoveredZone === key
              const { w: cW, h: cH } = containerSize
              const isTitleZone = el === 'title'

              return (
                <Rnd
                  key={key}
                  bounds="parent"
                  position={{ x: zone.x * cW, y: zone.y * cH }}
                  size={{ width: zone.w * cW, height: zone.h * cH }}
                  minWidth={cW * 0.05}
                  minHeight={cH * 0.04}
                  enableResizing={sel && !editingTitle}
                  onMouseDown={e => {
                    e.stopPropagation()
                    selectEl(el)
                    firstRunHint.dismiss()
                    if (isTitleZone) {
                      titleDraggedRef.current = false
                      if (editingTitle) setEditingTitle(false)
                    }
                  }}
                  onDrag={(_, d) => {
                    if (isTitleZone) titleDraggedRef.current = true
                    const snap = snapToCenterPx(d.x, d.y, zone.w * cW, zone.h * cH, cW, cH)
                    setGuides({ v: snap.snappedX, h: snap.snappedY })
                  }}
                  onDragStop={(_, d) => {
                    setGuides({ v: false, h: false })
                    if (isTitleZone && !titleDraggedRef.current) {
                      setEditingTitle(true)
                      return
                    }
                    const snap = snapToCenterPx(d.x, d.y, zone.w * cW, zone.h * cH, cW, cH)
                    const frac = clampZoneFraction(snap.x / cW, snap.y / cH, zone.w, zone.h)
                    updateZone(key, frac)
                  }}
                  onResizeStop={(_, __, ref, ___, pos) => {
                    set({ zones: { ...effectiveZones, [key]: {
                      x: pos.x / cW,
                      y: pos.y / cH,
                      w: ref.offsetWidth  / cW,
                      h: ref.offsetHeight / cH,
                    } } as LayoutZones })
                  }}
                  onMouseEnter={() => setHoveredZone(key)}
                  onMouseLeave={() => setHoveredZone(null)}
                  style={{
                    border: sel
                      ? `2px solid ${meta.color}`
                      : hov
                        ? `2px dashed ${meta.color}88`
                        : '1px dashed rgba(255,255,255,0.07)',
                    background: sel ? `${meta.color}08` : hov ? `${meta.color}05` : 'transparent',
                    borderRadius: 5,
                    boxSizing: 'border-box',
                    zIndex: sel ? 10 : hov ? 5 : 1,
                    cursor: editingTitle && isTitleZone ? 'text' : 'move',
                  }}
                >
                  {(sel || hov) && !editingTitle && (
                    <div style={{
                      position: 'absolute', top: 3, left: 3,
                      background: meta.color, borderRadius: 3,
                      padding: '1px 5px', fontSize: 9, color: 'var(--color-text-1)', fontWeight: 700,
                      whiteSpace: 'nowrap', pointerEvents: 'none', opacity: 0.9,
                    }}>
                      {meta.label}{isTitleZone ? ' · click to edit' : ''}
                    </div>
                  )}
                </Rnd>
              )
            })}
          </div>

          {/* Node overlay (P5-T7, "Try new layers (beta)") — click-select only;
              drag/resize-on-canvas isn't in scope yet, edit via NodeInspector. */}
          {layersBetaEnabled && (
            <div className="absolute inset-0">
              {(() => {
                const nodesById = indexById(nodes)
                return [...nodes].sort((a, b) => a.z - b.z).map(node => {
                  const sel = selectedNodeIds.includes(node.id)
                  // World-space rect so a grouped child's overlay box sits at its
                  // actual on-canvas position, not its group-local coordinates
                  // (P5-T10) — clicking it selects the child directly, no
                  // separate "double-click to enter the group" step needed.
                  const { x, y, w, h } = staticWorldTransform(node, nodesById)
                  return (
                    <div
                      key={node.id}
                      onMouseDown={e => {
                        e.stopPropagation()
                        if (e.shiftKey) {
                          setSelectedNodeIds(
                            selectedNodeIds.includes(node.id)
                              ? selectedNodeIds.filter(id => id !== node.id)
                              : [...selectedNodeIds, node.id],
                          )
                        } else {
                          setSelectedNodeIds([node.id])
                        }
                      }}
                      style={{
                        position: 'absolute',
                        left: `${x * 100}%`, top: `${y * 100}%`,
                        width: `${w * 100}%`, height: `${h * 100}%`,
                        border: sel ? '2px solid #EC4FC4' : '1px dashed rgba(236,79,196,0.4)',
                        borderRadius: 4,
                        boxSizing: 'border-box',
                        cursor: 'pointer',
                        zIndex: sel ? 15 : 8,
                      }}
                    />
                  )
                })
              })()}
            </div>
          )}

          {/* Center guide lines — UI_DESIGN_SPEC.md §4.2 */}
          {guides.v && <div className="pointer-events-none absolute inset-y-0 left-1/2 z-20 w-px bg-accent/50" />}
          {guides.h && <div className="pointer-events-none absolute inset-x-0 top-1/2 z-20 h-px bg-accent/50" />}

          {/* Inline title editor — click on title zone to activate */}
          {editingTitle && (() => {
            const tz = effectiveZones.title
            const fSize = Math.round(containerSize.h * 0.058 * (fontSize / 100))
            const justifyMap = { left: 'flex-start', center: 'center', right: 'flex-end' } as const
            return (
              <div
                onMouseDown={e => e.stopPropagation()}
                style={{
                  position: 'absolute',
                  left: `${tz.x * 100}%`, top: `${tz.y * 100}%`,
                  width: `${tz.w * 100}%`, height: `${tz.h * 100}%`,
                  display: 'flex', alignItems: 'center',
                  justifyContent: justifyMap[titleAlign],
                  padding: '0 4px', zIndex: 20, boxSizing: 'border-box',
                }}
              >
                <div
                  ref={titleEditRef}
                  contentEditable
                  suppressContentEditableWarning
                  onInput={e => set({ title: e.currentTarget.textContent ?? '' })}
                  onKeyDown={e => {
                    e.stopPropagation()
                    if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); exitTitleEdit() }
                  }}
                  onBlur={exitTitleEdit}
                  style={{
                    minWidth: 40, maxWidth: '100%',
                    color: titleColor,
                    fontSize: fSize,
                    fontWeight: titleBold ? 700 : 400,
                    fontStyle: titleItalic ? 'italic' : 'normal',
                    fontFamily: `'${fontName}', Arial, sans-serif`,
                    textAlign: titleAlign,
                    lineHeight: 1.4,
                    outline: 'none',
                    wordBreak: 'break-word', whiteSpace: 'pre-wrap',
                    cursor: 'text', padding: '3px 6px', borderRadius: 4,
                    background: 'rgba(0,0,0,0.30)',
                    boxShadow: `0 0 0 1.5px ${EL_META.title.color}99`,
                    caretColor: titleColor,
                  }}
                />
              </div>
            )
          })()}
        </div>
      </div>

      {/* Stage footer — UI_DESIGN_SPEC.md §4.2 */}
      <div className="flex h-9 flex-shrink-0 items-center justify-between border-t border-border px-3">
        <SegmentedControl
          value={canvasSize}
          onChange={s => set({ canvasSize: s })}
          options={RATIO_OPTIONS}
        />
        <div className="flex items-center gap-2">
          {zones !== null && (
            <Button variant="ghost" size="sm" onClick={() => setResetConfirmOpen(true)}>
              Reset layout
            </Button>
          )}
          <Tooltip content="Fullscreen preview">
            <button
              type="button"
              onClick={() => setFullscreen(true)}
              className="flex h-7 w-7 items-center justify-center rounded-[var(--radius-s)] text-text-2 hover:bg-bg-elevated hover:text-text-1"
            >
              ⛶
            </button>
          </Tooltip>
        </div>
      </div>

      {layersBetaEnabled && <TimingTimeline />}

      {fullscreen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black"
          onClick={() => setFullscreen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              aspectRatio: String(ratio),
              width: ratio >= 1 ? '80%' : undefined,
              height: ratio < 1 ? '90%' : undefined,
            }}
          >
            <PreviewCanvas ratio={ratio} />
          </div>
        </div>
      )}

      <Modal open={resetConfirmOpen} onClose={() => setResetConfirmOpen(false)}>
        <div className="w-[320px] p-5">
          <div className="text-[15px] font-semibold text-text-1">Reset layout?</div>
          <p className="mt-2 text-[13px] leading-relaxed text-text-2">
            This puts every zone back to the template&rsquo;s default position.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setResetConfirmOpen(false)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={doResetLayout}>Reset layout</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
