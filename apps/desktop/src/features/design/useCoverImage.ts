import { useCallback } from 'react'
import { open } from '@tauri-apps/plugin-dialog'
import { useAppStore } from '../../store'

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp']

/** Cover image picker — moved out of StepLayout.tsx's local
 * `pickCoverImage` (PHASE2_TASKS.md T8 step 4), shared by the Inspector's
 * Canvas and Avatar sections (both offer the same image well). Uses
 * `@tauri-apps/plugin-dialog` directly, which is fine at the feature layer
 * — the no-restricted-imports ban is specifically on `@tauri-apps/api/core`
 * (TECH_ARCHITECTURE.md §2.3), not every Tauri package. */
export function useCoverImage() {
  const coverImagePath = useAppStore(s => s.coverImagePath)
  const set = useAppStore(s => s.set)

  const pick = useCallback(async () => {
    const file = await open({
      multiple: false,
      filters: [{ name: 'Image', extensions: IMAGE_EXTENSIONS }],
    })
    if (!file) return
    set({ coverImagePath: String(file) })
  }, [set])

  const remove = useCallback(() => set({ coverImagePath: '' }), [set])

  return { coverImagePath, pick, remove }
}
