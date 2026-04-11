use crate::error::{OsLinuxError, OsLinuxResult};
use std::io::Write;
use std::process::{Command, Stdio};

pub fn clipboard_set_text(text: &str) -> OsLinuxResult<()> {
    let mut child = Command::new("xclip")
        .args(["-selection", "clipboard"])
        .stdin(Stdio::piped())
        .spawn()
        .map_err(|e| OsLinuxError::ClipboardFailed(format!("xclip spawn: {}", e)))?;

    if let Some(stdin) = child.stdin.as_mut() {
        stdin
            .write_all(text.as_bytes())
            .map_err(|e| OsLinuxError::ClipboardFailed(format!("xclip write: {}", e)))?;
    }

    let status = child
        .wait()
        .map_err(|e| OsLinuxError::ClipboardFailed(format!("xclip wait: {}", e)))?;
    if !status.success() {
        return Err(OsLinuxError::ClipboardFailed("xclip exited with failure".into()));
    }
    Ok(())
}

pub fn clipboard_get_text() -> OsLinuxResult<String> {
    let out = Command::new("xclip")
        .args(["-selection", "clipboard", "-o"])
        .output()
        .map_err(|e| OsLinuxError::ClipboardFailed(format!("xclip spawn: {}", e)))?;
    if !out.status.success() {
        return Err(OsLinuxError::ClipboardFailed("xclip exited with failure".into()));
    }
    Ok(String::from_utf8_lossy(&out.stdout).to_string())
}
