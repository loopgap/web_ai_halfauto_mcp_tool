pub mod clipboard;
pub mod error;
pub mod input;
pub mod window;

use error::{OsWinError, OsWinResult};
use input::PasteOptions;
use std::time::{Duration, Instant};

/// One-stop dispatch: activate window → set clipboard → Ctrl+V → optional Enter.
#[derive(Debug, Clone)]
pub struct DispatchRequest {
    pub hwnd: u64,
    pub text: String,
    pub opts: PasteOptions,
    pub activate_retry: u32,
    pub activate_settle_delay_ms: u64,
}

/// Execute the full paste dispatch sequence.
pub fn dispatch_paste(req: DispatchRequest) -> OsWinResult<()> {
    // Step 1: Activate
    window::activate_window(req.hwnd, req.activate_retry, req.activate_settle_delay_ms)?;

    // Step 2: Set clipboard
    clipboard::clipboard_set_text(&req.text)?;

    // Step 3: Ctrl+V
    input::send_ctrl_v(&req.opts)?;

    // Step 4: Optional Enter
    if req.opts.auto_enter {
        input::send_enter(&req.opts)?;
    }

    Ok(())
}

/// Two-phase dispatch: Stage only (paste without enter) — §9.4.
pub fn dispatch_stage(req: DispatchRequest) -> OsWinResult<()> {
    // Step 1: Activate
    window::activate_window(req.hwnd, req.activate_retry, req.activate_settle_delay_ms)?;

    // Step 2: Set clipboard
    clipboard::clipboard_set_text(&req.text)?;

    // Step 3: Ctrl+V (never enter)
    let mut stage_opts = req.opts;
    stage_opts.auto_enter = false;
    input::send_ctrl_v(&stage_opts)?;

    Ok(())
}

/// Two-phase dispatch: Confirm (send Enter on focused window) — §9.4.
pub fn dispatch_confirm(opts: &PasteOptions) -> OsWinResult<()> {
    input::send_enter(opts)
}

/// Clipboard transaction: backup → execute action → restore (§9.6).
pub fn clipboard_transaction<F, T>(action: F, restore: bool) -> OsWinResult<T>
where
    F: FnOnce() -> OsWinResult<T>,
{
    // Backup current clipboard
    let backup = clipboard::clipboard_get_text().ok();

    let result = action();

    // Restore if configured
    if restore {
        if let Some(old_text) = backup {
            // Small delay to let the paste complete
            std::thread::sleep(Duration::from_millis(200));
            let _ = clipboard::clipboard_set_text(&old_text);
        }
    }

    result
}

/// Generic retry with timeout utility.
pub fn retry_with_timeout<F, T>(timeout_ms: u64, interval_ms: u64, mut f: F) -> OsWinResult<T>
where
    F: FnMut() -> OsWinResult<T>,
{
    let start = Instant::now();
    loop {
        match f() {
            Ok(v) => return Ok(v),
            Err(e) => {
                if start.elapsed() >= Duration::from_millis(timeout_ms) {
                    return Err(OsWinError::Timeout(timeout_ms));
                }
                match &e {
                    OsWinError::ClipboardFailed(_)
                    | OsWinError::ActivateFailed
                    | OsWinError::WinApiFailed(_) => {
                        std::thread::sleep(Duration::from_millis(interval_ms));
                    }
                    _ => return Err(e),
                }
            }
        }
    }
}
