import { Menu, Submenu } from '@tauri-apps/api/menu'
import { actions } from './actions'
import { SHORTCUTS } from './shortcuts'

function accelerator(id: string): string | undefined {
  return SHORTCUTS.find(s => s.id === id)?.accelerator
}

// UI_REBUILD_PLAN.md §4.2-4.3 / PHASE1_TASKS.md T13 — replaces Tauri's
// built-in default menu with File/Edit/View/Help. Every item's action is one
// of src/app/actions.ts's shared handlers (same ones the keydown listener in
// shortcuts.ts calls), and accelerators are read back out of SHORTCUTS
// instead of retyped here, so menu and shortcut table can't drift.
export async function buildAppMenu(): Promise<void> {
  const fileMenu = await Submenu.new({
    text: 'File',
    items: [
      { text: 'Open Audio…', accelerator: accelerator('openAudio'), action: () => actions.openAudio() },
      { text: 'Export', accelerator: accelerator('export'), action: () => actions.exportProject() },
      { item: 'Separator' },
      // Not in UI_DESIGN_SPEC.md §3's item list, but replacing the default
      // app menu removes the OS-provided Quit — without this there'd be no
      // way to quit on macOS at all.
      { item: 'Quit' },
    ],
  })

  const editMenu = await Submenu.new({
    text: 'Edit',
    items: [
      { item: 'Undo' },
      { item: 'Redo' },
      { item: 'Separator' },
      { item: 'Cut' },
      { item: 'Copy' },
      { item: 'Paste' },
      { item: 'SelectAll' },
    ],
  })

  const viewMenu = await Submenu.new({
    text: 'View',
    items: [
      { text: 'Design', accelerator: accelerator('modeDesign'), action: () => actions.setModeDesign() },
      { text: 'Captions', accelerator: accelerator('modeCaptions'), action: () => actions.setModeCaptions() },
    ],
  })

  const helpMenu = await Submenu.new({
    text: 'Help',
    items: [
      { text: 'Keyboard Shortcuts', action: () => actions.openShortcutsHelp() },
    ],
  })

  const menu = await Menu.new({ items: [fileMenu, editMenu, viewMenu, helpMenu] })
  await menu.setAsAppMenu()
}
