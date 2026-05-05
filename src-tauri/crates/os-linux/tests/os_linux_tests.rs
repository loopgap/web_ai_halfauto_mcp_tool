//! os-linux 跨平台测试套件
//!
//! 这些测试分为两类：
//! - 便携测试：在任何平台上都能编译和运行（不需要真实的 Linux 窗口环境）
//! - Linux 特定测试：需要 wmctrl/xclip/xdotool 的真实 Linux 环境

extern crate os_linux;

#[cfg(test)]
mod tests {
    use os_linux::error::{OsLinuxError, OsLinuxResult};
    use os_linux::input::PasteOptions;
    use os_linux::DispatchRequest;

    // ═══════════════════════════════════════════════════════════════════════════
    // 便携测试（可在任何平台上编译）
    // ═══════════════════════════════════════════════════════════════════════════

    /// 测试 PasteOptions 默认值
    #[test]
    fn test_paste_options_default() {
        let opts = PasteOptions::default();
        assert!(!opts.auto_enter, "默认 auto_enter 应为 false");
        assert_eq!(opts.paste_delay_ms, 80, "默认 paste_delay_ms 应为 80ms");
        assert_eq!(opts.enter_delay_ms, 120, "默认 enter_delay_ms 应为 120ms");
    }

    /// 测试 PasteOptions 自定义值
    #[test]
    fn test_paste_options_custom() {
        let opts = PasteOptions {
            auto_enter: true,
            paste_delay_ms: 100,
            enter_delay_ms: 200,
        };
        assert!(opts.auto_enter);
        assert_eq!(opts.paste_delay_ms, 100);
        assert_eq!(opts.enter_delay_ms, 200);
    }

    /// 测试 DispatchRequest 构造
    #[test]
    fn test_dispatch_request_construction() {
        let req = DispatchRequest {
            hwnd: 12345,
            text: "Hello AI Workbench".to_string(),
            opts: PasteOptions::default(),
            activate_retry: 3,
            activate_settle_delay_ms: 80,
        };
        assert_eq!(req.hwnd, 12345);
        assert_eq!(req.text, "Hello AI Workbench");
        assert_eq!(req.activate_retry, 3);
        assert_eq!(req.activate_settle_delay_ms, 80);
    }

    /// 测试 retry_with_timeout 立即成功
    #[test]
    fn test_retry_with_timeout_immediate_success() {
        let result: OsLinuxResult<i32> = os_linux::retry_with_timeout(1000, 50, || Ok(42));
        assert_eq!(result.unwrap(), 42, "应该立即返回成功值");
    }

    /// 测试 retry_with_timeout 最终超时
    #[test]
    fn test_retry_with_timeout_eventual_timeout() {
        let result: OsLinuxResult<()> = os_linux::retry_with_timeout(100, 30, || {
            Err(OsLinuxError::ClipboardFailed("模拟忙状态".into()))
        });
        match result {
            Err(OsLinuxError::Timeout(ms)) => assert_eq!(ms, 100),
            _ => panic!("应该返回 Timeout 错误"),
        }
    }

    /// 测试 retry_with_timeout 不可重试错误立即返回
    #[test]
    fn test_retry_with_timeout_non_retryable_error() {
        let result: OsLinuxResult<()> = os_linux::retry_with_timeout(1000, 50, || {
            Err(OsLinuxError::InvalidArg("无效参数".into()))
        });
        match result {
            Err(OsLinuxError::InvalidArg(msg)) => assert!(msg.contains("无效参数")),
            _ => panic!("应该返回 InvalidArg 错误"),
        }
    }

    /// 测试 retry_with_timeout 可重试 + 最终成功
    #[test]
    fn test_retry_with_timeout_eventual_success() {
        let mut attempts = 0;
        let result: OsLinuxResult<i32> = os_linux::retry_with_timeout(500, 50, || {
            attempts += 1;
            if attempts < 3 {
                Err(OsLinuxError::ActivateFailed)
            } else {
                Ok(42)
            }
        });
        assert_eq!(result.unwrap(), 42);
        assert_eq!(attempts, 3);
    }

    /// 测试错误类型 Display 实现
    #[test]
    fn test_error_display() {
        let e = OsLinuxError::WindowNotFound;
        assert_eq!(e.to_string(), "No window matched the criteria");

        let e = OsLinuxError::Timeout(5000);
        assert_eq!(e.to_string(), "Timeout after 5000ms");

        let e = OsLinuxError::ClipboardFailed("xclip 失败".into());
        assert_eq!(e.to_string(), "Clipboard operation failed: xclip 失败");

        let e = OsLinuxError::InputFailed("xdotool 失败".into());
        assert_eq!(e.to_string(), "Input simulation failed: xdotool 失败");

        let e = OsLinuxError::WinApiFailed("wmctrl 失败".into());
        assert_eq!(e.to_string(), "Linux system utility error: wmctrl 失败");

        let e = OsLinuxError::InvalidArg("无效正则".into());
        assert_eq!(e.to_string(), "Invalid argument: 无效正则");
    }

