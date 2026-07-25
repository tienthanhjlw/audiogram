use std::sync::atomic::Ordering;
use tauri::{AppHandle, Emitter, State};

use crate::{
    application::render::{RenderControl, RenderService},
    domain::entities::{RenderEvent, RenderJobDto, SerializableError},
    infrastructure::ffmpeg::resolver::FfmpegResolver,
    shared::{util::emit_log, AppError},
};

#[tauri::command]
#[specta::specta]
pub async fn render_audiogram(
    app: AppHandle,
    params: RenderJobDto,
    control: State<'_, RenderControl>,
) -> Result<String, String> {
    if control.running.compare_exchange(false, true, Ordering::SeqCst, Ordering::SeqCst).is_err() {
        return Err(AppError::AlreadyRendering.into());
    }
    control.cancel.store(false, Ordering::SeqCst);
    let cancel = control.cancel.clone();

    let result = tauri::async_runtime::spawn_blocking(move || {
        RenderService::execute(app.clone(), params, cancel)
            .map(|p| p.to_string_lossy().to_string())
            .map_err(|e| {
                // Cancellation already emits its own Failed event (with
                // temp-file cleanup) from inside encode_blocking — avoid a
                // duplicate. Every other failure path gets one here.
                if !matches!(e, AppError::Cancelled) {
                    let _ = app.emit("render_event", RenderEvent::Failed {
                        error: SerializableError::from(&e),
                    });
                }
                e
            })
    })
    .await
    .map_err(|e| format!("render thread error: {e}"));

    control.running.store(false, Ordering::SeqCst);

    result?.map_err(Into::into)
}

#[tauri::command]
#[specta::specta]
pub fn cancel_render(control: State<'_, RenderControl>) {
    control.cancel.store(true, Ordering::SeqCst);
}

#[tauri::command]
#[specta::specta]
pub fn resolve_ffmpeg_path(app: AppHandle) -> Result<String, String> {
    let p = FfmpegResolver::locate(&app).map_err(|e| e.to_string())?;
    emit_log(&app, format!("FFmpeg path: {}", p.display()));
    Ok(p.to_string_lossy().to_string())
}
