use serde::Deserialize;
use crate::shared::{util::hex_to_rgb, AppError};

/// Raw DTO from Tauri IPC — mirrors the JS object sent by the frontend verbatim.
/// Field names use snake_case to match Tauri's default serde convention.
#[derive(Deserialize, Debug)]
pub struct RenderJobDto {
    pub audio_path: String,
    pub peaks: Vec<f32>,
    pub bg_color: String,
    pub captions_path: Option<String>,
    pub width: u32,
    pub height: u32,
    pub fps: u32,
    pub wave_color: String,
    pub wave_style: String,
    pub intro_title: Option<String>,
    pub font_size: Option<u32>,
    pub font_name: Option<String>,
    pub layout_template: Option<String>,
    pub output_path: String,
}

/// Validated domain entity — hex colors are parsed, defaults applied.
/// The infrastructure layer receives this instead of raw strings.
#[derive(Debug)]
pub struct RenderJob {
    pub audio_path: String,
    pub peaks: Vec<f32>,
    pub bg_color: [u8; 3],
    pub wave_color: [u8; 3],
    pub wave_style: String,
    pub captions_path: Option<String>,
    pub width: u32,
    pub height: u32,
    pub fps: u32,
    pub title: Option<String>,
    pub font_size_pct: u32,
    pub font_name: String,
    pub layout: String,
    pub output_path: String,
}

impl TryFrom<RenderJobDto> for RenderJob {
    type Error = AppError;

    fn try_from(dto: RenderJobDto) -> Result<Self, Self::Error> {
        if dto.audio_path.is_empty() {
            return Err(AppError::Encode("audio_path is empty".into()));
        }
        if dto.peaks.is_empty() {
            return Err(AppError::Encode(
                "No waveform peaks — audio may not have loaded in the preview".into(),
            ));
        }
        Ok(Self {
            bg_color:      hex_to_rgb(&dto.bg_color),
            wave_color:    hex_to_rgb(&dto.wave_color),
            audio_path:    dto.audio_path,
            peaks:         dto.peaks,
            wave_style:    dto.wave_style,
            captions_path: dto.captions_path,
            width:         dto.width,
            height:        dto.height,
            fps:           dto.fps,
            title:         dto.intro_title,
            font_size_pct: dto.font_size.unwrap_or(100),
            font_name:     dto.font_name.unwrap_or_else(|| "Arial".into()),
            layout:        dto.layout_template.unwrap_or_else(|| "minimal".into()),
            output_path:   dto.output_path,
        })
    }
}
