/// Repository for whisper model files — download, locate, seed bundled model.
use std::{
    fs,
    path::PathBuf,
    process::Command,
    sync::{
        atomic::{AtomicBool, Ordering},
        Arc,
    },
    thread,
    time::Duration,
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

        // Polling thread: reports file-size progress while curl writes
        let done      = Arc::new(AtomicBool::new(false));
        let done_poll = done.clone();
        let app_poll  = self.app.clone();
        let dest_poll = dest.clone();
        let name_poll = name.to_string();
        thread::spawn(move || {
            while !done_poll.load(Ordering::Relaxed) {
                let current = fs::metadata(&dest_poll).map(|m| m.len()).unwrap_or(0);
                let pct = if size_bytes > 0 {
                    ((current * 99) / size_bytes).min(99) as u8
                } else { 0 };
                let _ = app_poll.emit("model_download_progress",
                    DownloadProgress { name: name_poll.clone(), percent: pct });
                thread::sleep(Duration::from_millis(400));
            }
        });

        emit_log(&self.app, format!("Downloading ggml-{name}.bin (~{} MB)…", entry.size_mb));

        let status = Command::new("curl")
            .args(["-L", "--fail", "--create-dirs", "-o"])
            .arg(&dest)
            .arg(&url)
            .status()
            .map_err(|e| {
                done.store(true, Ordering::Relaxed);
                AppError::ModelDownload(format!("curl not found — install curl and retry: {e}"))
            })?;

        done.store(true, Ordering::Relaxed);

        if !status.success() {
            let _ = fs::remove_file(&dest);
            return Err(AppError::ModelDownload(format!("Download failed (curl exit {status})")));
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
