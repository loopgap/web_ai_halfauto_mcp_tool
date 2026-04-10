use crate::error::{OsWinError, OsWinResult};
use serde::{Deserialize, Serialize};

#[cfg(windows)]
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VK_CONTROL, VK_RETURN, VK_V,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PasteOptions {
    pub auto_enter: bool,
    pub paste_delay_ms: u64,
    pub enter_delay_ms: u64,
}

impl Default for PasteOptions {
    fn default() -> Self {
        Self {
            auto_enter: true,
            paste_delay_ms: 100,
            enter_delay_ms: 100,
        }
    }
}

#[cfg(windows)]
pub fn simulate_paste(options: &PasteOptions) -> OsWinResult<()> {
    unsafe {
        // Ctrl down
        send_key(VK_CONTROL.0, false)?;
        // V down
        send_key(VK_V.0, false)?;
        // V up
        send_key(VK_V.0, true)?;
        // Ctrl up
        send_key(VK_CONTROL.0, true)?;

        if options.paste_delay_ms > 0 {
            std::thread::sleep(std::time::Duration::from_millis(options.paste_delay_ms));
        }

        if options.auto_enter {
            send_key(VK_RETURN.0, false)?;
            send_key(VK_RETURN.0, true)?;
            if options.enter_delay_ms > 0 {
                std::thread::sleep(std::time::Duration::from_millis(options.enter_delay_ms));
            }
        }
    }
    Ok(())
}

#[cfg(windows)]
pub fn send_ctrl_v(options: &PasteOptions) -> OsWinResult<()> {
    unsafe {
        send_key(VK_CONTROL.0, false)?;
        send_key(VK_V.0, false)?;
        send_key(VK_V.0, true)?;
        send_key(VK_CONTROL.0, true)?;
        if options.paste_delay_ms > 0 {
            std::thread::sleep(std::time::Duration::from_millis(options.paste_delay_ms));
        }
    }
    Ok(())
}

#[cfg(windows)]
pub fn send_enter(options: &PasteOptions) -> OsWinResult<()> {
    unsafe {
        send_key(VK_RETURN.0, false)?;
        send_key(VK_RETURN.0, true)?;
        if options.enter_delay_ms > 0 {
            std::thread::sleep(std::time::Duration::from_millis(options.enter_delay_ms));
        }
    }
    Ok(())
}

#[cfg(windows)]
pub fn send_key_sequence(_keys: &[String], _delay_ms: u64) -> OsWinResult<()> {
    Ok(())
}

#[cfg(windows)]
unsafe fn send_key(vk: u16, is_up: bool) -> OsWinResult<()> {
    let input = INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: windows::Win32::UI::Input::KeyboardAndMouse::VIRTUAL_KEY(vk),
                wScan: 0,
                dwFlags: if is_up { KEYEVENTF_KEYUP } else { windows::Win32::UI::Input::KeyboardAndMouse::KEYBD_EVENT_FLAGS(0) },
                time: 0,
                dwExtraInfo: 0,
            },
        },
    };

    let sent = SendInput(&[input], std::mem::size_of::<INPUT>() as i32);
    if sent != 1 {
        return Err(OsWinError::InputFailed(format!("SendInput failed for VK {}", vk)));
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn simulate_paste(_options: &PasteOptions) -> OsWinResult<()> {
    Err(OsWinError::WinApiFailed("Not supported on this platform".into()))
}

#[cfg(not(windows))]
pub fn send_ctrl_v(_options: &PasteOptions) -> OsWinResult<()> {
    Err(OsWinError::WinApiFailed("Not supported on this platform".into()))
}

#[cfg(not(windows))]
pub fn send_enter(_options: &PasteOptions) -> OsWinResult<()> {
    Err(OsWinError::WinApiFailed("Not supported on this platform".into()))
}

#[cfg(not(windows))]
pub fn send_key_sequence(_keys: &[String], _delay_ms: u64) -> OsWinResult<()> {
    Err(OsWinError::WinApiFailed("Not supported on this platform".into()))
}
