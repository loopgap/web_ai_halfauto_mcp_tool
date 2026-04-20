use serde::{Deserialize, Serialize};

use crate::error::{OsWinError, OsWinResult};

#[cfg(windows)]
use windows::Win32::{
    Foundation::{HWND, LPARAM, TRUE},
    UI::WindowsAndMessaging::{
        BringWindowToTop, EnumWindows, GetClassNameW, GetForegroundWindow,
        GetWindowTextLengthW, GetWindowTextW, GetWindowThreadProcessId,
        IsIconic, IsWindow, IsWindowVisible,
        SetForegroundWindow, ShowWindow, SW_RESTORE,
    },
};

#[cfg(windows)]
use windows::core::BOOL;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WindowInfo {
    pub hwnd: u64,
    pub title: String,
    pub class_name: String,
    pub process_id: u32,
    pub exe_name: Option<String>,
    pub is_visible: bool,
    pub is_minimized: bool,
}

#[cfg(windows)]
struct EnumCtx {
    windows: Vec<WindowInfo>,
    include_invisible: bool,
}

#[cfg(windows)]
unsafe extern "system" fn enum_callback(hwnd: HWND, lparam: LPARAM) -> BOOL {
    let ctx = unsafe { &mut *(lparam.0 as *mut EnumCtx) };

    let is_visible = unsafe { IsWindowVisible(hwnd) }.as_bool();
    if !ctx.include_invisible && !is_visible {
        return TRUE;
    }

    // Get title
    let title_len = unsafe { GetWindowTextLengthW(hwnd) };
    if title_len == 0 && !ctx.include_invisible {
        return TRUE;
    }

    let mut title_buf = vec![0u16; (title_len + 1) as usize];
    let actual = unsafe { GetWindowTextW(hwnd, &mut title_buf) };
    let title = String::from_utf16_lossy(&title_buf[..actual as usize]);

    // Get class name
    let mut class_buf = vec![0u16; 256];
    let class_len = unsafe { GetClassNameW(hwnd, &mut class_buf) };
    let class_name = String::from_utf16_lossy(&class_buf[..class_len as usize]);

    // Get process ID
    let mut pid = 0u32;
    unsafe { GetWindowThreadProcessId(hwnd, Some(&mut pid)) };

    let is_minimized = unsafe { IsIconic(hwnd) }.as_bool();

    ctx.windows.push(WindowInfo {
        hwnd: hwnd.0 as u64,
        title,
        class_name,
        process_id: pid,
        exe_name: None,
        is_visible,
        is_minimized,
    });

    TRUE
}

/// Enumerate all top-level windows.
#[cfg(windows)]
pub fn enum_top_level_windows(include_invisible: bool) -> OsWinResult<Vec<WindowInfo>> {
    let mut ctx = EnumCtx {
        windows: Vec::new(),
        include_invisible,
    };

    let result = unsafe {
        EnumWindows(
            Some(enum_callback),
            LPARAM(&mut ctx as *mut EnumCtx as isize),
        )
    };

    if let Err(e) = result {
        return Err(OsWinError::WinApiFailed(format!("EnumWindows failed: {}", e)));
    }

    // Sort by title for UI display
    ctx.windows.sort_by(|a, b| a.title.cmp(&b.title));
    Ok(ctx.windows)
}

#[cfg(not(windows))]
pub fn enum_top_level_windows(_include_invisible: bool) -> OsWinResult<Vec<WindowInfo>> {
    Err(OsWinError::WinApiFailed(
        "Not supported on this platform".into(),
    ))
}

/// Activate a window by HWND with retry logic.
#[cfg(windows)]
pub fn activate_window(hwnd: u64, retry: u32, settle_delay_ms: u64) -> OsWinResult<()> {
    let hwnd_win = HWND(hwnd as *mut std::ffi::c_void);

    if !unsafe { IsWindow(Some(hwnd_win)) }.as_bool() {
        return Err(OsWinError::WindowNotFound);
    }

    for attempt in 0..=retry {
        // Restore if minimized
        if unsafe { IsIconic(hwnd_win) }.as_bool() {
            unsafe {
                let _ = ShowWindow(hwnd_win, SW_RESTORE);
            };
        }

        // Try to bring to front
        let _ = unsafe { BringWindowToTop(hwnd_win) };
        let _ = unsafe { SetForegroundWindow(hwnd_win) };

        // Settle delay
        std::thread::sleep(std::time::Duration::from_millis(settle_delay_ms));

        // Verify
        let fg = unsafe { GetForegroundWindow() };
        if fg == hwnd_win {
            return Ok(());
        }

        if attempt < retry {
            tracing::warn!(
                "Activate attempt {} failed, foreground={:?}, target={:?}",
                attempt + 1,
                fg.0,
                hwnd_win.0
            );
            std::thread::sleep(std::time::Duration::from_millis(100));
        }
    }

    Err(OsWinError::ActivateFailed)
}

