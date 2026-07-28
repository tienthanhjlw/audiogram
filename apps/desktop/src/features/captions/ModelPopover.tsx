import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { useAppStore } from '../../store'
import { ipc, type ModelInfo } from '../../core/ipc/client'
import { Button, Popover, ProgressBar, toast } from '../../ui'

// UI_DESIGN_SPEC.md §8.5 — model list + download from the Transcribe
// cluster's model select trigger. `base`'s "BUNDLED" badge became
// "Recommended" per UI_REBUILD_PLAN.md item 15.
export function ModelPopover({ anchorRef, open, onClose }: {
  anchorRef: RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
}) {
  const whisperModel  = useAppStore(s => s.whisperModel)
  const modelDownload = useAppStore(s => s.modelDownload)
  const set           = useAppStore(s => s.set)
  const [models, setModels] = useState<ModelInfo[]>([])

  const refreshModels = useCallback(() => {
    ipc.listModels().then(setModels).catch(() => toast.error('Failed to load model list'))
  }, [])

  useEffect(() => { if (open) refreshModels() }, [open, refreshModels])

  const wasDownloadingRef = useRef(false)
  useEffect(() => {
    if (wasDownloadingRef.current && !modelDownload) refreshModels()
    wasDownloadingRef.current = !!modelDownload
  }, [modelDownload, refreshModels])

  const downloadingName = modelDownload?.name ?? null

  return (
    <Popover anchorRef={anchorRef} open={open} onClose={onClose} className="w-[300px] p-1">
      <div className="flex flex-col gap-0.5">
        {models.length === 0 && (
          <div className="px-3 py-2 text-[12px] text-text-3">Loading models…</div>
        )}
        {models.map(m => {
          const isSelected    = whisperModel === m.name
          const isDownloading = downloadingName === m.name
          const sizeLabel     = m.size_mb >= 1000 ? `${(m.size_mb / 1024).toFixed(1)} GB` : `${m.size_mb} MB`

          return (
            <div
              key={m.name}
              onClick={() => m.downloaded && set({ whisperModel: m.name })}
              className={[
                'flex items-center gap-2.5 rounded-[var(--radius-s)] px-2.5 py-2',
                m.downloaded ? 'cursor-pointer hover:bg-bg-app' : 'cursor-default',
              ].join(' ')}
            >
              <span className={[
                'flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-full border-2',
                isSelected ? 'border-accent bg-accent' : 'border-border',
              ].join(' ')}>
                {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-text-1" />}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-semibold text-text-1">{m.label}</span>
                  <span className="font-mono text-[10px] text-text-3">{sizeLabel}</span>
                  {m.name === 'base' && !isDownloading && (
                    <span className="rounded-[4px] bg-success/15 px-[5px] py-[1px] text-[9px] font-semibold text-success">
                      Recommended
                    </span>
                  )}
                </div>
                <div className="mt-0.5 text-[11px] text-text-3">{m.note}</div>

                {isDownloading && (
                  <div className="mt-1.5">
                    <ProgressBar value={modelDownload?.pct} />
                    <div className="mt-1 text-[10px] font-semibold text-accent">{modelDownload?.pct}%</div>
                  </div>
                )}
              </div>

              {!isDownloading && (
                m.downloaded ? (
                  <span className="flex-shrink-0 text-[11px] font-semibold text-accent">✓</span>
                ) : (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={!!downloadingName}
                    onClick={e => { e.stopPropagation(); ipc.downloadModel(m.name).catch(() => toast.error(`Failed to download ${m.name}`)) }}
                    className="h-7 flex-shrink-0"
                  >
                    Get ↓
                  </Button>
                )
              )}
            </div>
          )
        })}
      </div>
    </Popover>
  )
}
