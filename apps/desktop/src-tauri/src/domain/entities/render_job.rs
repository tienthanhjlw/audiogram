use serde::Deserialize;
use specta::Type;
use crate::shared::{util::hex_to_rgb, AppError};
use super::{Layout, WaveStyle};

/// Raw DTO from Tauri IPC — mirrors the JS object sent by the frontend verbatim.
#[derive(Deserialize, Debug, Type)]
pub struct RenderJobDto {
    pub audio_path:      String,
    pub peaks:           Vec<f32>,
    pub bg_color:        String,
    pub captions_path:   Option<String>,
    pub width:           u32,
    pub height:          u32,
    pub fps:             u32,
    pub wave_color:      String,
    pub wave_style:      String,
    pub intro_title:     Option<String>,
    pub font_size:       Option<u32>,
    pub font_name:       Option<String>,
    pub layout_template: Option<String>,
    pub output_path:     String,
}

/// Validated domain entity — strings parsed to enums, hex colors decoded, defaults applied.
/// The infrastructure layer receives this; invalid inputs are rejected at the boundary.
#[derive(Debug)]
pub struct RenderJob {
    pub audio_path:    String,
    pub peaks:         Vec<f32>,
    pub bg_color:      [u8; 3],
    pub wave_color:    [u8; 3],
    pub wave_style:    WaveStyle,
    pub captions_path: Option<String>,
    pub width:         u32,
    pub height:        u32,
    pub fps:           u32,
    pub title:         Option<String>,
    pub font_size_pct: u32,
    pub font_name:     String,
    pub layout:        Layout,
    pub output_path:   String,
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
        let wave_style = WaveStyle::try_from(dto.wave_style.as_str())?;
        let layout = dto.layout_template
            .as_deref()
            .unwrap_or("minimal")
            .try_into()?;

        Ok(Self {
            bg_color:      hex_to_rgb(&dto.bg_color),
            wave_color:    hex_to_rgb(&dto.wave_color),
            audio_path:    dto.audio_path,
            peaks:         dto.peaks,
            wave_style,
            captions_path: dto.captions_path,
            width:         dto.width,
            height:        dto.height,
            fps:           dto.fps,
            title:         dto.intro_title,
            font_size_pct: dto.font_size.unwrap_or(100),
            font_name:     dto.font_name.unwrap_or_else(|| "Arial".into()),
            layout,
            output_path:   dto.output_path,
        })
    }
}
