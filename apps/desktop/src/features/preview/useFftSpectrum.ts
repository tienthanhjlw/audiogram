import { useEffect, useRef } from 'react'
import { ipc } from '../../core/ipc/client'
import type { WaveStyle } from '../../types'

// Module-level FFT cache (PHASE2_TASKS.md T2 step 2), shared by every
// consumer of this hook (PreviewCanvas.tsx and WaveformCanvas.tsx's legacy
// adapter both use it) — keyed by audio path, so switching mode/component or
// remounting never re-decodes+re-STFTs the same file twice.
//
// Also gates the request on `waveStyle === 'eq'`, fixing OPTIMIZATION_PLAN.md
// F5 (the pre-Phase-2 WaveformCanvas.tsx called analyze_spectrum
// unconditionally on every audio change, even for the 8/9 styles that never
// read the result — a wasted FFmpeg PCM decode + STFT on every import).
const fftCache = new Map<string, { fftPeaks: Float32Array; fftBuckets: number }>()

export function useFftSpectrum(audioPath: string, waveStyle: WaveStyle) {
  const fftPeaksRef = useRef<Float32Array | null>(null)
  const fftBucketsRef = useRef(0)

  useEffect(() => {
    if (waveStyle !== 'eq' || !audioPath) {
      fftPeaksRef.current = null
      fftBucketsRef.current = 0
      return
    }
    const cached = fftCache.get(audioPath)
    if (cached) {
      fftPeaksRef.current = cached.fftPeaks
      fftBucketsRef.current = cached.fftBuckets
      return
    }
    let cancelled = false
    ipc.analyzeSpectrum(audioPath)
      .then(({ bands, n_buckets }) => {
        if (cancelled) return
        const entry = { fftPeaks: new Float32Array(bands), fftBuckets: n_buckets }
        fftCache.set(audioPath, entry)
        fftPeaksRef.current = entry.fftPeaks
        fftBucketsRef.current = entry.fftBuckets
      })
      .catch(() => { /* eq effect's fallback simulation covers this */ })
    return () => { cancelled = true }
  }, [audioPath, waveStyle])

  return { fftPeaksRef, fftBucketsRef }
}
