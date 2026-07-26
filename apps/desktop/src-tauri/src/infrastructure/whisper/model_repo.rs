/// Repository for whisper model files — download, locate, seed bundled model.
use std::{
    fs,
    io::{Read, Write},
    path::PathBuf,
    time::{Duration, Instant},
};
use tauri::{AppHandle, Emitter, Manager};

use crate::{
    domain::entities::{ModelInfo, ModelSpec, MODELS},
    shared::{util::emit_log, AppError},
};

#[derive(Serialize, Clone)]
struct DownloadProgress {
    name: String,
    percent: u8,
}
use serde::Serialize;

/// Repository that manages whisper model files in `app_data_dir/models/`.
pub struct ModelRepository {
    app: AppHandle,
}

impl ModelRepository {
    pub fn new(app: AppHandle) -> Self {
        Self { app }
    }

    fn model_dir(&self) -> PathBuf {
        self.app.path().app_data_dir()
            .unwrap_or_else(|_| std::env::temp_dir())
            .join("models")
    }

    fn model_path(&self, name: &str) -> PathBuf {
        self.model_dir().join(format!("ggml-{name}.bin"))
    }

    /// Locate a model by name — checks app_data_dir first, then resource_dir (bundled base).
    pub fn find(&self, name: &str) -> Option<PathBuf> {
        let p = self.model_path(name);
        if p.exists() && p.metadata().map(|m| m.len() > 0).unwrap_or(false) {
            return Some(p);
        }
        if let Ok(res) = self.app.path().resource_dir() {
            let p = res.join("models").join(format!("ggml-{name}.bin"));
            if p.exists() { return Some(p); }
        }
        None
    }

    /// Return status of all known whisper models.
    pub fn list(&self) -> Vec<ModelInfo> {
        MODELS.iter().map(|m| ModelInfo {
            name:       m.name.to_string(),
            label:      m.label.to_string(),
            size_mb:    m.size_mb,
            note:       m.note.to_string(),
            downloaded: self.find(m.name).is_some(),
        }).collect()
    }

    /// Download a whisper model from HuggingFace.
    /// Emits `model_download_progress { name, percent }` events while running.
    pub fn download(&self, name: &str) -> Result<(), AppError> {
        let entry: &ModelSpec = MODELS.iter().find(|m| m.name == name)
            .ok_or_else(|| AppError::ModelDownload(format!("Unknown model: {name}")))?;
        let size_bytes = entry.size_mb as u64 * 1_048_576u64;

        let dir  = self.model_dir();
        let dest = self.model_path(name);
        let url  = format!(
            "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-{name}.bin"
        );

        fs::create_dir_all(&dir)?;

        // Remove incomplete previous attempts
        if dest.exists() {
            let existing = dest.metadata().map(|m| m.len()).unwrap_or(0);
            if existing > 0 && existing < size_bytes.saturating_sub(1_000_000) {
                let _ = fs::remove_file(&dest);
            }
        }

        emit_log(&self.app, format!("Downloading ggml-{name}.bin (~{} MB)…", entry.size_mb));

        // OPTIMIZATION_PLAN.md F7 — was a `curl` subprocess + a separate
        // file-size-polling thread for progress (no guaranteed `curl` on a
        // clean Windows install). `reqwest::blocking` streams the response
        // body directly, so progress comes from bytes actually read — no
        // polling thread needed. This still runs on the same
        // `spawn_blocking` worker the command handler already uses
        // (presentation/commands/transcript.rs's `download_model`), so a
        // blocking client is the right tool, not `reqwest::Client` + tokio.
        let response = reqwest::blocking::get(&url)
            .map_err(|e| AppError::ModelDownload(format!("Download request failed: {e}")))?;

        if !response.status().is_success() {
            return Err(AppError::ModelDownload(format!(
                "Download failed (HTTP {})", response.status()
            )));
        }

        let total = response.content_length().unwrap_or(size_bytes);
        let mut reader = response;
        let mut file = fs::File::create(&dest)?;
        let mut buf = [0u8; 64 * 1024];
        let mut downloaded: u64 = 0;
        let mut last_emit = Instant::now();

        let result: Result<(), AppError> = loop {
            let n = match reader.read(&mut buf) {
                Ok(0) => break Ok(()),
                Ok(n) => n,
                Err(e) => break Err(AppError::ModelDownload(format!("Download read error: {e}"))),
            };
            if let Err(e) = file.write_all(&buf[..n]) {
                break Err(AppError::Io(e));
            }
            downloaded += n as u64;
            if last_emit.elapsed() >= Duration::from_millis(400) {
                let pct = if total > 0 { ((downloaded * 99) / total).min(99) as u8 } else { 0 };
                let _ = self.app.emit("model_download_progress",
                    DownloadProgress { name: name.to_string(), percent: pct });
                last_emit = Instant::now();
            }
        };

        if let Err(e) = result {
            drop(file);
            let _ = fs::remove_file(&dest);
            return Err(e);
        }

        let _ = self.app.emit("model_download_progress",
            DownloadProgress { name: name.to_string(), percent: 100 });
        emit_log(&self.app, format!("Model ggml-{name}.bin ready"));
        Ok(())
    }

    /// On first launch, copy the bundled base model into `app_data_dir`.
    pub fn seed_bundled(&self) {
        let Ok(res)  = self.app.path().resource_dir()  else { return };
        let Ok(data) = self.app.path().app_data_dir()  else { return };
        let src      = res.join("models").join("ggml-base.bin");
        let dst_dir  = data.join("models");
        let dst      = dst_dir.join("ggml-base.bin");
        if src.exists() && !dst.exists() {
            let _ = fs::create_dir_all(&dst_dir);
            if let Err(e) = fs::copy(&src, &dst) {
                let _ = self.app.emit("log", format!("[setup] model seed failed: {e}"));
            }
        }
    }
}
