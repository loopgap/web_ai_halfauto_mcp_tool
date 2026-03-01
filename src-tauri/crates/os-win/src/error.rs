use thiserror::Error;

#[derive(Debug, Error)]
pub enum OsWinError {
    #[error("No window matched the criteria")]
    WindowNotFound,

    #[error("Matched window exists but cannot be activated (foreground lock?)")]
    ActivateFailed,

    #[error("Clipboard operation failed: {0}")]
    ClipboardFailed(String),

    #[error("Input simulation failed: {0}")]
    InputFailed(String),

    #[error("Windows API error: {0}")]
    WinApiFailed(String),

    #[error("Timeout after {0}ms")]
    Timeout(u64),

    #[error("Invalid argument: {0}")]
    InvalidArg(String),
}

pub type OsWinResult<T> = Result<T, OsWinError>;
