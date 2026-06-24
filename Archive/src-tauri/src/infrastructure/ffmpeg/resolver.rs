use std::{env, path::{Path, PathBuf}};
use tauri::{AppHandle, Manager};
use crate::shared::{util::{emit_log, ensure_executable}, AppError};

/// Locates the FFmpeg binary using a priority-ordered search.
///
/// Resolution order:
///   0. `FFMPEG_PATH` env var override
///   1. System `PATH` (+ common Homebrew paths on macOS)
///   2. Current executable directory
///   3. Tauri `executable_dir`
///   4. macOS bundle `Contents/Resources`
///   5. Tauri `resource_dir`
///
/// Each candidate is also tried with a Tauri target-triple suffix
/// (e.g. `ffmpeg-aarch64-apple-darwin`).
pub struct FfmpegResolver;

impl FfmpegResolver {
    pub fn locate(app: &AppHandle) -> Result<PathBuf, AppError> {
        if let Ok(p) = env::var("FFMPEG_PATH") {
            let path = PathBuf::from(&p);
            if path.exists() {
                emit_log(app, format!("Using FFmpeg from FFMPEG_PATH: {}", path.display()));
                return Ok(path);
            }
            emit_log(app, format!("FFMPEG_PATH set but not found: {p}"));
        }

        if let Some(p) = find_in_path("ffmpeg") {
            emit_log(app, format!("Using FFmpeg from PATH: {}", p.display()));
            return Ok(p);
        }

        let mut dirs: Vec<PathBuf> = Vec::new();
        if let Ok(exe) = std::env::current_exe() {
            if let Some(d) = exe.parent() { dirs.push(d.to_path_buf()); }
        }
        if let Ok(d) = app.path().executable_dir() { dirs.push(d); }
        if let Some(d) = dirs.first() {
            if d.ends_with("MacOS") {
                if let Some(contents) = d.parent() { dirs.push(contents.join("Resources")); }
            }
        }
        if let Ok(d) = app.path().resource_dir() { dirs.push(d); }

        let triple = option_env!("TAURI_ENV_TARGET_TRIPLE");
        let mut tried: Vec<PathBuf> = Vec::new();

        for dir in dirs {
            let candidates = [
                dir.join("binaries").join("macos").join("ffmpeg"),
                dir.join("binaries").join("linux").join("ffmpeg"),
                dir.join("binaries").join("windows").join("ffmpeg.exe"),
                dir.join("ffmpeg"),
                dir.join("ffmpeg.exe"),
            ];
            for c in &candidates {
                if c.exists() {
                    ensure_executable(c).map_err(AppError::FfmpegNotFound)?;
                    return Ok(c.clone());
                }
                tried.push(c.clone());
                if let Some(t) = triple {
                    let suffixed = suffixed_path(c, t);
                    if suffixed.exists() {
                        ensure_executable(&suffixed).map_err(AppError::FfmpegNotFound)?;
                        return Ok(suffixed);
                    }
                    tried.push(suffixed);
                }
            }
        }

        for p in tried.iter().take(10) { emit_log(app, format!("Searched: {}", p.display())); }
        if tried.len() > 10 { emit_log(app, format!("… and {} more", tried.len() - 10)); }
        Err(AppError::FfmpegNotFound("bundled ffmpeg not found".into()))
    }
}

fn find_in_path(bin: &str) -> Option<PathBuf> {
    let mut candidates: Vec<PathBuf> = Vec::new();
    if let Some(paths) = env::var_os("PATH") {
        for entry in env::split_paths(&paths) {
            candidates.push(entry.join(bin));
            #[cfg(windows)]
            candidates.push(entry.join(format!("{bin}.exe")));
        }
    }
    #[cfg(target_os = "macos")]
    {
        candidates.push(PathBuf::from("/opt/homebrew/bin").join(bin));
        candidates.push(PathBuf::from("/usr/local/bin").join(bin));
    }
    candidates.into_iter().find(|p| p.exists())
}

fn suffixed_path(c: &Path, triple: &str) -> PathBuf {
    match c.extension() {
        Some(ext) => {
            let mut stem = c.file_stem().unwrap_or_default().to_os_string();
            stem.push(format!("-{triple}"));
            c.with_file_name(stem).with_extension(ext)
        }
        None => {
            let mut name = c.file_name().unwrap_or_default().to_os_string();
            name.push(format!("-{triple}"));
            c.with_file_name(name)
        }
    }
}
