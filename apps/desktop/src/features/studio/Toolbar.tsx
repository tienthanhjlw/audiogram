import { useEffect, useRef, useState, type ReactNode } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { useAppStore, type Mode } from '../../store'
import { isMac, TRAFFIC_LIGHT_INSET } from '../../app/platform'
import { actions } from '../../app/actions'
import { ipc } from '../../core/ipc/client'
import { listRecents, type RecentEntry } from '../../core/persistence/SessionRepository'
import { AUDIO_EXTENSIONS, deriveAudioMeta } from '../../domain/audio'
import { Button, Modal, Popover, SegmentedControl, Tooltip } from '../../ui'

interface MenuItemProps {
  label: string
  hint?: string
  onSelect?: () => void
  disabled?: boolean
  disabledReason?: string
}

function MenuItem({ label, hint, onSelect, disabled, disabledReason }: MenuItemProps) {
  const button = (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onSelect}
      className="flex h-7 w-full items-center justify-between px-2.5 text-left text-[12.5px] text-text-1 hover:bg-accent-soft disabled:pointer-events-none disabled:opacity-40"
    >
      <span>{label}</span>
      {hint && <span className="text-text-3">{hint}</span>}
    </button>
  )
  if (!disabled || !disabledReason) return button
  return <Tooltip content={disabledReason}>{button}</Tooltip>
}

function MenuSeparator() {
  return <div role="separator" className="my-1 h-px bg-border" />
}

