import { useCallback, useEffect, useRef, useState } from 'react'
import { hasSeenDesignHint, markDesignHintSeen } from '../../core/persistence/SessionRepository'

const AUTO_DISMISS_MS = 8000

// UI_DESIGN_SPEC.md §194 — shown once, the first time the user reaches
// Design mode with a project loaded. Dismisses on the first click anywhere
// on the canvas, on "Got it", or after 8s, whichever comes first.
export function useFirstRunDesignHint() {
  const [visible, setVisible] = useState(false)
  const dismissedRef = useRef(false)

  const dismiss = useCallback(() => {
    if (dismissedRef.current) return
    dismissedRef.current = true
    setVisible(false)
    void markDesignHintSeen()
  }, [])

  useEffect(() => {
    let cancelled = false
    void hasSeenDesignHint().then(seen => {
      if (!cancelled && !seen) setVisible(true)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    if (!visible) return
    const timer = setTimeout(dismiss, AUTO_DISMISS_MS)
    return () => clearTimeout(timer)
  }, [visible, dismiss])

  return { visible, dismiss }
}
