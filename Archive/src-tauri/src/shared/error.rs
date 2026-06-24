use thiserror::Error;

#[derive(Debug, Error)]
pub enum AppError {
    #[error("FFmpeg not found: {0}")]
    FfmpegNotFound(String),

    #[error("Audio decode failed: {0}")]
    AudioDecode(String),

    #[error("Encode failed: {0}")]
    Encode(String),

    #[error("Transcription failed: {0}")]
    Transcribe(String),

    #[error("Model '{0}' not found — download it first")]
    ModelNotFound(String),

    #[error("Model download failed: {0}")]
    ModelDownload(String),

    #[error("Subtitle error: {0}")]
    Subtitle(String),

    #[error("IO error: {0}")]
    Io(#[from] std::io::Error),
}

/// Tauri commands return `Result<T, String>` — this blanket conversion makes
/// `.map_err(Into::into)` work everywhere in the presentation layer.
impl From<AppError> for String {
    fn from(e: AppError) -> Self {
        e.to_string()
    }
}
