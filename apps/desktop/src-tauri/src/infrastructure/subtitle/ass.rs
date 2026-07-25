use std::{fs, path::PathBuf};
use crate::{
    domain::entities::Segment,
    shared::{util::hex_to_rgb, AppError},
};
use super::util::format_ass_time;
use super::srt::subtitle_dir;

pub struct AssWriter;

impl AssWriter {
    /// Write an ASS subtitle file for plain or karaoke mode; return the path.
    ///
    /// Positions and font sizes are derived from the same constants as `WaveformCanvas.tsx`
    /// so the video output matches the canvas preview as closely as possible.
    #[allow(clippy::too_many_arguments)]
    pub fn write(
        segments: &[Segment],
        highlight_color: &str,
        video_width: Option<u32>,
        video_height: Option<u32>,
        font_size_pct: Option<u32>,
        layout_template: Option<&str>,
        karaoke_enabled: Option<bool>,
        font_name: Option<&str>,
        subtitle_y_pct: Option<f64>,
        subtitle_color: Option<&str>,
    ) -> Result<PathBuf, AppError> {
        let tmp = subtitle_dir().join("subtitles.ass");
        fs::create_dir_all(tmp.parent().unwrap())?;

        let w       = video_width.unwrap_or(1080) as f64;
        let h       = video_height.unwrap_or(1080) as f64;
        let scale   = font_size_pct.unwrap_or(100) as f64 / 100.0;
        let layout  = layout_template.unwrap_or("minimal");
        let karaoke = karaoke_enabled.unwrap_or(false);
        let font    = font_name.unwrap_or("Arial");

        // Convert #RRGGBB → ASS &H00BBGGRR (little-endian BGR)
        let rgb = hex_to_rgb(highlight_color);
        let hi_color = format!("&H00{:02X}{:02X}{:02X}", rgb[2], rgb[1], rgb[0]);

        let sub_rgb = subtitle_color
            .map(hex_to_rgb)
            .unwrap_or([0xFF, 0xFF, 0xFF]);
        let sub_color_ass = format!("&H00{:02X}{:02X}{:02X}", sub_rgb[2], sub_rgb[1], sub_rgb[0]);

        let primary   = if karaoke { hi_color.clone() } else { sub_color_ass };
        let secondary = if karaoke { "&HB3FFFFFF".to_string() } else { primary.clone() };

        let mut out = String::new();
        out.push_str(&format!(
            "[Script Info]\nScriptType: v4.00+\nWrapStyle: 0\nScaledBorderAndShadow: yes\nPlayResX: {}\nPlayResY: {}\n\n",
            w as u32, h as u32
        ));
        out.push_str("[V4+ Styles]\n");
        out.push_str("Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n");

        let (style_line, dial_ml, dial_mr) = ass_style(
            font, &primary, &secondary, w, h, scale, layout, subtitle_y_pct
        );
        out.push_str(&style_line);
        out.push_str("\n\n");

        out.push_str("[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n");

        for seg in segments {
            let words: Vec<&str> = seg.text.split_whitespace().collect();
            if words.is_empty() { continue; }

            let body = if karaoke {
                let seg_dur     = (seg.end - seg.start).max(0.1);
                let total_chars = words.iter().map(|w| w.len()).sum::<usize>().max(1);
                words.iter()
                    .map(|w| {
                        let ratio  = w.len() as f64 / total_chars as f64;
                        let dur_cs = ((seg_dur * ratio * 100.0).round() as u32).max(5);
                        format!("{{\\kf{dur_cs}}}{w} ")
                    })
                    .collect::<String>()
                    .trim_end()
                    .to_string()
            } else {
                words.join(" ")
            };

            let text = format!("{{\\fad(120,120)}}{body}");

            out.push_str(&format!(
                "Dialogue: 0,{},{},Default,,{dial_ml},{dial_mr},0,,{text}\n",
                format_ass_time(seg.start),
                format_ass_time(seg.end),
            ));
        }

        fs::write(&tmp, out)
            .map_err(|e| AppError::Subtitle(format!("write ass: {e}")))?;
        Ok(tmp)
    }
}

// ── Internals ─────────────────────────────────────────────────────────────────

/// Build the ASS [V4+ Styles] line and per-event margin overrides for a given layout.
///
/// MarginV is derived from each layout's `boxY` in WaveformCanvas.tsx:
///   `margin_v = H * (1 - box_y_ratio) - box_h`
/// where `box_h ≈ sub_fs * 1.4` (libass BorderStyle=3 line height estimate).
///
/// Returns `(style_line, dial_margin_l, dial_margin_r)`.
pub fn ass_style(
    font: &str,
    primary: &str,
    secondary: &str,
    w: f64,
    h: f64,
    scale: f64,
    layout: &str,
    subtitle_y_pct: Option<f64>,
) -> (String, u32, u32) {
    let sub_fs  = (h * 0.046 * scale).round();
    let box_h   = sub_fs * 1.4;
    let mv = |default_box_y_ratio: f64| -> u32 {
        let ratio = subtitle_y_pct.unwrap_or(default_box_y_ratio);
        ((h * (1.0 - ratio) - box_h).max(0.0)).round() as u32
    };

    let box_style = |fs: u32, align: u32, margin_v: u32| -> String {
        format!(
            "Style: Default,{font},{fs},{primary},{secondary},&H00000000,&H66000000,1,0,0,0,100,100,0,0,3,0,1,{align},10,10,{margin_v},1\n"
        )
    };

    match layout {
        "karaoke" => {
            let fs = (h * 0.085 * scale).round() as u32;
            let line = format!(
                "Style: Default,{font},{fs},{primary},{secondary},&H00000000,&H66000000,1,0,0,0,100,100,0,0,3,0,1,5,10,10,0,1\n"
            );
            (line, 0, 0)
        }
        "split" => {
            let fs  = (h * 0.036 * scale).round() as u32;
            let mv  = (h * 0.20).round() as u32;
            let ml  = (w * 0.55) as u32;
            let mr  = (w * 0.04) as u32;
            let line = format!(
                "Style: Default,{font},{fs},&H00FFFFFF,&H00FFFFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,{ml},{mr},{mv},1\n"
            );
            (line, ml, mr)
        }
        "spotify" => (box_style(sub_fs as u32, 2, mv(0.85)), 0, 0),
        "fullbg"  => (box_style(sub_fs as u32, 2, mv(0.83)), 0, 0),
        _         => (box_style(sub_fs as u32, 2, mv(0.74)), 0, 0),
    }
}
