// Re-export shim (Phase 1 T7) — the real implementation now lives in
// store/, split into slices per TECH_ARCHITECTURE.md §2.2. This file stays
// so every existing `import { useAppStore } from '../store'` (or '../../store')
// across the legacy Step components keeps resolving without edits.
export * from './store/index'
