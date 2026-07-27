use serde::Serialize;
use specta::Type;

use crate::AppError;

/// The 4 stages `encode_blocking` moves through before the terminal
/// `RenderEvent::Done`/`Failed`. TECH_ARCHITECTURE.md §2.3.
#[derive(Debug, Clone, Copy, Serialize, Type)]
#[serde(rename_all = "snake_case")]
pub enum RenderStage {
    Preparing,
    Captions,
    Frames,
    Encoding,
}

/// Wire-format error — `AppError` itself isn't Serialize (it wraps
/// std::io::Error via #[from], which isn't), and reusing the exact Rust
/// enum shape isn't the point anyway: the frontend just needs the same
/// `kind` taxonomy `core/errors.ts`'s `toAppError` already classifies
/// command-error strings into, now supplied authoritatively instead of
/// guessed from a substring match.
#[derive(Debug, Clone, Serialize, Type)]
pub struct SerializableError {
    pub kind: String,
    pub message: String,
}

impl From<&AppError> for SerializableError {
    fn from(e: &AppError) -> Self {
        let kind = match e {
            AppError::FfmpegNotFound(_) => "ffmpeg-missing",
            AppError::AudioDecode(_) => "decode-failed",
            AppError::Transcribe(_) | AppError::ModelNotFound(_) | AppError::ModelDownload(_) => "whisper-failed",
            AppError::Io(_) => "io",
            AppError::Cancelled => "cancelled",
            AppError::AlreadyRendering => "already-rendering",
            AppError::Encode(_)
            | AppError::Subtitle(_)
            | AppError::InvalidWaveStyle(_)
            | AppError::InvalidLayout(_)
            | AppError::InvalidTitleAlign(_) => "unknown",
        };
        Self { kind: kind.to_string(), message: e.to_string() }
    }
}

/// Structured render-progress channel — TECH_ARCHITECTURE.md §2.3, §4.2.
/// Emitted on the `render_event` Tauri event alongside (not replacing, in
/// Phase 1) the pre-existing plain `log`/`render_progress` events the old
/// Step components still listen for.
#[derive(Debug, Clone, Serialize, Type)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum RenderEvent {
    Stage { stage: RenderStage },
    Progress { pct: f32, frame: u32, total: u32 },
    Log { line: String },
    Failed { error: SerializableError },
    Done { output: String },
}
