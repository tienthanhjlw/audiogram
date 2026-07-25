use serde::{Deserialize, Serialize};
use specta::Type;

#[derive(Debug, Clone, Serialize, Deserialize, Type)]
pub struct Segment {
    // u32 (not usize): specta's TS exporter forbids pointer-width ints
    // (potentially 64-bit) since JS `number` can't represent those exactly.
    // A transcript never has anywhere near u32::MAX segments.
    pub id: u32,
    pub start: f64,
    pub end: f64,
    pub text: String,
}