// shell/Toolbar.tsx — UI_DESIGN_SPEC.md §3, built in full per PHASE1_TASKS.md
// T11: file chip + dropdown (Open Audio real, Open Recent/Replace Audio
// disabled — need Recents/§8.2 infra not built until Phase 2), mode
// switcher, Export button. `Reveal in Finder` is wired for real since
// ipc.openFolder already exists (T8) and needs no new infra. Open
// Audio/Export/mode-switch all call into app/actions.ts (T13) — the same
// functions the keydown shortcuts and native menu use — instead of each
// having their own copy of the logic.
export function Toolbar() {
  const audioPath = useAppStore(s => s.audioPath)
  const audioName = useAppStore(s => s.audioName)
  const mode = useAppStore(s => s.mode)
  const isRendering = useAppStore(s => s.isRendering)
  const progress = useAppStore(s => s.progress)
  const segmentsCount = useAppStore(s => s.segments.length)

  const [menuOpen, setMenuOpen] = useState(false)
  const [recentOpen, setRecentOpen] = useState(false)
  const [recents, setRecents] = useState<RecentEntry[]>([])
  const [confirmNewProject, setConfirmNewProject] = useState(false)
  const [replacePath, setReplacePath] = useState<string | null>(null)
  const chipRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!menuOpen) { setRecentOpen(false); return }
    void listRecents().then(setRecents)
  }, [menuOpen])

  const pickFile = () => {
    void actions.openAudio()
    setMenuOpen(false)
  }

  const openRecent = (entry: RecentEntry) => {
    actions.openRecentEntry(entry)
    setMenuOpen(false)
  }

  const startReplace = async () => {
    setMenuOpen(false)
    const file = await open({ multiple: false, filters: [{ name: 'Audio', extensions: AUDIO_EXTENSIONS }] })
    if (file) setReplacePath(String(file))
  }

  const confirmReplace = () => {
    if (!replacePath) return
    // UI_DESIGN_SPEC.md §8.2 — keeps design/captions state, only the audio
    // itself changes (unlike openAudio/openRecentEntry, which also reset
    // screen/mode — Replace Audio happens from inside Studio, nothing to
    // navigate to).
    const meta = deriveAudioMeta(replacePath)
    useAppStore.getState().set({ audioPath: meta.audioPath, audioName: meta.audioName })
    setReplacePath(null)
  }

  const revealInFinder = () => {
    if (!audioPath) return
    const dir = audioPath.replace(/\\/g, '/').replace(/\/[^/]*$/, '')
    void ipc.openFolder(dir)
    setMenuOpen(false)
  }

  const handleModeChange = (next: Mode) => {
    if (next === 'design') actions.setModeDesign()
    else actions.setModeCaptions()
  }

  const confirmReset = () => {
    useAppStore.setState(useAppStore.getInitialState(), true)
    setConfirmNewProject(false)
  }

  return (
    <div
      data-tauri-drag-region
      className="flex h-12 items-center border-b border-border bg-bg-panel pr-3"
      style={{ paddingLeft: isMac ? TRAFFIC_LIGHT_INSET : 12 }}
    >
      <div className="flex flex-1 items-center">
        <button
          ref={chipRef}
          type="button"
          onClick={() => setMenuOpen(o => !o)}
          className="flex h-[30px] items-center gap-1.5 rounded-[var(--radius-s)] px-2 text-[13px] text-text-1 hover:bg-bg-elevated"
        >
          <NoteIcon />
          <span className="max-w-[240px] truncate">{audioName || 'No file'}</span>
          <CaretIcon />
        </button>

        <Popover anchorRef={chipRef} open={menuOpen} onClose={() => setMenuOpen(false)} className="min-w-[220px]">
          <MenuItem label="Open Audio…" hint="⌘O" onSelect={pickFile} />
          <MenuItem
            label="Open Recent"
            hint={recentOpen ? '▾' : '▸'}
            disabled={recents.length === 0}
            disabledReason="No recent projects yet"
            onSelect={() => setRecentOpen(o => !o)}
          />
          {recentOpen && recents.length > 0 && (
            <div role="menu" className="border-y border-border py-1">
              {recents.map(entry => (
                <button
                  key={entry.audioPath}
                  type="button"
                  role="menuitem"
                  onClick={() => openRecent(entry)}
                  className="flex h-7 w-full items-center px-4 text-left text-[12.5px] text-text-2 hover:bg-accent-soft hover:text-text-1"
                >
                  <span className="truncate">{entry.title || entry.audioName}</span>
                </button>
              ))}
            </div>
          )}
          <MenuSeparator />
          <MenuItem label="Replace Audio…" onSelect={() => void startReplace()} disabled={!audioPath} />
          <MenuItem label="Reveal in Finder" onSelect={revealInFinder} disabled={!audioPath} />
          <MenuSeparator />
          <MenuItem label="New Project" onSelect={() => { setMenuOpen(false); setConfirmNewProject(true) }} />
        </Popover>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <SegmentedControl
          value={mode}
          onChange={handleModeChange}
          options={[
            { value: 'design' as Mode, label: 'Design' },
            { value: 'captions' as Mode, label: segmentsCount > 0 ? `Captions · ${segmentsCount}` : 'Captions' },
          ]}
        />
      </div>

      <div className="flex flex-1 items-center justify-end">
        {isRendering ? (
          <Button variant="secondary" size="md" onClick={actions.exportProject}>
            ◔ {progress}%
          </Button>
        ) : (
          <Button variant="primary" size="md" shortcutHint="⌘E" disabled={!audioPath} onClick={actions.exportProject}>
            Export
          </Button>
        )}
      </div>

      <Modal open={confirmNewProject} onClose={() => setConfirmNewProject(false)}>
        <div className="w-[360px] p-5">
          <div className="text-[15px] font-semibold text-text-1">Start a new project?</div>
          <p className="mt-2 text-[13px] leading-relaxed text-text-2">
            This resets the current audio, layout, and captions. This can&rsquo;t be undone.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setConfirmNewProject(false)}>Cancel</Button>
            <Button variant="danger" size="sm" onClick={confirmReset}>New Project</Button>
          </div>
        </div>
      </Modal>

      <Modal open={!!replacePath} onClose={() => setReplacePath(null)}>
        <div className="w-[360px] p-5">
          <div className="text-[15px] font-semibold text-text-1">Replace audio?</div>
          <p className="mt-2 text-[13px] leading-relaxed text-text-2">
            Layout and captions are kept.
            {segmentsCount > 0 && ' Captions were timed to the previous audio and may drift.'}
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setReplacePath(null)}>Cancel</Button>
            <Button variant="primary" size="sm" onClick={confirmReplace}>Replace</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}

function NoteIcon(): ReactNode {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="text-text-2">
      <path d="M6 12.5a1.75 1.75 0 100-3.5 1.75 1.75 0 000 3.5z" stroke="currentColor" strokeWidth="1.3" />
      <path d="M7.75 11V2.5L13 1.5v7.25" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function CaretIcon(): ReactNode {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="text-text-3">
      <path d="M2.5 4l2.5 2.5L7.5 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}
