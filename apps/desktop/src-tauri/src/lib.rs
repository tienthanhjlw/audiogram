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

use tauri::{AppHandle, Emitter};
use tauri::menu::{Menu, MenuItem};

use application::model::ModelService;
use infrastructure::ffmpeg::resolver::FfmpegResolver;
use presentation::commands::{
    audio::analyze_spectrum,
    transcript::{download_model, list_models, transcribe_audio, write_ass, write_srt},
    utils::{open_folder, ping},
    video::{render_audiogram, resolve_ffmpeg_path},
};

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
