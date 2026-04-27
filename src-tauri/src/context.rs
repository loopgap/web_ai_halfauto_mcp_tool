//! Application context abstraction - supports both Tauri and standalone modes

use std::path::PathBuf;
#[cfg(feature = "tauri")]
use tauri::Manager;

/// Unified application context - replaces AppHandle dependency
pub trait AppContext: Send + Sync {
    fn config_base(&self) -> PathBuf;
    fn audit_dir(&self) -> PathBuf;
}

/// Context implementation for Tauri mode
#[cfg(feature = "tauri")]
pub struct TauriContext {
    app_handle: tauri::AppHandle,
}

#[cfg(feature = "tauri")]
impl TauriContext {
    pub fn new(app_handle: tauri::AppHandle) -> Self {
        Self { app_handle }
    }
}

#[cfg(feature = "tauri")]
impl AppContext for TauriContext {
    fn config_base(&self) -> PathBuf {
        self.app_handle.path().app_config_dir().unwrap_or_else(|_| PathBuf::from("."))
    }

    fn audit_dir(&self) -> PathBuf {
        self.config_base().join("audit")
    }
}



