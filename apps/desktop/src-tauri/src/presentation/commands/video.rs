use tauri::AppHandle;

use crate::{
    application::render::RenderService,
    domain::entities::RenderJobDto,
    infrastructure::ffmpeg::resolver::FfmpegResolver,
    shared::util::emit_log,
};

#[tauri::command]
#[specta::specta]
pub async fn render_audiogram(app: AppHandle, params: RenderJobDto) -> Result<String, String> {
    tauri::async_runtime::spawn_blocking(move || {
        RenderService::execute(app, params)
            .map(|p| p.to_string_lossy().to_string())
    })
    .await
    .map_err(|e| format!("render thread error: {e}"))?
    .map_err(Into::into)
}

#[tauri::command]
#[specta::specta]
pub fn resolve_ffmpeg_path(app: AppHandle) -> Result<String, String> {
    let p = FfmpegResolver::locate(&app).map_err(|e| e.to_string())?;
    emit_log(&app, format!("FFmpeg path: {}", p.display()));
    Ok(p.to_string_lossy().to_string())
}
