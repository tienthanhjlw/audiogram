import { useEffect } from 'react'
import { useAppStore } from '../../store'
import { clearSession, listRecents, pushRecent, removeRecent } from '../../core/persistence/SessionRepository'
import { sessionToPatch } from '../../core/persistence/restore'
import { LocateFileDialog } from './LocateFileDialog'
import { useLocateMissingFile } from './useLocateMissingFile'

// P4-T8 — offers the same "Audio file not found" flow as RecentGrid's
// missing-Recent dialog, but for the session core/persistence/restore.ts
// couldn't auto-restore at launch because its audioPath no longer resolves.
// Always mounted (App.tsx) rather than only on the START screen: restore.ts
// never sets `screen: 'studio'` on this path, so START is where the user
// already lands, but mounting unconditionally keeps this component honest
// about its own precondition instead of depending on a sibling's routing.
export function PendingSessionLocate() {
  const pending = useAppStore(s => s.pendingMissingSession)
  const set = useAppStore(s => s.set)
  const locateFile = useLocateMissingFile()

  useEffect(() => {
    if (!pending) return
    locateFile.request(
      { audioPath: pending.project.audioPath, audioName: pending.project.audioName },
      {
        onLocate: meta => {
          set(sessionToPatch({
            ...pending,
            project: { ...pending.project, audioPath: meta.audioPath, audioName: meta.audioName },
          }))
          void listRecents().then(async recents => {
            const old = recents.find(r => r.audioPath === pending.project.audioPath)
            await removeRecent(pending.project.audioPath)
            await pushRecent({
              audioPath: meta.audioPath,
              audioName: meta.audioName,
              title: pending.project.title,
              duration: old?.duration ?? 0,
              thumbnailPng: old?.thumbnailPng ?? null,
              savedAt: new Date().toISOString(),
            })
          })
          set({ pendingMissingSession: null })
        },
        onRemove: () => {
          void removeRecent(pending.project.audioPath)
          void clearSession()
          set({ pendingMissingSession: null })
        },
      },
    )
  }, [pending])

  return (
    <LocateFileDialog
      target={locateFile.target}
      onLocate={() => void locateFile.locate()}
      onRemove={locateFile.remove}
      onCancel={locateFile.cancel}
    />
  )
}