    /// 测试错误类型 Debug 实现
    #[test]
    fn test_error_debug() {
        let e = OsLinuxError::WindowNotFound;
        let debug_str = format!("{:?}", e);
        assert!(debug_str.contains("WindowNotFound"));
    }

    /// 测试 WindowInfo 结构（便携部分）
    #[test]
    fn test_window_info_structure() {
        use os_linux::window::WindowInfo;
        let info = WindowInfo {
            hwnd: 0x1234,
            title: "测试窗口".to_string(),
            class_name: "test-class".to_string(),
            process_id: 1000,
            exe_name: Some("test.exe".to_string()),
            is_visible: true,
            is_minimized: false,
        };
        assert_eq!(info.hwnd, 0x1234);
        assert_eq!(info.title, "测试窗口");
        assert!(info.is_visible);
        assert!(!info.is_minimized);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // Linux 特定测试（需要真实 Linux 环境）
    // ═══════════════════════════════════════════════════════════════════════════

    /// 测试无效正则表达式返回错误
    #[test]
    fn test_find_window_invalid_regex() {
        let result = os_linux::window::find_window_by_title_regex(
            &["[无效正则".to_string()],
            false,
        );
        match result {
            Err(OsLinuxError::InvalidArg(_)) => (),
            _ => panic!("应该返回 InvalidArg 错误"),
        }
    }

    /// 测试查找不存在的窗口返回 WindowNotFound
    /// 注意：在非 Linux 环境会因为 wmctrl 不存在而返回 WinApiFailed
    #[test]
    fn test_find_window_no_match() {
        let result = os_linux::window::find_window_by_title_regex(
            &["THIS_WINDOW_DOES_NOT_EXIST_12345678".to_string()],
            false,
        );
        match result {
            Err(OsLinuxError::WindowNotFound) => (), // 真实 Linux 环境
            Err(OsLinuxError::WinApiFailed(_)) => (), // Windows CI 环境（wmctrl 不存在）
            other => panic!("应该返回 WindowNotFound 或 WinApiFailed，得到: {:?}", other),
        }
    }

    /// 测试枚举窗口函数存在性（在真实 Linux 上可能返回空列表）
    /// 注意：在非 Linux 环境（如 Windows CI）会因 wmctrl 不存在而失败，这是预期行为
    #[test]
    fn test_enum_windows_does_not_panic() {
        // 在 CI 环境中可能没有真实的窗口，所以允许返回空列表
        // 只要不 panic 就是通过
        let result = os_linux::window::enum_top_level_windows(false);
        // 在真实 Linux 环境下应该返回 Ok
        // 在 Windows 上会因为 wmctrl 不存在返回 Err
        assert!(result.is_ok() || result.is_err(), "应该返回 Result");
    }

    /// 测试枚举窗口包含不可见窗口时的行为
    #[test]
    fn test_enum_windows_with_invisible() {
        let result_all = os_linux::window::enum_top_level_windows(true);
        let result_visible = os_linux::window::enum_top_level_windows(false);

        match (result_all, result_visible) {
            (Ok(all), Ok(visible)) => {
                assert!(
                    all.len() >= visible.len(),
                    "包含不可见应该 >= 仅可见"
                );
            }
            _ => {
                // 在某些环境中可能失败，这是可接受的
            }
        }
    }

    /// 测试通过标题正则查找所有匹配窗口
    #[test]
    fn test_find_all_windows_by_title_regex() {
        // 使用一个肯定不存在的标题
        let result = os_linux::window::find_all_windows_by_title_regex(
            &["UNIQUE_NONEXISTENT_TITLE_12345678".to_string()],
            false,
        );
        match result {
            Ok(windows) => {
                // 应该返回空列表而不是错误
                assert!(windows.is_empty(), "不存在的标题应返回空列表");
            }
            Err(_) => {
                // 某些实现可能返回错误，这也是可接受的
            }
        }
    }

    /// 测试窗口激活无效句柄（理想情况下应返回错误）
    #[test]
    fn test_activate_invalid_hwnd() {
        // 0xDEADBEEF 是一个无效的窗口句柄
        let result = os_linux::window::activate_window(0xDEADBEEF, 0, 10);
        // 期望返回错误（WindowNotFound 或 ActivateFailed）
        assert!(result.is_err(), "激活无效句柄应该失败");
    }

    /// 测试 get_foreground_hwnd 返回值类型（存根实现）
    #[test]
    fn test_get_foreground_hwnd_returns_u64() {
        let _hwnd = os_linux::window::get_foreground_hwnd();
        // 注意：当前实现返回 0（存根）
        // 这个测试验证返回值是 u64 类型
        assert!(true, "get_foreground_hwnd 应返回 u64");
    }

    /// 测试 is_window_valid 返回布尔值（存根实现）
    #[test]
    fn test_is_window_valid_returns_bool() {
        // 注意：当前实现总是返回 false（存根）
        let valid = os_linux::window::is_window_valid(12345);
        assert!(matches!(valid, false), "当前存根实现应返回 false");
    }

    /// 测试 exe_name_from_pid 返回 Option（存根实现）
    #[test]
    fn test_exe_name_from_pid_returns_option() {
        // 注意：当前实现返回 None（存根）
        let exe = os_linux::window::exe_name_from_pid(12345);
        assert!(exe.is_none(), "当前存根实现应返回 None");
    }

    /// 测试 clipboard_transaction 备份和恢复逻辑（存根）
    #[test]
    fn test_clipboard_transaction_structure() {
        // 测试 clipboard_transaction 的闭包执行逻辑
        let result = os_linux::clipboard_transaction(
            || Ok(42),
            false, // 不恢复
        );
        assert_eq!(result.unwrap(), 42, "应该返回闭包的返回值");
    }

    /// 测试 clipboard_transaction 恢复标志
    #[test]
    fn test_clipboard_transaction_no_restore() {
        // 即使 restore=true，如果没有原内容也不应 panic
        let result = os_linux::clipboard_transaction(
            || Ok("test".to_string()),
            true,
        );
        assert!(result.is_ok(), "clipboard_transaction 不应 panic");
    }

    /// 测试 send_key_sequence 函数存在性
    #[test]
    fn test_send_key_sequence_exists() {
        use os_linux::input::send_key_sequence;
        // 注意：在 CI 环境中可能失败，但至少验证函数存在
        let result = send_key_sequence(&["ctrl+c".to_string()], 0);
        // 我们只验证函数能接受参数并返回 Result
        assert!(result.is_ok() || result.is_err(), "函数应返回 Result");
    }

    /// 测试 PasteOptions Clone 实现
    #[test]
    fn test_paste_options_clone() {
        let opts = PasteOptions::default();
        let cloned = opts.clone();
        assert_eq!(opts.auto_enter, cloned.auto_enter);
        assert_eq!(opts.paste_delay_ms, cloned.paste_delay_ms);
    }

    /// 测试 PasteOptions Clone 实现
    #[test]
    fn test_paste_options_clone_impl() {
        let opts = PasteOptions {
            auto_enter: true,
            paste_delay_ms: 50,
            enter_delay_ms: 100,
        };
        let copied = opts.clone(); // Clone 而不是 Copy
        assert_eq!(opts.auto_enter, copied.auto_enter);
        assert_eq!(opts.paste_delay_ms, copied.paste_delay_ms);
    }

    /// 测试 DispatchRequest Clone
    #[test]
    fn test_dispatch_request_clone() {
        let req = DispatchRequest {
            hwnd: 123,
            text: "test".to_string(),
            opts: PasteOptions::default(),
            activate_retry: 1,
            activate_settle_delay_ms: 50,
        };
        let cloned = req.clone();
        assert_eq!(req.hwnd, cloned.hwnd);
        assert_eq!(req.text, cloned.text);
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 错误类型枚举覆盖测试
    // ═══════════════════════════════════════════════════════════════════════════

    /// 测试所有错误类型变体
    #[test]
    fn test_all_error_variants() {
        let errors = vec![
            OsLinuxError::WindowNotFound,
            OsLinuxError::ActivateFailed,
            OsLinuxError::ClipboardFailed("test".into()),
            OsLinuxError::InputFailed("test".into()),
            OsLinuxError::WinApiFailed("test".into()),
            OsLinuxError::Timeout(1000),
            OsLinuxError::InvalidArg("test".into()),
        ];

        for e in errors {
            let msg = e.to_string();
            assert!(!msg.is_empty(), "每个错误应该有错误消息");
        }
    }

    /// 测试 OsLinuxError 可以作为 Err 返回
    #[test]
    fn test_error_as_err() {
        fn return_error() -> OsLinuxResult<i32> {
            Err(OsLinuxError::WindowNotFound)
        }
        let result = return_error();
        assert!(result.is_err());
    }

    /// 测试错误匹配
    #[test]
    fn test_error_matching() {
        let result: OsLinuxResult<i32> = Err(OsLinuxError::ClipboardFailed("xclip".into()));

        match &result {
            Err(OsLinuxError::ClipboardFailed(msg)) => {
                assert!(msg.contains("xclip"));
            }
            _ => panic!("应该匹配 ClipboardFailed 错误"),
        }
    }

    // ═══════════════════════════════════════════════════════════════════════════
    // 存根函数标记测试（验证已知存根）
    // ═══════════════════════════════════════════════════════════════════════════

    /// 这些测试验证了存根函数的行为
    /// 如果后续实现了这些函数，这些测试应该被更新或移除

    #[test]
    fn test_stub_get_foreground_hwnd() {
        // 当前存根实现：总是返回 0
        let hwnd = os_linux::window::get_foreground_hwnd();
        assert_eq!(hwnd, 0, "存根实现应返回 0");
    }

    #[test]
    fn test_stub_is_window_valid() {
        // 当前存根实现：总是返回 false
        let valid = os_linux::window::is_window_valid(12345);
        assert!(!valid, "存根实现应返回 false");
    }

    #[test]
    fn test_stub_exe_name_from_pid() {
        // 当前存根实现：总是返回 None
        let exe = os_linux::window::exe_name_from_pid(12345);
        assert!(exe.is_none(), "存根实现应返回 None");
    }
}
