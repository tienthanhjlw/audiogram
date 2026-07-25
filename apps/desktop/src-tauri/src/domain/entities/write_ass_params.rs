use serde::Deserialize;
use specta::Type;

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
}
