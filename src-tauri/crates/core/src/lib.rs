use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime, UNIX_EPOCH};
use thiserror::Error;

static TRACE_COUNTER: AtomicU64 = AtomicU64::new(1);

pub fn now_ms() -> u128 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::from_secs(0))
        .as_millis()
}

pub fn new_trace_id() -> String {
    let seq = TRACE_COUNTER.fetch_add(1, Ordering::Relaxed);
    format!("t{}-{}", now_ms(), seq)
}

#[derive(Debug, Clone, Serialize, Deserialize, Error)]
#[error("[{code}] {message}")]
pub struct ApiError {
    pub code: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<String>,
    pub trace_id: String,
}

pub type CmdResult<T> = Result<T, ApiError>;

pub fn err(code: &str, message: &str, details: Option<String>) -> ApiError {
    ApiError {
        code: code.to_string(),
        message: message.to_string(),
        details,
        trace_id: new_trace_id(),
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditEvent<'a> {
    pub ts_ms: u128,
    pub action: &'a str,
    pub outcome: &'a str,
    pub trace_id: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub detail: Option<&'a str>,
}
