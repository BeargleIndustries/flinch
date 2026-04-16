//! Top-level application error type for Tauri commands.
//!
//! Separate from `bootstrap::BootstrapError` which is scoped to the runtime
//! installer. This enum covers the cross-cutting failure modes the frontend
//! can distinguish when driving the main app surface.

use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, Serialize)]
#[serde(tag = "kind", content = "detail")]
pub enum AppError {
    #[error("io: {0}")]
    Io(String),

    #[error("bootstrap: {0}")]
    Bootstrap(String),

    #[error("sidecar: {0}")]
    Sidecar(String),

    #[error("json: {0}")]
    Json(String),

    #[error("api key: {0}")]
    ApiKey(String),

    #[error("internal: {0}")]
    Internal(String),
}

impl From<std::io::Error> for AppError {
    fn from(e: std::io::Error) -> Self {
        AppError::Io(format!("{e:#}"))
    }
}

impl From<serde_json::Error> for AppError {
    fn from(e: serde_json::Error) -> Self {
        AppError::Json(format!("{e:#}"))
    }
}
