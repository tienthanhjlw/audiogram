//! Pure domain layer — entities, the app-wide error type, and format-agnostic
//! utility functions with zero Tauri dependency (PACKAGE_SPLIT_PLAN.md §3.1).
//! Every other crate/the app crate sits on top of this one.
pub mod entities;
pub mod error;
pub mod util;

pub use error::AppError;
