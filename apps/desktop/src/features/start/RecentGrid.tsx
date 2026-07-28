import { useCallback, useEffect, useState } from 'react'
import { actions } from '../../app/actions'
import { ipc } from '../../core/ipc/client'
import {
  audioFileExists, listRecents, pushRecent, removeRecent, type RecentEntry,
} from '../../core/persistence/SessionRepository'
import { formatDuration, formatRelativeTime } from '../../domain/format'
import { ContextMenu } from '../../ui'
import { LocateFileDialog } from './LocateFileDialog'
import { useLocateMissingFile } from './useLocateMissingFile'

interface MenuState { x: number; y: number; entry: RecentEntry }

// UI_DESIGN_SPEC.md §2.3 — only rendered when there's ≥1 entry; up to 8,
// newest first (SessionRepository.listRecents already returns them in that
// order). Missing-file detection + "Locate…" flow per spec §8.4, via the
// shared useLocateMissingFile hook (P4-T5) so session auto-restore (P4-T8)
// can reuse the same dialog instead of duplicating this logic.
export function RecentGrid() {
  const [entries, setEntries] = useState<RecentEntry[]>([])
  const [missing, setMissing] = useState<Record<string, boolean>>({})
  const [menu, setMenu] = useState<MenuState | null>(null)
  const locateFile = useLocateMissingFile()

  const refresh = useCallback(async () => {
    const list = await listRecents()
    setEntries(list)
    const checks = await Promise.all(
      list.map(async e => [e.audioPath, !(await audioFileExists(e.audioPath))] as const),
    )
    setMissing(Object.fromEntries(checks))
  }, [])

  useEffect(() => { void refresh() }, [refresh])

  if (entries.length === 0) return null

  const open_ = (entry: RecentEntry) => {
    if (!missing[entry.audioPath]) { actions.openRecentEntry(entry); return }
    locateFile.request(entry, {
      onLocate: meta => {
        void removeRecent(entry.audioPath).then(() =>
          pushRecent({ ...entry, audioPath: meta.audioPath, audioName: meta.audioName, savedAt: new Date().toISOString() }),
        )
        actions.openRecentEntry({ audioPath: meta.audioPath, audioName: meta.audioName, title: entry.title })
      },
      onRemove: () => { void remove(entry) },
    })
  }

  const revealInFinder = (entry: RecentEntry) => {
    const dir = entry.audioPath.replace(/\\/g, '/').replace(/\/[^/]*$/, '')
    void ipc.openFolder(dir)
  }

  const remove = async (entry: RecentEntry) => {
    await removeRecent(entry.audioPath)
    await refresh()
  }

  return (
    <div className="w-full max-w-[880px]">
      <div className="mb-3 text-[11px] font-semibold uppercase tracking-[0.05em] text-text-3">Recent</div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4">
        {entries.map(entry => {
          const isMissing = !!missing[entry.audioPath]
          return (
            <div
              key={entry.audioPath}
              className="group cursor-pointer"
              onClick={() => open_(entry)}
              onContextMenu={e => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY, entry }) }}
            >
              <div
                className="relative aspect-video overflow-hidden rounded-[var(--radius-m)] border border-border bg-bg-elevated group-hover:border-accent"
                style={{ opacity: isMissing ? 0.4 : 1 }}
              >
                {entry.thumbnailPng && (
                  <img src={entry.thumbnailPng} alt={entry.title || entry.audioName} className="h-full w-full object-cover" />
                )}
                {isMissing ? (
                  <span className="absolute bottom-1 left-1 rounded-[4px] bg-danger/80 px-1.5 py-0.5 text-[9px] font-semibold text-text-1">
                    File missing
                  </span>
                ) : (
                  <span className="absolute inset-0 flex items-center justify-center opacity-0 transition-opacity group-hover:opacity-100">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/50 text-text-1">▶</span>
                  </span>
                )}
              </div>
              <div className="mt-1.5 truncate text-[12px] text-text-1">{entry.title || entry.audioName}</div>
              <div className="text-[11px] text-text-3">
                {formatRelativeTime(entry.savedAt)} · {formatDuration(entry.duration)}
              </div>
            </div>
          )
        })}
      </div>

      {menu && (
        <ContextMenu
          open
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          items={[
            { label: 'Open', onSelect: () => open_(menu.entry) },
            { label: 'Reveal Audio in Finder', onSelect: () => revealInFinder(menu.entry) },
            { separator: true },
            { label: 'Remove from Recents', onSelect: () => { void remove(menu.entry) }, danger: true },
          ]}
        />
      )}

      <LocateFileDialog
        target={locateFile.target}
        onLocate={() => void locateFile.locate()}
        onRemove={locateFile.remove}
        onCancel={locateFile.cancel}
      />
    </div>
  )
}
