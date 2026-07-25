use std::path::PathBuf;
use tauri::AppHandle;

use crate::{
    domain::entities::{RenderJob, RenderJobDto},
    infrastructure::ffmpeg::{render::encode_blocking, resolver::FfmpegResolver},
    shared::AppError,
};

pub struct RenderService;

impl RenderService {
    /// Validate `dto`, resolve FFmpeg, and encode to the output path.
    /// Streams `render_progress` and `log` events via `app`.
    pub fn execute(app: AppHandle, dto: RenderJobDto) -> Result<PathBuf, AppError> {
        let job    = RenderJob::try_from(dto)?;
        let ffmpeg = FfmpegResolver::locate(&app)?;
        encode_blocking(app, ffmpeg, job)
    }
}
