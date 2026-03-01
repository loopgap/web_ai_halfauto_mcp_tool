#[cfg(test)]
mod tests {
    use os_win::error::OsWinError;
    use os_win::input::PasteOptions;

    #[test]
    fn test_paste_options_default() {
        let opts = PasteOptions::default();
        assert!(!opts.auto_enter);
        assert_eq!(opts.paste_delay_ms, 80);
        assert_eq!(opts.enter_delay_ms, 120);
    }

    #[test]
    fn test_dispatch_request_construction() {
        let req = os_win::DispatchRequest {
            hwnd: 12345,
            text: "Hello AI".to_string(),
            opts: PasteOptions::default(),
            activate_retry: 3,
            activate_settle_delay_ms: 80,
        };
        assert_eq!(req.hwnd, 12345);
        assert_eq!(req.text, "Hello AI");
        assert_eq!(req.activate_retry, 3);
    }

    #[test]
    fn test_retry_with_timeout_immediate_success() {
        let result = os_win::retry_with_timeout(1000, 50, || Ok(42));
        assert_eq!(result.unwrap(), 42);
    }

    #[test]
    fn test_retry_with_timeout_eventual_timeout() {
        let result: Result<(), OsWinError> = os_win::retry_with_timeout(100, 30, || {
            Err(OsWinError::ClipboardFailed("busy".into()))
        });
        assert!(matches!(result, Err(OsWinError::Timeout(100))));
    }

    #[test]
    fn test_retry_with_timeout_non_retryable_error() {
        let result: Result<(), OsWinError> = os_win::retry_with_timeout(1000, 50, || {
            Err(OsWinError::InvalidArg("bad".into()))
        });
        assert!(matches!(result, Err(OsWinError::InvalidArg(_))));
    }

    #[test]
    fn test_find_window_invalid_regex() {
        let result = os_win::window::find_window_by_title_regex(
            &["[invalid regex".to_string()],
            false,
        );
        assert!(matches!(result, Err(OsWinError::InvalidArg(_))));
    }

    #[test]
    fn test_error_display() {
        let e = OsWinError::WindowNotFound;
        assert_eq!(e.to_string(), "No window matched the criteria");

        let e = OsWinError::Timeout(5000);
        assert_eq!(e.to_string(), "Timeout after 5000ms");

        let e = OsWinError::ClipboardFailed("test error".into());
        assert_eq!(e.to_string(), "Clipboard operation failed: test error");
    }

    #[cfg(windows)]
    #[test]
    fn test_enum_windows_returns_some() {
        // On a running Windows system, there should always be some windows
        let windows = os_win::window::enum_top_level_windows(false).unwrap();
        assert!(!windows.is_empty(), "Should find at least one visible window");
    }

    #[cfg(windows)]
    #[test]
    fn test_enum_windows_with_invisible() {
        let visible = os_win::window::enum_top_level_windows(false).unwrap();
        let all = os_win::window::enum_top_level_windows(true).unwrap();
        assert!(
            all.len() >= visible.len(),
            "Including invisible should yield >= visible windows"
        );
    }

    #[cfg(windows)]
    #[test]
    fn test_clipboard_roundtrip() {
        let test_text = "AI Workbench test 测试 🤖";
        os_win::clipboard::clipboard_set_text(test_text).unwrap();
        let got = os_win::clipboard::clipboard_get_text().unwrap();
        assert_eq!(got, test_text);
    }

    #[cfg(windows)]
    #[test]
    fn test_activate_invalid_hwnd() {
        let result = os_win::window::activate_window(0xDEADBEEF, 0, 10);
        assert!(matches!(result, Err(OsWinError::WindowNotFound)));
    }

    #[cfg(windows)]
    #[test]
    fn test_find_window_no_match() {
        let result = os_win::window::find_window_by_title_regex(
            &["THIS_WINDOW_DOES_NOT_EXIST_12345".to_string()],
            false,
        );
        assert!(matches!(result, Err(OsWinError::WindowNotFound)));
    }
}
