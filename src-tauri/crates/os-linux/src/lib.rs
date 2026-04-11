pub mod clipboard;
pub mod error;
pub mod input;
pub mod window;

use error::{OsLinuxError, OsLinuxResult};
use input::PasteOptions;
use std::time::{Duration, Instant};

#[derive(Debug, Clone)]
pub struct DispatchRequest {
    pub hwnd: u64,
    pub text: String,
    pub opts: PasteOptions,
    pub activate_retry: u32,
    pub activate_settle_delay_ms: u64,
}

pub fn dispatch_paste(req: DispatchRequest) -> OsLinuxResult<()> {
    window::activate_window(req.hwnd, req.activate_retry, req.activate_settle_delay_ms)?;
    clipboard::clipboard_set_text(&req.text)?;
    input::send_ctrl_v(&req.opts)?;
    if req.opts.auto_enter {
        input::send_enter(&req.opts)?;
    }
    Ok(())
}

pub fn dispatch_stage(req: DispatchRequest) -> OsLinuxResult<()> {
    window::activate_window(req.hwnd, req.activate_retry, req.activate_settle_delay_ms)?;
    clipboard::clipboard_set_text(&req.text)?;
    let mut stage_opts = req.opts;
    stage_opts.auto_enter = false;
    input::send_ctrl_v(&stage_opts)?;
    Ok(())
}

pub fn dispatch_confirm(opts: &PasteOptions) -> OsLinuxResult<()> {
    input::send_enter(opts)
}

pub fn clipboard_transaction<F, T>(action: F, restore: bool) -> OsLinuxResult<T>
where
    F: FnOnce() -> OsLinuxResult<T>,
{
    let backup = clipboard::clipboard_get_text().ok();
    let result = action();
    if restore {
        if let Some(old_text) = backup {
            std::thread::sleep(Duration::from_millis(200));
            let _ = clipboard::clipboard_set_text(&old_text);
        }
    }
    result
}

pub fn retry_with_timeout<F, T>(timeout_ms: u64, interval_ms: u64, mut f: F) -> OsLinuxResult<T>
where
    F: FnMut() -> OsLinuxResult<T>,
{
    let start = Instant::now();
    loop {
        match f() {
            Ok(v) => return Ok(v),
            Err(e) => {
                if start.elapsed() >= Duration::from_millis(timeout_ms) {
                    return Err(OsLinuxError::Timeout(timeout_ms));
                }
                match &e {
                    OsLinuxError::ClipboardFailed(_)
                    | OsLinuxError::ActivateFailed
                    | OsLinuxError::WinApiFailed(_) => {
                        std::thread::sleep(Duration::from_millis(interval_ms));
                    }
                    _ => return Err(e),
                }
            }
        }
    }
}
