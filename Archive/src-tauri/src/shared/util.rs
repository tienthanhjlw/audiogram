use std::{fs, path::Path};
use tauri::{AppHandle, Emitter};

// ── Logging ───────────────────────────────────────────────

pub fn emit_log(app: &AppHandle, msg: impl AsRef<str>) {
    let _ = app.emit("log", msg.as_ref().to_string());
}

// ── Binary permissions ────────────────────────────────────

#[cfg(unix)]
pub fn ensure_executable(p: &Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    let meta = fs::metadata(p).map_err(|e| format!("metadata {}: {e}", p.display()))?;
    let mut perm = meta.permissions();
    let mode = perm.mode();
    if mode & 0o111 == 0 {
        perm.set_mode(mode | 0o755);
        fs::set_permissions(p, perm)
            .map_err(|e| format!("chmod {}: {e}", p.display()))?;
    }
    Ok(())
}

#[cfg(not(unix))]
pub fn ensure_executable(_p: &Path) -> Result<(), String> {
    Ok(())
}

// ── FFmpeg drawtext escaping ──────────────────────────────

/// Escape special characters for an FFmpeg `drawtext` filter value.
pub fn escape_drawtext(s: &str) -> String {
    let mut r = String::with_capacity(s.len() + 4);
    for c in s.chars() {
        match c {
            '\\' => r.push_str("\\\\"),
            '\'' => r.push_str("\\'"),
            ':' => r.push_str("\\:"),
            '[' => r.push_str("\\["),
            ']' => r.push_str("\\]"),
            _ => r.push(c),
        }
    }
    r
}

// ── Text wrapping ─────────────────────────────────────────

/// Wrap `text` into at most 2 lines of `max_chars` characters each,
/// breaking on word boundaries where possible.
pub fn wrap_text_2lines(text: &str, max_chars: usize) -> Vec<String> {
    let chars: Vec<char> = text.chars().collect();
    if chars.len() <= max_chars {
        return vec![text.to_string()];
    }
    let mut split = max_chars.min(chars.len());
    while split > 0 && chars[split - 1] != ' ' {
        split -= 1;
    }
    if split == 0 {
        split = max_chars.min(chars.len());
    }
    let line1 = chars[..split].iter().collect::<String>().trim().to_string();
    let line2 = chars[split..].iter().collect::<String>().trim().to_string();
    if line2.is_empty() { vec![line1] } else { vec![line1, line2] }
}

/// Wrap a subtitle line to at most 2 lines (42 chars each) for SRT output.
pub fn wrap_srt_line(text: &str) -> String {
    wrap_text_2lines(text, 42).join("\n")
}

// ── Time formatting ───────────────────────────────────────

/// Format seconds as `H:MM:SS.cc` for ASS subtitles.
pub fn format_ass_time(secs: f64) -> String {
    let h = (secs / 3600.0) as u64;
    let m = ((secs % 3600.0) / 60.0) as u64;
    let s = (secs % 60.0) as u64;
    let cs = ((secs % 1.0) * 100.0) as u64;
    format!("{h}:{m:02}:{s:02}.{cs:02}")
}

/// Format seconds as `HH:MM:SS,mmm` for SRT subtitles.
pub fn format_srt_time(secs: f64) -> String {
    let h = (secs / 3600.0) as u64;
    let m = ((secs % 3600.0) / 60.0) as u64;
    let s = (secs % 60.0) as u64;
    let ms = ((secs % 1.0) * 1000.0) as u64;
    format!("{h:02}:{m:02}:{s:02},{ms:03}")
}

// ── Color ─────────────────────────────────────────────────

/// Parse a `#RRGGBB` hex string into `[r, g, b]` bytes.
pub fn hex_to_rgb(hex: &str) -> [u8; 3] {
    let h = hex.trim().trim_start_matches('#');
    let n = u32::from_str_radix(h, 16).unwrap_or(0);
    [
        ((n >> 16) & 0xFF) as u8,
        ((n >> 8) & 0xFF) as u8,
        (n & 0xFF) as u8,
    ]
}