#[cfg(not(windows))]
pub fn activate_window(_hwnd: u64, _retry: u32, _settle_delay_ms: u64) -> OsWinResult<()> {
    Err(OsWinError::WinApiFailed(
        "Not supported on this platform".into(),
    ))
}

/// Find a window by title regex patterns. Returns the first match.
pub fn find_window_by_title_regex(
    patterns: &[String],
    include_invisible: bool,
) -> OsWinResult<WindowInfo> {
    let compiled: Vec<regex::Regex> = patterns
        .iter()
        .map(|p| {
            if p.len() > 200 {
                return Err(OsWinError::InvalidArg("Regex pattern exceeds maximum length of 200 characters".into()));
            }
            regex::Regex::new(p)
                .map_err(|e| OsWinError::InvalidArg(format!("Invalid regex '{}': {}", p, e)))
        })
        .collect::<Result<Vec<_>, _>>()?;

    let windows = enum_top_level_windows(include_invisible)?;

    for win in &windows {
        for re in &compiled {
            if re.is_match(&win.title) {
                return Ok(win.clone());
            }
        }
    }

    Err(OsWinError::WindowNotFound)
}

/// Find ALL windows matching title regex patterns (for ambiguity detection §9.1).
pub fn find_all_windows_by_title_regex(
    patterns: &[String],
    include_invisible: bool,
) -> OsWinResult<Vec<WindowInfo>> {
    let compiled: Vec<regex::Regex> = patterns
        .iter()
        .map(|p| {
            if p.len() > 200 {
                return Err(OsWinError::InvalidArg("Regex pattern exceeds maximum length of 200 characters".into()));
            }
            regex::Regex::new(p)
                .map_err(|e| OsWinError::InvalidArg(format!("Invalid regex '{}': {}", p, e)))
        })
        .collect::<Result<Vec<_>, _>>()?;

    let windows = enum_top_level_windows(include_invisible)?;
    let mut matches = Vec::new();

    for win in &windows {
        for re in &compiled {
            if re.is_match(&win.title) {
                matches.push(win.clone());
                break;
            }
        }
    }

    Ok(matches)
}

/// Get the HWND of the current foreground window (§9.5 Soft Lock).
#[cfg(windows)]
pub fn get_foreground_hwnd() -> u64 {
    unsafe { GetForegroundWindow().0 as u64 }
}

#[cfg(not(windows))]
pub fn get_foreground_hwnd() -> u64 {
    0
}

/// Check if a specific HWND is still valid and visible.
#[cfg(windows)]
pub fn is_window_valid(hwnd: u64) -> bool {
    let h = HWND(hwnd as *mut std::ffi::c_void);
    unsafe { IsWindow(Some(h)) }.as_bool()
}

#[cfg(not(windows))]
pub fn is_window_valid(_hwnd: u64) -> bool {
    false
}

/// Resolve the executable name from a process ID.
#[cfg(windows)]
pub fn exe_name_from_pid(pid: u32) -> Option<String> {
    use windows::Win32::System::Threading::{
        OpenProcess, QueryFullProcessImageNameW, PROCESS_NAME_FORMAT,
        PROCESS_QUERY_LIMITED_INFORMATION,
    };
    use windows::Win32::Foundation::CloseHandle;
    use windows::core::PWSTR;

    unsafe {
        let handle = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, false, pid).ok()?;
        let mut buf = [0u16; 512];
        let mut len = buf.len() as u32;
        let ok = QueryFullProcessImageNameW(
            handle,
            PROCESS_NAME_FORMAT(0),
            PWSTR(buf.as_mut_ptr()),
            &mut len,
        );
        let _ = CloseHandle(handle);
        if ok.is_ok() {
            let path = String::from_utf16_lossy(&buf[..len as usize]);
            path.rsplit('\\').next().map(|s| s.to_lowercase())
        } else {
            None
        }
    }
}

#[cfg(not(windows))]
pub fn exe_name_from_pid(_pid: u32) -> Option<String> {
    None
}
