/// Whisper-cpp subprocess runner — transcribes a WAV file to timestamped segments.
use std::{
    fs,
    io::{BufRead, BufReader},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    thread,
};
use tauri::{AppHandle, Emitter, Manager};

use crate::{
    domain::entities::Segment,
    shared::{util::{emit_log, ensure_executable}, AppError},
};

pub struct WhisperRunner;

impl WhisperRunner {
    /// Locate the whisper-cpp binary relative to the current executable.
    pub fn locate(app: &AppHandle) -> Option<PathBuf> {
        let triple = option_env!("TAURI_ENV_TARGET_TRIPLE");
        let mut dirs: Vec<PathBuf> = Vec::new();
        if let Ok(exe) = std::env::current_exe() {
            if let Some(d) = exe.parent() { dirs.push(d.to_path_buf()); }
        }
        if let Ok(d) = app.path().executable_dir() { dirs.push(d); }
        for dir in &dirs {
            let base = dir.join("whisper-cpp");
            if let Some(t) = triple {
                let suffixed = base.with_file_name(format!("whisper-cpp-{t}"));
                if suffixed.exists() { let _ = ensure_executable(&suffixed); return Some(suffixed); }
            }
            if base.exists() { let _ = ensure_executable(&base); return Some(base); }
        }
        None
    }

    /// Run whisper-cpp on `wav_path` with `model_path`, streaming stderr to the frontend.
    /// Returns the parsed segments.
    pub fn run(
        app: &AppHandle,
        bin: &Path,
        wav_path: &Path,
        model_path: &Path,
        audio_path: &str,
    ) -> Result<Vec<Segment>, AppError> {
        let tmp_dir = std::env::temp_dir().join("audiogram_whisper");
        fs::create_dir_all(&tmp_dir)?;

        let stem = Path::new(audio_path)
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("audio")
            .to_string();
        let out_prefix = tmp_dir.join(&stem);

        let mut cmd = Command::new(bin);
        cmd .arg("-m").arg(model_path)
            .arg("-f").arg(wav_path)
            .arg("--output-json")
            .arg("-of").arg(&out_prefix)
            .arg("-t").arg("4")
            .arg("--language").arg("auto")
            .arg("--split-on-word")
            .arg("--max-len").arg("42");

        let mut child = cmd
            .stderr(Stdio::piped())
            .stdout(Stdio::piped())
            .spawn()
            .map_err(|e| AppError::Transcribe(format!("spawn whisper: {e}")))?;

        let app_log = app.clone();
        if let Some(stderr) = child.stderr.take() {
            thread::spawn(move || {
                for line in BufReader::new(stderr).lines().flatten() {
                    let _ = app_log.emit("log", format!("[whisper] {line}"));
                }
            });
        }

        let status = child.wait()
            .map_err(|e| AppError::Transcribe(format!("whisper wait: {e}")))?;
        if !status.success() {
            return Err(AppError::Transcribe(format!("whisper-cpp exited: {status}")));
        }

        let json_path = tmp_dir.join(format!("{stem}.json"));
        let json_str  = fs::read_to_string(&json_path)
            .map_err(|e| AppError::Transcribe(format!("read whisper json: {e}")))?;
        let parsed: serde_json::Value = serde_json::from_str(&json_str)
            .map_err(|e| AppError::Transcribe(format!("parse whisper json: {e}")))?;

        let raw = parsed["transcription"]
            .as_array()
            .cloned()
            .or_else(|| parsed["segments"].as_array().cloned())
            .unwrap_or_default();

        let segments: Vec<Segment> = raw
            .iter()
            .enumerate()
            .map(|(i, s)| {
                if s.get("offsets").is_some() {
                    Segment {
                        id:    i as u32,
                        start: s["offsets"]["from"].as_f64().unwrap_or(0.0) / 1000.0,
                        end:   s["offsets"]["to"].as_f64().unwrap_or(0.0)   / 1000.0,
                        text:  s["text"].as_str().unwrap_or("").trim().to_string(),
                    }
                } else {
                    Segment {
                        id:    i as u32,
                        start: s["start"].as_f64().unwrap_or(0.0),
                        end:   s["end"].as_f64().unwrap_or(0.0),
                        text:  s["text"].as_str().unwrap_or("").trim().to_string(),
                    }
                }
            })
            .filter(|s| !s.text.is_empty())
            .collect();

        emit_log(app, format!("Done — {} segments", segments.len()));
        Ok(segments)
    }
}
