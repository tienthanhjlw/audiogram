import { useCallback, useEffect, useRef, useState } from 'react'
import { splitSegments } from '@audiogram/segments'
import { useAppStore } from '../../store'
import { ipc } from '../../core/ipc/client'
import type { AppError } from '../../core/errors'

// Ported from the pre-Phase-3 StepTranscript.tsx verbatim (splitSegments +
// write_srt + store set), but through `ipc.*` instead of raw `invoke()`
// (PHASE3_TASKS.md T6 — StepTranscript is the last caller left using
// @tauri-apps/api/core directly, per TECH_ARCHITECTURE.md §2.3).
export function useTranscribe() {
  const audioPath     = useAppStore(s => s.audioPath)
  const peaks         = useAppStore(s => s.peaks)
  const segments      = useAppStore(s => s.segments)
  const whisperModel  = useAppStore(s => s.whisperModel)
  const isTranscribing = useAppStore(s => s.isTranscribing)
  const set           = useAppStore(s => s.set)

  const [error, setError] = useState<string | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (isTranscribing) {
      setElapsed(0)
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    } else if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [isTranscribing])

  const run = useCallback(async () => {
    if (!audioPath) return
    setError(null)
    set({ isTranscribing: true, segments: [], srtPath: '' })
    try {
      const rawSegs = await ipc.transcribeAudio(audioPath, whisperModel)
      const segs = splitSegments(rawSegs, peaks, 3.5)
      const srtPath = await ipc.writeSrt(segs)
      set({ segments: segs, srtPath, isTranscribing: false, showSubtitles: true })
    } catch (e) {
      const err = e as AppError
      setError(err.detail ?? err.message)
      set({ isTranscribing: false })
    }
  }, [audioPath, whisperModel, peaks, set])

  return { run, error, setError, elapsed, hasSegments: segments.length > 0, isTranscribing }
}
