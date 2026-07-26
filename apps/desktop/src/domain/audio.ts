// Shared by app/actions.ts's file-dialog open and features/start/DropZone.tsx's
// drag-and-drop import (PHASE2_TASKS.md T5 step 2) — one place owns "what
// counts as an audio file" and "how a path becomes audioPath/audioName/title".
export const AUDIO_EXTENSIONS = ['mp3', 'wav', 'm4a', 'flac', 'aac', 'ogg']

export function isAudioFile(path: string): boolean {
  const ext = path.split('.').pop()?.toLowerCase()
  return !!ext && AUDIO_EXTENSIONS.includes(ext)
}

export interface AudioMeta {
  audioPath: string
  audioName: string
  title: string
}

/** Derives the store's audioName/title fields from a picked/dropped path —
 * same auto-title logic as the pre-Phase-1 StepUpload.tsx. */
export function deriveAudioMeta(path: string): AudioMeta {
  const audioName = path.replace(/\\/g, '/').split('/').pop() || path
  const title = audioName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ')
  return { audioPath: path, audioName, title }
}
