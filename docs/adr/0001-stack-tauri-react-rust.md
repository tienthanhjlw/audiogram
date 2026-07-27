# ADR 0001: Tauri v2 + React 19 + Rust stack choice

**Status:** Accepted (Phase 1)  
**Date:** 2025-12-01  
**Authors:** Audiogram team  
**Context:** Building a cross-platform desktop audio visualization tool with professional graphics pipeline.

## Decision

Use **Tauri v2** (lightweight Electron alternative) + **React 19** (frontend) + **Rust** (backend) as the core stack:
- Tauri as the webview container with native command IPC
- React 19 for UI (Tailwind CSS 4 for styling)
- Rust (Cargo workspace) for: core domain entities, FFT spectrum analysis, frame rasterization, subtitle generation, audio transcription model integration
- TypeScript for all frontend code, **no JavaScript runtime** outside React

## Rationale

1. **Tauri v2 over Electron**: ~100MB bundle vs ~300MB; native menu, file dialogs, notifications; type-safe IPC via `tauri-specta v2` (zero-cost abstraction over raw Tauri bindings)
2. **React 19 + Zustand v5** over custom framework: Widely-known component model; Zustand's object-based store avoids Redux boilerplate; v5's `useSyncExternalStore` integration is minimal and predictable
3. **Rust backend**: FFT via `rustfft`; frame rasterization with `tiny-skia` + `cosmic-text` (bundled fonts); no external C dependencies beyond FFmpeg
4. **monorepo (npm + Cargo)**: `apps/desktop/` (Tauri), `packages/` (npm workspaces), `crates/` (Cargo) — clear ownership, shared contract codegen

## Consequences

- **Binding regeneration**: Tauri-specta's `.export()` writes bindings relative to CWD; Tauri binary must run from `apps/desktop/src-tauri`, not workspace root (discovered in P3-T13)
- **CSS-in-JS**: Tailwind v4 plays well with React but CSS variables are the primary theming mechanism (no styled-components)
- **IPC boundary**: `core/ipc/` is the *only* place raw Tauri API is called; all other frontend code uses typed wrappers in `core/ipc/client.ts`
- **No hot-reload between native/frontend**: Changes to Rust require `cargo build`; webview reloads happen separately. Dev experience mirrors Electron/wry more than hot-module-replacement SPA frameworks

## Related ADRs
- ADR-0002 (Layout parity)
- ADR-0003 (Contract codegen)
