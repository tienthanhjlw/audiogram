use serde::Deserialize;
use specta::Type;
use crate::{contract_gen::{default_zones, LayoutZones}, util::hex_to_rgb, AppError};
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
    /// Absolute path to the avatar/background image picked in StepLayout —
    /// mirrors WaveformCanvas.tsx's `coverImagePath`. `None`/empty means no
    /// image was chosen; the renderer falls back to its placeholder gradient.
    pub cover_image_path: Option<String>,
    /// Zone override from the Design mode canvas stage (store.zones) — mirrors
    /// the preview's `zones ?? DEFAULT_ZONES[layoutTemplate]` fallback exactly
    /// (PHASE3_TASKS.md T2, fixes the frame renderer previously never reading
    /// zones at all). `None` means the user hasn't dragged anything — RenderJob
    /// falls back to `default_zones(layout)`, the same contract-generated data
    /// the preview's DEFAULT_ZONES comes from.
    pub zones: Option<LayoutZones>,
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
    pub cover_image_path: Option<String>,
    pub zones: LayoutZones,
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
        let layout_str = dto.layout_template.as_deref().unwrap_or("minimal");
        let layout = layout_str.try_into()?;
        // `layout_str` just parsed successfully into a Layout above, so it's
        // one of default_zones()'s known template keys — always Some here.
        let zones = dto.zones.unwrap_or_else(|| {
            default_zones(layout_str).expect("layout_str already validated by Layout::try_from")
        });

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
            cover_image_path: dto.cover_image_path.filter(|p| !p.is_empty()),
            zones,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn minimal_dto(layout_template: Option<&str>, zones: Option<LayoutZones>) -> RenderJobDto {
        RenderJobDto {
            audio_path: "/tmp/audio.mp3".into(),
            peaks: vec![0.5],
            bg_color: "#111827".into(),
            captions_path: None,
            width: 1080,
            height: 1080,
            fps: 30,
            wave_color: "#FFFFFF".into(),
            wave_style: "bar".into(),
            intro_title: None,
            font_size: None,
            font_name: None,
            layout_template: layout_template.map(String::from),
            output_path: "/tmp/out.mp4".into(),
            cover_image_path: None,
            zones,
        }
    }

    /// PHASE3_TASKS.md T2 step 6 — a RenderJobDto with `zones: None` (no
    /// Design mode zone edits) must resolve to the same LayoutZones the
    /// preview's `zones ?? DEFAULT_ZONES[layoutTemplate]` fallback would
    /// pick, for every layout.
    #[test]
    fn render_job_falls_back_to_default_zones() {
        for layout in ["spotify", "split", "minimal", "fullbg", "karaoke", "brand"] {
            let dto = minimal_dto(Some(layout), None);
            let job = RenderJob::try_from(dto).expect("valid dto");
            assert_eq!(job.zones, default_zones(layout).unwrap(), "layout: {layout}");
        }
    }

    /// A DTO that *does* carry zones (the user dragged something in the
    /// canvas stage) must use that override verbatim, not silently fall
    /// back to defaults.
    #[test]
    fn render_job_uses_dto_zones_when_present() {
        let mut custom = default_zones("minimal").unwrap();
        custom.waveform.y = 0.05;
        let dto = minimal_dto(Some("minimal"), Some(custom));
        let job = RenderJob::try_from(dto).expect("valid dto");
        assert_eq!(job.zones, custom);
        assert_ne!(job.zones, default_zones("minimal").unwrap());
    }
}
