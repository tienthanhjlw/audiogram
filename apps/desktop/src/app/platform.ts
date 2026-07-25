// Detected once via userAgent rather than pulling in @tauri-apps/api/os,
// since the only thing the shell needs to know is "leave room for macOS
// traffic lights or not" (UI_REBUILD_PLAN.md §4.1, UI_DESIGN_SPEC.md §1.3).
export const isMac = /Mac|iPhone|iPod|iPad/i.test(navigator.userAgent)

/** Toolbar padding-left (px) to clear the macOS traffic lights when the
 * window uses titleBarStyle: "Overlay". Windows/Linux need none. */
export const TRAFFIC_LIGHT_INSET = 78
