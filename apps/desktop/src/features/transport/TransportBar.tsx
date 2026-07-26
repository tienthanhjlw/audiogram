import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { useAppStore } from '../../store'
import { audioEngine } from '../../core/audio/AudioEngine'

const BAR_W = 2
const GAP_W = 1
const STEP = BAR_W + GAP_W

// Mirrors --color-accent / --color-text-3 from ui/tokens.css — canvas
// fillStyle can't read CSS custom properties, so these two are duplicated
// here the same way other rendering constants are duplicated elsewhere
// (CLAUDE.md's parity table).
const COLOR_PLAYED = '#7C5CFF'
const COLOR_UNPLAYED = '#5C5C6E'
const COLOR_PLAYHEAD = '#F4F4F6'
const COLOR_HOVER_GHOST = 'rgba(244, 244, 246, 0.35)'

function formatTimecode(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) seconds = 0
  const m = Math.floor(seconds / 60)
  const s = seconds - m * 60
  return `${m}:${s.toFixed(1).padStart(4, '0')}`
}

// shell/TransportBar.tsx — UI_DESIGN_SPEC.md §6, built per PHASE1_TASKS.md
// T12 (everything except segment blocks + the now-playing chip, which need
// Captions-mode data structures from Phase 3 — left as a TODO slot below).
// The seek strip's waveform + playhead redraw on every audioEngine.onFrame
// tick (a raw rAF loop reading `<audio>.currentTime` directly), NOT via the
// store's 10Hz-throttled `currentTime` — that's what keeps the playhead
// smooth (TECH_ARCHITECTURE.md §4.3). The timecode text next to it *does*
// read the throttled store value, which is fine for digits changing 10x/sec.
export function TransportBar() {
  const peaks = useAppStore(s => s.peaks)
  const duration = useAppStore(s => s.duration)
  const currentTime = useAppStore(s => s.currentTime)
  const playing = useAppStore(s => s.playing)
  const audioPath = useAppStore(s => s.audioPath)

  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const peaksRef = useRef(peaks)
  const durationRef = useRef(duration)
  const hoverPctRef = useRef<number | null>(null)
  const draggingRef = useRef(false)
  const [hoverTooltip, setHoverTooltip] = useState<{ x: number; label: string } | null>(null)

  const ready = duration > 0
  const canScrub = ready && !!audioPath

  useEffect(() => { peaksRef.current = peaks }, [peaks])
  useEffect(() => { durationRef.current = duration }, [duration])

  const draw = (time: number) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const W = canvas.clientWidth
    const H = canvas.clientHeight
    const dpr = window.devicePixelRatio || 1
    if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, W, H)

    const peaks = peaksRef.current
    const dur = durationRef.current || 1
    const playedPct = Math.min(1, Math.max(0, time / dur))

    const n = Math.max(1, Math.floor(W / STEP))
    for (let i = 0; i < n; i++) {
      const idx = peaks.length > 0 ? Math.floor((i / n) * peaks.length) : -1
      const amp = idx >= 0 ? peaks[idx] : 0
      const barH = Math.max(2, amp * (H - 4))
      const x = i * STEP
      const y = (H - barH) / 2
      ctx.fillStyle = i / n <= playedPct ? COLOR_PLAYED : COLOR_UNPLAYED
      ctx.fillRect(x, y, BAR_W, barH)
    }

    const hoverPct = hoverPctRef.current
    if (hoverPct !== null) {
      ctx.fillStyle = COLOR_HOVER_GHOST
      ctx.fillRect(hoverPct * W - 1, 0, 2, H)
    }

    ctx.fillStyle = COLOR_PLAYHEAD
    ctx.fillRect(playedPct * W - 1, 0, 2, H)
  }

  useEffect(() => {
    // Redraw immediately on peaks/size changes even while paused, instead of
    // waiting for the next onFrame tick.
    draw(useAppStore.getState().currentTime)
  }, [peaks, duration])

  useEffect(() => audioEngine.onFrame(draw), [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => draw(useAppStore.getState().currentTime))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const pctFromClientX = (clientX: number): number => {
    const rect = containerRef.current!.getBoundingClientRect()
    return Math.min(1, Math.max(0, (clientX - rect.left) / rect.width))
  }

  const onPointerMove = (e: ReactPointerEvent) => {
    const pct = pctFromClientX(e.clientX)
    if (canScrub) {
      hoverPctRef.current = pct
      setHoverTooltip({ x: e.clientX - containerRef.current!.getBoundingClientRect().left, label: formatTimecode(pct * duration) })
    }
    if (draggingRef.current && canScrub) audioEngine.seek(pct * duration)
  }

  const onPointerLeave = () => {
    hoverPctRef.current = null
    setHoverTooltip(null)
  }

  const onPointerDown = (e: ReactPointerEvent) => {
    if (!canScrub) return
    draggingRef.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
    audioEngine.seek(pctFromClientX(e.clientX) * duration)
  }

  const onPointerUp = (e: ReactPointerEvent) => {
    if (!draggingRef.current) return
    draggingRef.current = false
    ;(e.target as HTMLElement).releasePointerCapture(e.pointerId)
  }

  return (
    <div className="flex h-16 items-center gap-3 px-4">
      <button
        type="button"
        aria-label={playing ? 'Pause' : 'Play'}
        disabled={!canScrub}
        onClick={() => audioEngine.toggle()}
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-text-1 disabled:opacity-40"
      >
        {!ready && audioPath ? <Spinner /> : playing ? <PauseIcon /> : <PlayIcon />}
      </button>

      <span className="tabular w-14 shrink-0 text-[12px] text-text-2">{formatTimecode(currentTime)}</span>

      <div
        ref={containerRef}
        className="relative h-10 flex-1 cursor-pointer"
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
      >
        <canvas ref={canvasRef} className="h-full w-full" />
        {/* TODO(p1-t12): segment blocks (6px strip along the bottom) + the
         * now-playing chip to the right of the strip both need Captions-mode
         * segment data wired up in Phase 3 (UI_DESIGN_SPEC.md §6). */}
        {hoverTooltip && (
          <div
            className="pointer-events-none absolute -top-7 -translate-x-1/2 rounded bg-black/90 px-1.5 py-0.5 text-[11px] text-text-1"
            style={{ left: hoverTooltip.x }}
          >
            {hoverTooltip.label}
          </div>
        )}
      </div>

      <span className="tabular w-14 shrink-0 text-[12px] text-text-2">{formatTimecode(duration)}</span>
    </div>
  )
}

function PlayIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <path d="M3 1.5v11l9-5.5-9-5.5z" />
    </svg>
  )
}

function PauseIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor">
      <rect x="2.5" y="1.5" width="3" height="11" rx="0.5" />
      <rect x="8.5" y="1.5" width="3" height="11" rx="0.5" />
    </svg>
  )
}

function Spinner() {
  return (
    <svg className="h-3.5 w-3.5 animate-spin text-text-1" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path d="M12 2a10 10 0 0110 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  )
}
