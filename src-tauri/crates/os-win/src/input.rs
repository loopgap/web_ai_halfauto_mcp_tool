use crate::error::{OsWinError, OsWinResult};

#[cfg(windows)]
use windows::Win32::UI::Input::KeyboardAndMouse::{
    SendInput, INPUT, INPUT_0, INPUT_KEYBOARD, KEYBDINPUT, KEYEVENTF_KEYUP, VIRTUAL_KEY,
};

#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
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

#[cfg(windows)]
const VK_CONTROL: u16 = 0x11;
#[cfg(windows)]
const VK_V: u16 = 0x56;
#[cfg(windows)]
const VK_RETURN: u16 = 0x0D;

/// Send Ctrl+V keystroke sequence.
#[cfg(windows)]
pub fn send_ctrl_v(opts: &PasteOptions) -> OsWinResult<()> {
    std::thread::sleep(std::time::Duration::from_millis(opts.paste_delay_ms));

    let inputs = [
        make_key_input(VK_CONTROL, false),
        make_key_input(VK_V, false),
        make_key_input(VK_V, true),
        make_key_input(VK_CONTROL, true),
    ];

    let sent = unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
    if sent != inputs.len() as u32 {
        return Err(OsWinError::InputFailed(format!(
            "SendInput returned {} instead of {}",
            sent,
            inputs.len()
        )));
    }

    Ok(())
}

#[cfg(not(windows))]
pub fn send_ctrl_v(_opts: &PasteOptions) -> OsWinResult<()> {
    Err(OsWinError::WinApiFailed(
        "Not supported on this platform".into(),
    ))
}

/// Send Enter keystroke.
#[cfg(windows)]
pub fn send_enter(opts: &PasteOptions) -> OsWinResult<()> {
    std::thread::sleep(std::time::Duration::from_millis(opts.enter_delay_ms));

    let inputs = [
        make_key_input(VK_RETURN, false),
        make_key_input(VK_RETURN, true),
    ];

    let sent = unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
    if sent != inputs.len() as u32 {
        return Err(OsWinError::InputFailed(format!(
            "SendInput returned {} instead of {}",
            sent,
            inputs.len()
        )));
    }

    Ok(())
}

#[cfg(not(windows))]
pub fn send_enter(_opts: &PasteOptions) -> OsWinResult<()> {
    Err(OsWinError::WinApiFailed(
        "Not supported on this platform".into(),
    ))
}

#[cfg(windows)]
fn make_key_input(vk: u16, key_up: bool) -> INPUT {
    let mut flags = windows::Win32::UI::Input::KeyboardAndMouse::KEYBD_EVENT_FLAGS(0);
    if key_up {
        flags = KEYEVENTF_KEYUP;
    }
    INPUT {
        r#type: INPUT_KEYBOARD,
        Anonymous: INPUT_0 {
            ki: KEYBDINPUT {
                wVk: VIRTUAL_KEY(vk),
                wScan: 0,
                dwFlags: flags,
                time: 0,
                dwExtraInfo: 0,
            },
        },
    }
}

/// Map a key name string to its virtual key code (§9.7 Focus Recipe).
#[cfg(windows)]
pub fn key_name_to_vk(name: &str) -> Option<u16> {
    match name.to_uppercase().as_str() {
        "ESC" | "ESCAPE" => Some(0x1B),
        "TAB" => Some(0x09),
        "ENTER" | "RETURN" => Some(0x0D),
        "SPACE" => Some(0x20),
        "BACKSPACE" => Some(0x08),
        "DELETE" | "DEL" => Some(0x2E),
        "HOME" => Some(0x24),
        "END" => Some(0x23),
        "UP" => Some(0x26),
        "DOWN" => Some(0x28),
        "LEFT" => Some(0x25),
        "RIGHT" => Some(0x27),
        "CTRL" | "CONTROL" => Some(0x11),
        "ALT" => Some(0x12),
        "SHIFT" => Some(0x10),
        "F1" => Some(0x70),
        "F2" => Some(0x71),
        "F3" => Some(0x72),
        "F4" => Some(0x73),
        "F5" => Some(0x74),
        _ => None,
    }
}

#[cfg(not(windows))]
pub fn key_name_to_vk(_name: &str) -> Option<u16> {
    None
}

/// Execute a focus recipe — a sequence of keystrokes with delays (§9.7).
#[cfg(windows)]
pub fn send_key_sequence(keys: &[String], delay_between_ms: u64) -> OsWinResult<()> {
    for key_name in keys {
        let vk = key_name_to_vk(key_name).ok_or_else(|| {
            OsWinError::InvalidArg(format!("Unknown key name in focus recipe: {}", key_name))
        })?;

        let inputs = [make_key_input(vk, false), make_key_input(vk, true)];
        let sent = unsafe { SendInput(&inputs, std::mem::size_of::<INPUT>() as i32) };
        if sent != inputs.len() as u32 {
            return Err(OsWinError::InputFailed(format!(
                "Focus recipe: SendInput for '{}' returned {} instead of {}",
                key_name, sent, inputs.len()
            )));
        }

        if delay_between_ms > 0 {
            std::thread::sleep(std::time::Duration::from_millis(delay_between_ms));
        }
    }
    Ok(())
}

#[cfg(not(windows))]
pub fn send_key_sequence(_keys: &[String], _delay_between_ms: u64) -> OsWinResult<()> {
    Err(OsWinError::WinApiFailed(
        "Not supported on this platform".into(),
    ))
}
