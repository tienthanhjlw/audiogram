import { Button, Modal } from '../../ui'
import type { MissingFileTarget } from './useLocateMissingFile'

// UI_DESIGN_SPEC.md §8.4 — paired with useLocateMissingFile.ts; both the
// RecentGrid click flow and session auto-restore (P4-T8) render this same
// dialog through that hook's `target`.
export function LocateFileDialog({ target, onLocate, onRemove, onCancel }: {
  target: MissingFileTarget | null
  onLocate: () => void
  onRemove: () => void
  onCancel: () => void
}) {
  return (
    <Modal open={!!target} onClose={onCancel}>
      <div className="w-[360px] p-5">
        <div className="text-[15px] font-semibold text-text-1">Audio file not found</div>
        <p className="mt-2 text-[13px] leading-relaxed text-text-2">
          &ldquo;{target?.audioName}&rdquo; was moved or deleted.
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
          <Button variant="ghost" size="sm" onClick={onRemove}>Remove from Recents</Button>
          <Button variant="primary" size="sm" onClick={onLocate}>Locate File…</Button>
        </div>
      </div>
    </Modal>
  )
}
