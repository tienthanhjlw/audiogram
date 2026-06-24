/// FFmpeg filter-graph text helpers (only used inside this infrastructure module).

/// Escape special characters for an FFmpeg `drawtext` filter value.
pub fn escape_drawtext(s: &str) -> String {
    let mut r = String::with_capacity(s.len() + 4);
    for c in s.chars() {
        match c {
            '\\' => r.push_str("\\\\"),
            '\'' => r.push_str("\\'"),
            ':'  => r.push_str("\\:"),
            '['  => r.push_str("\\["),
            ']'  => r.push_str("\\]"),
            _    => r.push(c),
        }
    }
    r
}

/// Wrap `text` into at most 2 lines of `max_chars` characters, breaking on words.
pub fn wrap_text_2lines(text: &str, max_chars: usize) -> Vec<String> {
    let chars: Vec<char> = text.chars().collect();
    if chars.len() <= max_chars {
        return vec![text.to_string()];
    }
    let mut split = max_chars.min(chars.len());
    while split > 0 && chars[split - 1] != ' ' { split -= 1; }
    if split == 0 { split = max_chars.min(chars.len()); }
    let line1 = chars[..split].iter().collect::<String>().trim().to_string();
    let line2 = chars[split..].iter().collect::<String>().trim().to_string();
    if line2.is_empty() { vec![line1] } else { vec![line1, line2] }
}
