use std::{
    path::PathBuf,
    sync::{atomic::AtomicBool, Arc},
};
use tauri::AppHandle;

use crate::{
    domain::entities::{RenderJob, RenderJobDto},
    infrastructure::ffmpeg::{render::encode_blocking, resolver::FfmpegResolver},
    shared::AppError,
};

/// Shared render state, `.manage()`d once in `lib.rs` — TECH_ARCHITECTURE.md
/// §4.2. `running` rejects a second concurrent render_audiogram call;
/// `cancel` is checked by `encode_blocking`'s frame loop and flipped by the
/// `cancel_render` command. Both Arc<AtomicBool> so they can be cloned out
/// of the `tauri::State` borrow and moved into the spawn_blocking closure.
#[derive(Default)]
pub struct RenderControl {
    pub running: Arc<AtomicBool>,
    pub cancel: Arc<AtomicBool>,
}

pub struct RenderService;

impl RenderService {
    /// Validate `dto`, resolve FFmpeg, and encode to the output path.
    /// Streams `render_progress`/`log` (legacy) and `render_event`
    /// (TECH_ARCHITECTURE.md §2.3) events via `app`.
    pub fn execute(app: AppHandle, dto: RenderJobDto, cancel: Arc<AtomicBool>) -> Result<PathBuf, AppError> {
        let job    = RenderJob::try_from(dto)?;
        let ffmpeg = FfmpegResolver::locate(&app)?;
        encode_blocking(app, ffmpeg, job, cancel)
    }
}
