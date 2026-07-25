use tauri::AppHandle;

use crate::{
    infrastructure::{
        ffmpeg::resolver::FfmpegResolver,
        spectrum::rustfft::{analyze, SpectrumResult},
    },
};

#[tauri::command]
#[specta::specta]
pub async fn analyze_spectrum(app: AppHandle, audio_path: String) -> Result<SpectrumResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let ffmpeg = FfmpegResolver::locate(&app).map_err(|e| e.to_string())?;
        analyze(&ffmpeg, &audio_path).map_err(Into::into)
    })
    .await
    .map_err(|e| format!("spectrum thread error: {e}"))?
}
