use serde::Deserialize;
use specta::Type;
use crate::contract_gen::LayoutZones;

#[derive(Debug, Deserialize, Type)]
#[serde(rename_all = "camelCase")]
pub struct WriteAssParams {
    pub highlight_color:   String,
    pub video_width:       Option<u32>,
    pub video_height:      Option<u32>,
    pub font_size_pct:     Option<u32>,
    pub layout_template:   Option<String>,
    pub karaoke_enabled:   Option<bool>,
    pub font_name:         Option<String>,
    pub subtitle_y_pct:    Option<f64>,
    pub subtitle_color:    Option<String>,
    /// Layout zones for subtitle positioning — passed from export sheet
    /// (Phase 4 T2). When present, `zones.subtitle.y` is used for MarginV
    /// in ASS style (instead of hard-coded per-layout fallback).
    pub zones:             Option<LayoutZones>,
}
