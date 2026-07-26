import { useAppStore } from '../store'
import { Modal } from '../ui'
import { SHORTCUTS, shortcutDisplay } from './shortcuts'

// Rendered once from App.tsx regardless of screen — Help should work from
// Start or Studio alike. Lists SHORTCUTS directly (T13's "single source"),
// not a hand-copied description of it.
export function ShortcutsHelpModal() {
  const open = useAppStore(s => s.shortcutsHelpOpen)
  const set = useAppStore(s => s.set)

  return (
    <Modal open={open} onClose={() => set({ shortcutsHelpOpen: false })} className="w-[360px] p-5">
      <div className="text-[15px] font-semibold text-text-1">Keyboard Shortcuts</div>
      <ul className="mt-4 flex flex-col gap-2.5">
        {SHORTCUTS.map(s => (
          <li key={s.id} className="flex items-center justify-between text-[13px]">
            <span className="text-text-2">{s.label}</span>
            <span className="tabular rounded bg-bg-app px-1.5 py-0.5 text-[12px] text-text-1">
              {shortcutDisplay(s)}
            </span>
          </li>
        ))}
      </ul>
    </Modal>
  )
}
