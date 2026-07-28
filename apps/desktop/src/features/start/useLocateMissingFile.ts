import { useState } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { AUDIO_EXTENSIONS, deriveAudioMeta } from '../../domain/audio'

export interface MissingFileTarget {
  audioPath: string
  audioName: string
}

interface RequestOptions {
  onLocate: (meta: { audioPath: string; audioName: string }) => void
  onRemove: () => void
}

// Shared "Audio file not found" flow (UI_DESIGN_SPEC.md §8.4) — used by
// RecentGrid (click on a Recent card whose file has moved/gone) and by
// session auto-restore (P4-T8), so the re-link picker and its behavior
// live in exactly one place instead of being duplicated per call site.
export function useLocateMissingFile() {
  const [target, setTarget] = useState<MissingFileTarget | null>(null)
  const [handlers, setHandlers] = useState<RequestOptions | null>(null)

  const request = (file: MissingFileTarget, opts: RequestOptions) => {
    setTarget(file)
    setHandlers(opts)
  }

  const cancel = () => { setTarget(null); setHandlers(null) }

  const locate = async () => {
    if (!handlers) return
    const file = await open({ multiple: false, filters: [{ name: 'Audio', extensions: AUDIO_EXTENSIONS }] })
    if (!file) return
    const meta = deriveAudioMeta(String(file))
    handlers.onLocate({ audioPath: meta.audioPath, audioName: meta.audioName })
    cancel()
  }

  const remove = () => {
    handlers?.onRemove()
    cancel()
  }

  return { target, request, locate, remove, cancel }
}
