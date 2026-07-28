use serde::Deserialize;
use specta::Type;
use crate::{contract_gen::{default_zones, LayoutZones}, util::hex_to_rgb, AppError};
use super::{Layout, SceneNode, TitleAlign, WaveStyle};

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
    /// Title text style — mirrors the store's `titleColor`/`titleAlign`/
    /// `titleBold`/`titleItalic` (PHASE3_TASKS.md T4, fixes the title
    /// inspector's controls being a no-op at export: the old ffmpeg
    /// `drawtext` path hardcoded white text, fixed per-layout centering,
    /// never bold/italic). `None` for each means the store's own default
    /// (white / center / not bold / not italic).
    pub title_color: Option<String>,
    pub title_align: Option<String>,
    pub title_bold: Option<bool>,
    pub title_italic: Option<bool>,
    /// Scene graph nodes (Phase 5 T5) — when present, the render pipeline
    /// draws via `audiogram_render::scene_frame::render_scene_frame_into`
    /// instead of the legacy `render_frame_into` layout match-arms. `None`
    /// (the default — no frontend caller sets this yet outside the
    /// `VITE_USE_NODE_RENDERER` flag) keeps the legacy export path
    /// byte-identical to before this field existed (PHASE5_TASKS.md §A.6 —
    /// this is the fix for the historical "zones never reached export" bug).
    pub nodes: Option<Vec<SceneNode>>,
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
    pub title_color: [u8; 3],
    pub title_align: TitleAlign,
    pub title_bold: bool,
    pub title_italic: bool,
    pub nodes: Option<Vec<SceneNode>>,
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
        let title_align = dto.title_align
            .as_deref()
            .map(TitleAlign::try_from)
            .transpose()?
            .unwrap_or_default();

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
            title_color: dto.title_color.as_deref().map(hex_to_rgb).unwrap_or([255, 255, 255]),
            title_align,
            title_bold: dto.title_bold.unwrap_or(false),
            title_italic: dto.title_italic.unwrap_or(false),
            nodes: dto.nodes,
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
            title_color: None,
            title_align: None,
            title_bold: None,
            title_italic: None,
            nodes: None,
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

    /// PHASE3_TASKS.md T4 — title_color/align/bold/italic default to the
    /// same values design.slice.ts's store does (white/center/false/false)
    /// when the DTO carries none, matching a project that never touched
    /// the Title inspector.
    #[test]
    fn title_style_defaults_match_the_store() {
        let dto = minimal_dto(Some("minimal"), None);
        let job = RenderJob::try_from(dto).expect("valid dto");
        assert_eq!(job.title_color, [255, 255, 255]);
        assert_eq!(job.title_align, TitleAlign::Center);
        assert!(!job.title_bold);
        assert!(!job.title_italic);
    }

    /// A DTO that does carry title style must use it verbatim — this is the
    /// actual bug T4 fixes: previously nothing in RenderJob carried these at
    /// all, so the Design mode Title inspector's controls were a no-op at
    /// export time.
    #[test]
    fn title_style_uses_dto_values_when_present() {
        let mut dto = minimal_dto(Some("minimal"), None);
        dto.title_color = Some("#FF0000".into());
        dto.title_align = Some("right".into());
        dto.title_bold = Some(true);
        dto.title_italic = Some(true);
        let job = RenderJob::try_from(dto).expect("valid dto");
        assert_eq!(job.title_color, [255, 0, 0]);
        assert_eq!(job.title_align, TitleAlign::Right);
        assert!(job.title_bold);
        assert!(job.title_italic);
    }

    #[test]
    fn rejects_an_invalid_title_align() {
        let mut dto = minimal_dto(Some("minimal"), None);
        dto.title_align = Some("diagonal".into());
        assert!(RenderJob::try_from(dto).is_err());
    }

    /// PHASE5_TASKS.md T5 step 5 — `render_job_accepts_nodes`: a DTO with
    /// `nodes: Some(..)` resolves to `RenderJob.nodes: Some(..)` verbatim;
    /// a DTO without it resolves to `None` (legacy export path, unchanged).
    #[test]
    fn render_job_accepts_nodes() {
        use super::super::scene_node::{SceneNodeProps, SceneNodeType, Transform, WaveformProps};

        let mut dto = minimal_dto(Some("minimal"), None);
        let node = SceneNode {
            id: "w1".into(),
            r#type: SceneNodeType::Waveform,
            parent_id: None,
            transform: Transform::identity(),
            z: 0,
            timing: None,
            anim_in: None,
            anim_out: None,
            keyframes: vec![],
            props: Some(SceneNodeProps::Waveform(WaveformProps { style: "bar".into(), color: "#FFFFFF".into() })),
        };
        dto.nodes = Some(vec![node]);
        let job = RenderJob::try_from(dto).expect("valid dto");
        assert_eq!(job.nodes.as_ref().map(|n| n.len()), Some(1));
    }

    #[test]
    fn render_job_nodes_defaults_to_none() {
        let dto = minimal_dto(Some("minimal"), None);
        let job = RenderJob::try_from(dto).expect("valid dto");
        assert!(job.nodes.is_none());
    }
}
