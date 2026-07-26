use std::{fs, path::Path};
use tauri::{AppHandle, Emitter};

// hex_to_rgb moved to crates/audiogram-core/src/util.rs (T15) — re-exported
// here so every existing `crate::shared::util::hex_to_rgb` call site keeps
// resolving. emit_log/ensure_executable stay here: both are Tauri/OS-coupled
// (AppHandle, file permissions), not pure.
pub use audiogram_core::util::hex_to_rgb;

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
