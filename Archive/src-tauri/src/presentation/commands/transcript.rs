use tauri::AppHandle;

use crate::{
    application::{model::ModelService, transcribe::TranscribeService},
    domain::entities::{ModelInfo, Segment},
    infrastructure::subtitle::{ass::AssWriter, srt::SrtWriter},
};

#[tauri::command]
pub fn list_models(app: AppHandle) -> Vec<ModelInfo> {
    ModelService::list(app)
}

#[tauri::command]
pub async fn download_model(app: AppHandle, name: String) -> Result<(), String> {
    tauri::async_runtime::spawn_blocking(move || {
        ModelService::download(app, name).map_err(Into::into)
    })
    .await
    .map_err(|e| format!("download thread: {e}"))?
}

#[tauri::command]
pub async fn transcribe_audio(
    app: AppHandle,
    audio_path: String,
    model_name: Option<String>,
) -> Result<Vec<Segment>, String> {
    let model = model_name.unwrap_or_else(|| "base".into());
    tauri::async_runtime::spawn_blocking(move || {
        TranscribeService::execute(app, audio_path, &model).map_err(Into::into)
    })
    .await
    .map_err(|e| format!("transcribe thread error: {e}"))?
}

#[tauri::command]
pub fn write_srt(segments: Vec<Segment>) -> Result<String, String> {
    SrtWriter::write(&segments)
        .map(|p| p.to_string_lossy().to_string())
        .map_err(Into::into)
}

#[tauri::command]
pub fn write_ass(
    segments: Vec<Segment>,
    highlight_color: String,
    video_width: Option<u32>,
    video_height: Option<u32>,
    font_size_pct: Option<u32>,
    layout_template: Option<String>,
    karaoke_enabled: Option<bool>,
    font_name: Option<String>,
    subtitle_y_pct: Option<f64>,
    subtitle_color: Option<String>,
) -> Result<String, String> {
    AssWriter::write(
        &segments,
        &highlight_color,
        video_width,
        video_height,
        font_size_pct,
        layout_template.as_deref(),
        karaoke_enabled,
        font_name.as_deref(),
        subtitle_y_pct,
        subtitle_color.as_deref(),
    )
    .map(|p| p.to_string_lossy().to_string())
    .map_err(Into::into)
}
