use crate::error::{OsLinuxError, OsLinuxResult};
use serde::{Deserialize, Serialize};
use std::process::Command;

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

fn run_cmd(cmd: &str, args: &[&str]) -> OsLinuxResult<String> {
    let out = Command::new(cmd)
        .args(args)
        .output()
        .map_err(|e| OsLinuxError::WinApiFailed(format!("{}: {}", cmd, e)))?;
    if !out.status.success() {
        return Err(OsLinuxError::WinApiFailed(format!(
            "{} exited with status {}",
            cmd,
            out.status
        )));
    }
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}

pub fn enum_top_level_windows(include_invisible: bool) -> OsLinuxResult<Vec<WindowInfo>> {
    let wmctrl = run_cmd("wmctrl", &["-lx"])?;
    let mut windows = Vec::new();

    for (idx, line) in wmctrl.lines().enumerate() {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 5 {
            continue;
        }
        let hwnd = u64::from_str_radix(parts[0].trim_start_matches("0x"), 16).unwrap_or(idx as u64 + 1);
        let class_name = parts.get(2).copied().unwrap_or("unknown").to_string();
        let title = parts[4..].join(" ");
        if !include_invisible && title.trim().is_empty() {
            continue;
        }
        windows.push(WindowInfo {
            hwnd,
            title,
            class_name,
            process_id: 0,
            exe_name: parts.get(1).map(|s| s.to_lowercase()),
            is_visible: true,
            is_minimized: false,
        });
    }

    windows.sort_by(|a, b| a.title.cmp(&b.title));
    Ok(windows)
}

pub fn activate_window(hwnd: u64, _retry: u32, _settle_delay_ms: u64) -> OsLinuxResult<()> {
    let hex = format!("0x{:x}", hwnd);
    let status = Command::new("wmctrl")
        .args(["-ia", &hex])
        .status()
        .map_err(|e| OsLinuxError::WinApiFailed(format!("wmctrl: {}", e)))?;
    if !status.success() {
        return Err(OsLinuxError::ActivateFailed);
    }
    Ok(())
}

pub fn find_window_by_title_regex(patterns: &[String], include_invisible: bool) -> OsLinuxResult<WindowInfo> {
    let compiled: Vec<regex::Regex> = patterns
        .iter()
        .map(|p| regex::Regex::new(p).map_err(|e| OsLinuxError::InvalidArg(format!("invalid regex '{}': {}", p, e))))
        .collect::<Result<Vec<_>, _>>()?;

    let windows = enum_top_level_windows(include_invisible)?;
    for win in &windows {
        if compiled.iter().any(|re| re.is_match(&win.title)) {
            return Ok(win.clone());
        }
    }

    Err(OsLinuxError::WindowNotFound)
}

pub fn find_all_windows_by_title_regex(patterns: &[String], include_invisible: bool) -> OsLinuxResult<Vec<WindowInfo>> {
    let compiled: Vec<regex::Regex> = patterns
        .iter()
        .map(|p| regex::Regex::new(p).map_err(|e| OsLinuxError::InvalidArg(format!("invalid regex '{}': {}", p, e))))
        .collect::<Result<Vec<_>, _>>()?;

    let windows = enum_top_level_windows(include_invisible)?;
    let mut matches = Vec::new();

    for win in &windows {
        if compiled.iter().any(|re| re.is_match(&win.title)) {
            matches.push(win.clone());
        }
    }

    Ok(matches)
}

pub fn get_foreground_hwnd() -> u64 {
    0
}

pub fn is_window_valid(_hwnd: u64) -> bool {
    false
}

pub fn exe_name_from_pid(_pid: u32) -> Option<String> {
    None
}
