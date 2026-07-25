/// Subtitle-specific formatting helpers (ASS + SRT time codes, text wrapping).

/// Format seconds as `H:MM:SS.cc` for ASS subtitle timestamps.
pub fn format_ass_time(secs: f64) -> String {
    let h  = (secs / 3600.0) as u64;
    let m  = ((secs % 3600.0) / 60.0) as u64;
    let s  = (secs % 60.0) as u64;
    let cs = ((secs % 1.0) * 100.0) as u64;
    format!("{h}:{m:02}:{s:02}.{cs:02}")
}

/// Format seconds as `HH:MM:SS,mmm` for SRT subtitle timestamps.
pub fn format_srt_time(secs: f64) -> String {
    let h  = (secs / 3600.0) as u64;
    let m  = ((secs % 3600.0) / 60.0) as u64;
    let s  = (secs % 60.0) as u64;
    let ms = ((secs % 1.0) * 1000.0) as u64;
    format!("{h:02}:{m:02}:{s:02},{ms:03}")
}

/// Wrap a subtitle line to at most 2 × 42-character lines for SRT output.
pub fn wrap_srt_line(text: &str) -> String {
    let chars: Vec<char> = text.chars().collect();
    const MAX: usize = 42;
    if chars.len() <= MAX {
        return text.to_string();
    }
    let mut split = MAX.min(chars.len());
    while split > 0 && chars[split - 1] != ' ' { split -= 1; }
    if split == 0 { split = MAX.min(chars.len()); }
    let line1 = chars[..split].iter().collect::<String>().trim().to_string();
    let line2 = chars[split..].iter().collect::<String>().trim().to_string();
    if line2.is_empty() { line1 } else { format!("{line1}\n{line2}") }
}
