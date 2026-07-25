use serde::Serialize;
use specta::Type;

/// Static catalogue of known Whisper models — lives in the domain because
/// these are business rules (model names, sizes, quality descriptions).
pub const MODELS: &[ModelSpec] = &[
    ModelSpec { name: "tiny",     label: "Tiny",     size_mb: 75,   note: "Nhanh nhất, độ chính xác thấp" },
    ModelSpec { name: "base",     label: "Base",     size_mb: 142,  note: "Nhanh, độ chính xác tốt" },
    ModelSpec { name: "small",    label: "Small",    size_mb: 465,  note: "Cân bằng tốc độ / chất lượng" },
    ModelSpec { name: "medium",   label: "Medium",   size_mb: 1533, note: "Chính xác cao" },
    ModelSpec { name: "large-v3", label: "Large v3", size_mb: 3094, note: "Tốt nhất, hỗ trợ mọi ngôn ngữ" },
];

/// Immutable description of a Whisper model variant.
#[derive(Debug, Clone, Copy)]
pub struct ModelSpec {
    pub name: &'static str,
    pub label: &'static str,
    // u32 (not u64): specta's TS exporter rejects 64-bit ints by default since
    // JS `number` can't represent them precisely. Model sizes-in-MB never get
    // remotely close to u32::MAX (~4.29 billion), so no real range is lost.
    pub size_mb: u32,
    pub note: &'static str,
}

/// Runtime representation including whether the model is downloaded — sent to the frontend.
#[derive(Debug, Clone, Serialize, Type)]
pub struct ModelInfo {
    pub name: String,
    pub label: String,
    pub size_mb: u32,
    pub note: String,
    pub downloaded: bool,
}
