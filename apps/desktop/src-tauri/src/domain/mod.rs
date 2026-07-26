pub mod entities;

// Moved to crates/audiogram-core/src/contract_gen.rs (T16 — audiogram-render
// and audiogram-subtitle both need these constants and can't depend on the
// app crate). Re-exported as a module here so existing
// `crate::domain::contract_gen::X` call sites keep resolving; the app crate
// no longer references this itself (frame.rs moved into audiogram-render).
pub use audiogram_core::contract_gen;
