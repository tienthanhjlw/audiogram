use std::env;
use tauri::AppHandle;

use crate::{
    domain::entities::Segment,
    infrastructure::{
        ffmpeg::{audio::to_wav, resolver::FfmpegResolver},
        whisper::{model_repo::ModelRepository, runner::WhisperRunner},
    },
    shared::{util::emit_log, AppError},
};

pub struct TranscribeService;

impl TranscribeService {
    /// Transcribe `audio_path` using the named whisper model.
    /// Streams `log` events via `app`.
    pub fn execute(
        app: AppHandle,
        audio_path: String,
        model_name: &str,
    ) -> Result<Vec<Segment>, AppError> {
        emit_log(&app, format!("Transcribing with model '{model_name}'…"));

        let repo = ModelRepository::new(app.clone());

        let bin = WhisperRunner::locate(&app)
            .ok_or_else(|| AppError::Transcribe(
                "Whisper binary not found inside app bundle".into()
            ))?;
        let model = repo.find(model_name)
            .ok_or_else(|| AppError::ModelNotFound(model_name.into()))?;

        emit_log(&app, format!("bin   : {}", bin.display()));
        emit_log(&app, format!("model : {}", model.display()));

        let ffmpeg   = FfmpegResolver::locate(&app)?;
        let tmp_dir  = env::temp_dir().join("audiogram_whisper");
        let wav_path = to_wav(&ffmpeg, &audio_path, &tmp_dir)?;

        WhisperRunner::run(&app, &bin, &wav_path, &model, &audio_path)
    }
}
