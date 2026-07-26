pub mod util;

// AppError moved to crates/audiogram-core/src/error.rs (T15) — re-exported
// here so every existing `crate::shared::AppError` call site keeps resolving.
pub use audiogram_core::AppError;
