use crate::error::{OsLinuxError, OsLinuxResult};
use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PasteOptions {
    pub auto_enter: bool,
    pub paste_delay_ms: u64,
    pub enter_delay_ms: u64,
}

impl Default for PasteOptions {
    fn default() -> Self {
        Self {
            auto_enter: false,
            paste_delay_ms: 80,
            enter_delay_ms: 120,
        }
    }
}

fn xdotool(args: &[&str]) -> OsLinuxResult<()> {
    let status = Command::new("xdotool")
        .args(args)
        .status()
        .map_err(|e| OsLinuxError::InputFailed(format!("xdotool: {}", e)))?;
    if !status.success() {
        return Err(OsLinuxError::InputFailed("xdotool exited with failure".into()));
    }
    Ok(())
}

pub fn simulate_paste(options: &PasteOptions) -> OsLinuxResult<()> {
    send_ctrl_v(options)?;
    if options.auto_enter {
        send_enter(options)?;
    }
    Ok(())
}

pub fn send_ctrl_v(options: &PasteOptions) -> OsLinuxResult<()> {
    xdotool(&["key", "--clearmodifiers", "ctrl+v"])?;
    if options.paste_delay_ms > 0 {
        std::thread::sleep(std::time::Duration::from_millis(options.paste_delay_ms));
    }
    Ok(())
}

pub fn send_enter(options: &PasteOptions) -> OsLinuxResult<()> {
    xdotool(&["key", "Return"])?;
    if options.enter_delay_ms > 0 {
        std::thread::sleep(std::time::Duration::from_millis(options.enter_delay_ms));
    }
    Ok(())
}

pub fn send_key_sequence(keys: &[String], delay_ms: u64) -> OsLinuxResult<()> {
    for key in keys {
        xdotool(&["key", key])?;
        if delay_ms > 0 {
            std::thread::sleep(std::time::Duration::from_millis(delay_ms));
        }
    }
    Ok(())
}
