// Moved to crates/audiogram-core/src/entities/ (T15) — re-exported here so
// every existing `crate::domain::entities::X` call site across the app
// crate keeps resolving unchanged.
pub use audiogram_core::entities::{
    Layout, ModelInfo, ModelSpec, RenderEvent, RenderJob, RenderJobDto, RenderStage, Segment,
    SerializableError, WaveStyle, WriteAssParams, MODELS,
};
