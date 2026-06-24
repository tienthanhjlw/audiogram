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
