use audiogram_core::entities::RenderEvent;

/// Cuts Tauri out of the render pipeline (PACKAGE_SPLIT_PLAN.md §3.1's "one
/// blemish": `AppHandle`/`Emitter`). The app crate's `encode_blocking`
/// implements this with a `TauriSink` that fans each event out to both the
/// structured `render_event` channel and the legacy `log`/`render_progress`
/// events (T9 compat) — this crate itself never touches Tauri.
pub trait ProgressSink: Send + Sync {
    fn emit(&self, event: RenderEvent);
}

/// No-op sink for tests/callers that don't care about progress.
pub struct NullSink;

impl ProgressSink for NullSink {
    fn emit(&self, _event: RenderEvent) {}
}
