import { convertFileSrc } from '@tauri-apps/api/core'

/** Thin wrapper so features/ never imports `@tauri-apps/api/core` directly
 * (TECH_ARCHITECTURE.md §2.3) for the one non-IPC call every asset loader
 * needs — converting a local file path into a URL the webview can load. */
export function assetUrl(path: string): string {
  return convertFileSrc(path)
}
