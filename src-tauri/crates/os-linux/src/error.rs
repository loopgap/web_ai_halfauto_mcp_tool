use thiserror::Error;

#[derive(Debug, Error)]
pub enum OsLinuxError {
    #[error("No window matched the criteria")]
    WindowNotFound,

    #[error("Matched window exists but cannot be activated")]
    ActivateFailed,

    #[error("Clipboard operation failed: {0}")]
    ClipboardFailed(String),

    #[error("Input simulation failed: {0}")]
    InputFailed(String),

    #[error("Linux system utility error: {0}")]
    WinApiFailed(String),

    #[error("Timeout after {0}ms")]
    Timeout(u64),

    #[error("Invalid argument: {0}")]
    InvalidArg(String),
}

pub type OsWinError = OsLinuxError;
pub type OsLinuxResult<T> = Result<T, OsLinuxError>;
pub type OsWinResult<T> = Result<T, OsLinuxError>;
