use crate::error::{OsWinError, OsWinResult};

#[cfg(windows)]
use windows::Win32::{
    Foundation::{HANDLE, HGLOBAL},
    System::{
        DataExchange::{CloseClipboard, EmptyClipboard, GetClipboardData, OpenClipboard, SetClipboardData},
        Memory::{GlobalAlloc, GlobalLock, GlobalUnlock, GLOBAL_ALLOC_FLAGS},
        Ole::CF_UNICODETEXT,
    },
};

#[cfg(windows)]
pub fn clipboard_set_text(text: &str) -> OsWinResult<()> {
    let wide: Vec<u16> = text.encode_utf16().chain(std::iter::once(0u16)).collect();
    let byte_len = wide.len() * 2;

    retry_clipboard_open(800, 50)?;

    let result = (|| -> OsWinResult<()> {
        unsafe {
            EmptyClipboard()
                .map_err(|e| OsWinError::ClipboardFailed(format!("EmptyClipboard: {}", e)))?;

            let hmem = GlobalAlloc(GLOBAL_ALLOC_FLAGS(0x0002 /* GMEM_MOVEABLE */), byte_len)
                .map_err(|e| OsWinError::ClipboardFailed(format!("GlobalAlloc: {}", e)))?;

            let ptr = GlobalLock(hmem);
            if ptr.is_null() {
                return Err(OsWinError::ClipboardFailed("GlobalLock returned null".into()));
            }

            std::ptr::copy_nonoverlapping(wide.as_ptr() as *const u8, ptr as *mut u8, byte_len);
            let _ = GlobalUnlock(hmem);

            SetClipboardData(CF_UNICODETEXT.0 as u32, Some(HANDLE(hmem.0)))
                .map_err(|e| OsWinError::ClipboardFailed(format!("SetClipboardData: {}", e)))?;
        }
        Ok(())
    })();

    unsafe {
        let _ = CloseClipboard();
    }

    result
}

#[cfg(not(windows))]
pub fn clipboard_set_text(_text: &str) -> OsWinResult<()> {
    Err(OsWinError::WinApiFailed(
        "Not supported on this platform".into(),
    ))
}

#[cfg(windows)]
pub fn clipboard_get_text() -> OsWinResult<String> {
    retry_clipboard_open(800, 50)?;

    let result = (|| -> OsWinResult<String> {
        unsafe {
            let hdata = GetClipboardData(CF_UNICODETEXT.0 as u32)
                .map_err(|e| OsWinError::ClipboardFailed(format!("GetClipboardData: {}", e)))?;

            let hmem: HGLOBAL = std::mem::transmute(hdata);
            let ptr = GlobalLock(hmem);
            if ptr.is_null() {
                return Err(OsWinError::ClipboardFailed("GlobalLock returned null".into()));
            }

            let mut len = 0usize;
            let wptr = ptr as *const u16;
            while *wptr.add(len) != 0 {
                len += 1;
            }

            let slice = std::slice::from_raw_parts(wptr, len);
            let text = String::from_utf16_lossy(slice);

            let _ = GlobalUnlock(hmem);

            Ok(text)
        }
    })();

    unsafe {
        let _ = CloseClipboard();
    }

    result
}

#[cfg(not(windows))]
pub fn clipboard_get_text() -> OsWinResult<String> {
    Err(OsWinError::WinApiFailed(
        "Not supported on this platform".into(),
    ))
}

/// §P3 Clipboard retry configuration with exponential backoff
const CLIPBOARD_RETRY_BASE_DELAY_MS: u64 = 10;
const CLIPBOARD_RETRY_MAX_DELAY_MS: u64 = 100;
const CLIPBOARD_RETRY_MAX_ATTEMPTS: u32 = 5;

#[cfg(windows)]
fn retry_clipboard_open(_timeout_ms: u64, _interval_ms: u64) -> OsWinResult<()> {
    use windows::Win32::Foundation::HWND;

    let mut attempts = 0;
    let mut delay = CLIPBOARD_RETRY_BASE_DELAY_MS;

    loop {
        let opened = unsafe { OpenClipboard(Some(HWND::default())) };
        if opened.is_ok() {
            return Ok(());
        }

        if attempts >= CLIPBOARD_RETRY_MAX_ATTEMPTS {
            return Err(OsWinError::Timeout(CLIPBOARD_RETRY_MAX_ATTEMPTS as u64 * CLIPBOARD_RETRY_BASE_DELAY_MS));
        }

        std::thread::sleep(std::time::Duration::from_millis(delay));
        delay = (delay * 2).min(CLIPBOARD_RETRY_MAX_DELAY_MS);
        attempts += 1;
    }
}
