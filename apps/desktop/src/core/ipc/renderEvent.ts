// Mirrors src-tauri/src/domain/entities/render_event.rs's RenderEvent enum.
// Not in bindings.gen.ts: tauri-specta only tracks types reachable from a
// command signature, and this only ever crosses the boundary as an event
// payload (app.emit("render_event", ...)) — we don't use tauri-specta's
// .events() builder feature, matching the existing plain listen() pattern
// for 'log'/'render_progress'/'model_download_progress'.
//
// #[serde(tag = "kind", rename_all = "snake_case")] on both enums means:
// { kind: "stage", stage: "preparing" }, { kind: "progress", pct, frame, total },
// { kind: "log", line }, { kind: "failed", error: {kind, message} },
// { kind: "done", output }.

export type RenderStage = 'preparing' | 'captions' | 'frames' | 'encoding'

export interface SerializableError {
  kind: string
  message: string
}

export type RenderEvent =
  | { kind: 'stage'; stage: RenderStage }
  | { kind: 'progress'; pct: number; frame: number; total: number }
  | { kind: 'log'; line: string }
  | { kind: 'failed'; error: SerializableError }
  | { kind: 'done'; output: string }
