//! Audiogram — Tauri backend root.
//!
//! Layer layout (Pragmatic Clean Architecture):
//!   shared         — AppError, utility helpers
//!   domain         — entities (RenderJob, Segment, ModelSpec) — no I/O
//!   infrastructure — FFmpeg, whisper-cpp, spectrum, subtitle adapters
//!   application    — use-case services (RenderService, TranscribeService, ModelService)
//!   presentation   — thin Tauri command wrappers

pub mod application;
pub mod domain;
pub mod infrastructure;
pub mod presentation;
pub mod shared;

use std::process::Command;
use tauri::{AppHandle, Emitter};
use tauri::menu::{Menu, MenuItem};

use application::model::ModelService;
use infrastructure::ffmpeg::resolver::FfmpegResolver;
use presentation::commands::{
    audio::analyze_spectrum,
    transcript::{download_model, list_models, transcribe_audio, write_ass, write_srt},
    video::{render_audiogram, resolve_ffmpeg_path},
};

// ── Utility commands ──────────────────────────────────────────────────────────

#[tauri::command]
fn ping(name: String) -> String {
    format!("pong {name}!")
}

#[tauri::command]
fn open_folder(path: String) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    {
        Command::new("open").arg(&path).spawn().map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer.exe").arg(&path).spawn().map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open").arg(&path).spawn().map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[allow(unreachable_code)]
    Err("unsupported platform".into())
}

// ── Application entry point ───────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .menu(|app| {
            let menu = Menu::new(app)?;
            let item = MenuItem::with_id(
                app,
                "show_ffmpeg",
                "Show FFmpeg Path",
                true,
                Option::<&str>::None,
            )?;
            menu.append(&item)?;
            Ok(menu)
        })
        .on_menu_event(|app: &AppHandle, event| {
            if event.id().as_ref() == "show_ffmpeg" {
                match FfmpegResolver::locate(app) {
                    Ok(p)  => { let _ = app.emit("log", format!("FFmpeg path: {}", p.display())); }
                    Err(e) => { let _ = app.emit("log", format!("FFmpeg resolve error: {e}")); }
                }
            }
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            ping,
            open_folder,
            render_audiogram,
            resolve_ffmpeg_path,
            analyze_spectrum,
            transcribe_audio,
            write_srt,
            write_ass,
            list_models,
            download_model,
        ])
        .setup(|app| {
            ModelService::seed_bundled(app.handle());
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
