mod config;

use crate_core::{err, new_trace_id, now_ms, ApiError, AuditEvent, CmdResult};
use os_win::clipboard;
use os_win::error::OsWinError;
use os_win::input::PasteOptions;
use os_win::window::{self, WindowInfo};
use os_win::DispatchRequest;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant};
use tauri::Manager;
use tauri::Emitter;

const MAX_TEXT_LEN: usize = 120_000;
const MAX_REGEX_PATTERNS: usize = 32;
const MAX_REGEX_LEN: usize = 512;
const MAX_ACTIVATE_RETRY: u32 = 10;
const MAX_DELAY_MS: u64 = 10_000;
const MAX_TARGETS: usize = 256;
const MIN_DISPATCH_INTERVAL_MS: u64 = 120;

static DISPATCH_GUARD: OnceLock<Mutex<DispatchGuard>> = OnceLock::new();
/// §29.4 Confirm idempotency: track confirmed hwnds to prevent duplicate sends
static CONFIRM_GUARD: OnceLock<Mutex<HashSet<u64>>> = OnceLock::new();

#[derive(Debug, Default)]
struct DispatchGuard {
    last_dispatch_at: Option<Instant>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnumWindowsArgs {
    pub include_invisible: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ActivateArgs {
    pub hwnd: u64,
    pub retry: u32,
    pub settle_delay_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DispatchArgs {
    pub hwnd: u64,
    pub text: String,
    pub auto_enter: bool,
    pub paste_delay_ms: u64,
    pub enter_delay_ms: u64,
    pub activate_retry: u32,
    pub activate_settle_delay_ms: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FindByRegexArgs {
    pub patterns: Vec<String>,
    pub include_invisible: bool,
}

fn now_iso_stub() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();
    let date = config::chrono_date_stub();
    let time_of_day = secs % 86400;
    let h = time_of_day / 3600;
    let m = (time_of_day % 3600) / 60;
    let s = time_of_day % 60;
    format!("{}T{:02}:{:02}:{:02}Z", date, h, m, s)
}

fn map_os_error(action: &str, e: OsWinError) -> ApiError {
    match e {
        OsWinError::WindowNotFound => err(
            "TARGET_NOT_FOUND",
            "No matching target window was found",
            Some(action.to_string()),
        ),
        OsWinError::ActivateFailed => err(
            "TARGET_ACTIVATE_FAILED",
            "Failed to activate target window",
            Some(action.to_string()),
        ),
        OsWinError::ClipboardFailed(detail) => {
            err("CLIPBOARD_BUSY", "Clipboard operation failed", Some(detail))
        }
        OsWinError::InputFailed(detail) => {
            err("INPUT_FAILED", "Keyboard input simulation failed", Some(detail))
        }
        OsWinError::Timeout(ms) => err("TIMEOUT", "Operation timed out", Some(format!("{}ms", ms))),
        OsWinError::InvalidArg(detail) => {
            err("INVALID_ARG", "Invalid command argument", Some(detail))
        }
        OsWinError::WinApiFailed(detail) => {
            err("WIN_API_FAILED", "Windows API call failed", Some(detail))
        }
    }
}

fn write_audit(app_handle: &tauri::AppHandle, event: AuditEvent<'_>) {
    let Ok(base) = app_handle.path().app_config_dir() else {
        eprintln!("Audit error: failed to get app config dir");
        return;
    };
    let dir = base.join("audit");
    if let Err(e) = fs::create_dir_all(&dir) {
        eprintln!("Audit error: failed to create audit dir: {}", e);
        return;
    }
    let path = dir.join("security_events.jsonl");
    let Ok(mut file) = OpenOptions::new().create(true).append(true).open(path) else {
        eprintln!("Audit error: failed to open audit file");
        return;
    };
    let Ok(line) = serde_json::to_string(&event) else {
        eprintln!("Audit error: failed to serialize event");
        return;
    };
    if let Err(e) = writeln!(file, "{}", line) {
        eprintln!("Audit error: failed to write to audit file: {}", e);
    }
}

fn validate_activate_args(args: &ActivateArgs) -> CmdResult<()> {
    if args.hwnd == 0 {
        return Err(err(
            "INVALID_ARG",
            "Invalid hwnd",
            Some("hwnd must be non-zero".into()),
        ));
    }
    if args.retry > MAX_ACTIVATE_RETRY {
        return Err(err(
            "INVALID_ARG",
            "Retry exceeds safe limit",
            Some(format!("max retry is {}", MAX_ACTIVATE_RETRY)),
        ));
    }
    if args.settle_delay_ms > MAX_DELAY_MS {
        return Err(err(
            "INVALID_ARG",
            "Settle delay exceeds safe limit",
            Some(format!("max settle_delay_ms is {}", MAX_DELAY_MS)),
        ));
    }
    Ok(())
}

fn validate_find_args(args: &FindByRegexArgs) -> CmdResult<()> {
    if args.patterns.is_empty() {
        return Err(err(
            "INVALID_ARG",
            "No regex patterns were provided",
            Some("patterns must not be empty".into()),
        ));
    }
    if args.patterns.len() > MAX_REGEX_PATTERNS {
        return Err(err(
            "INVALID_ARG",
            "Too many regex patterns",
            Some(format!("max patterns is {}", MAX_REGEX_PATTERNS)),
        ));
    }

    for p in &args.patterns {
        if p.len() > MAX_REGEX_LEN {
            return Err(err(
                "INVALID_ARG",
                "Regex pattern is too long",
                Some(format!("max pattern length is {}", MAX_REGEX_LEN)),
            ));
        }
        Regex::new(p).map_err(|e| {
            err(
                "INVALID_REGEX",
                "Invalid regex pattern",
                Some(format!("pattern `{}`: {}", p, e)),
            )
        })?;
    }

    Ok(())
}

fn validate_dispatch_args(args: &DispatchArgs) -> CmdResult<()> {
    validate_activate_args(&ActivateArgs {
        hwnd: args.hwnd,
        retry: args.activate_retry,
        settle_delay_ms: args.activate_settle_delay_ms,
    })?;

    if args.text.trim().is_empty() {
        return Err(err(
            "EMPTY_PROMPT",
            "Dispatch text is empty",
            Some("text must contain non-whitespace characters".into()),
        ));
    }
    if args.text.contains('\0') {
        return Err(err(
            "INVALID_ARG",
            "Dispatch text contains null character",
            None,
        ));
    }
    if args.text.len() > MAX_TEXT_LEN {
        return Err(err(
            "PAYLOAD_TOO_LARGE",
            "Dispatch text exceeds safe size",
            Some(format!("max text length is {}", MAX_TEXT_LEN)),
        ));
    }
    if args.paste_delay_ms > MAX_DELAY_MS || args.enter_delay_ms > MAX_DELAY_MS {
        return Err(err(
            "INVALID_ARG",
            "Delay exceeds safe limit",
            Some(format!("max delay is {}ms", MAX_DELAY_MS)),
        ));
    }

    let guard = DISPATCH_GUARD.get_or_init(|| Mutex::new(DispatchGuard::default()));
    let mut state = guard
        .lock()
        .map_err(|_| err("INTERNAL_ERROR", "Dispatch lock is poisoned", None))?;

    if let Some(last) = state.last_dispatch_at {
        let elapsed = last.elapsed();
        if elapsed < Duration::from_millis(MIN_DISPATCH_INTERVAL_MS) {
            return Err(err(
                "DISPATCH_RATE_LIMITED",
                "Dispatch is being called too frequently",
                Some(format!(
                    "min interval {}ms, current {}ms",
                    MIN_DISPATCH_INTERVAL_MS,
                    elapsed.as_millis()
                )),
            ));
        }
    }
    state.last_dispatch_at = Some(Instant::now());

    Ok(())
}

fn validate_targets_config(cfg: &config::TargetsConfig) -> CmdResult<()> {
    if cfg.targets.len() > MAX_TARGETS {
        return Err(err(
            "INVALID_CONFIG",
            "Too many targets",
            Some(format!("max targets is {}", MAX_TARGETS)),
        ));
    }

    let mut ids = HashSet::new();
    for (id, target) in &cfg.targets {
        if id.trim().is_empty() {
            return Err(err(
                "INVALID_CONFIG",
                "Target id cannot be empty",
                Some("targets key contains empty id".into()),
            ));
        }
        if !ids.insert(id) {
            return Err(err(
                "INVALID_CONFIG",
                "Duplicated target id",
                Some(id.clone()),
            ));
        }
        if target.provider.trim().is_empty() {
            return Err(err(
                "INVALID_CONFIG",
                "Target provider cannot be empty",
                Some(id.clone()),
            ));
        }
        if target.match_config.title_regex.is_empty() {
            return Err(err(
                "INVALID_CONFIG",
                "Target must include at least one regex",
                Some(id.clone()),
            ));
        }
        if target.match_config.title_regex.len() > MAX_REGEX_PATTERNS {
            return Err(err(
                "INVALID_CONFIG",
                "Too many regex patterns in target",
                Some(format!("{} max {}", id, MAX_REGEX_PATTERNS)),
            ));
        }
        for p in &target.match_config.title_regex {
            if p.len() > MAX_REGEX_LEN {
                return Err(err(
                    "INVALID_CONFIG",
                    "Regex too long in target",
                    Some(format!("{} max {}", id, MAX_REGEX_LEN)),
                ));
            }
            Regex::new(p).map_err(|e| {
                err(
                    "INVALID_CONFIG",
                    "Invalid target regex",
                    Some(format!("{}: `{}` => {}", id, p, e)),
                )
            })?;
        }
    }

    if cfg.defaults.activate_retry > MAX_ACTIVATE_RETRY {
        return Err(err(
            "INVALID_CONFIG",
            "defaults.activate_retry exceeds safe limit",
            Some(format!("max {}", MAX_ACTIVATE_RETRY)),
        ));
    }

    Ok(())
}

#[tauri::command]
fn os_enum_windows(args: EnumWindowsArgs) -> CmdResult<Vec<WindowInfo>> {
    window::enum_top_level_windows(args.include_invisible).map_err(|e| map_os_error("enum_windows", e))
}

#[tauri::command]
fn os_activate(app_handle: tauri::AppHandle, args: ActivateArgs) -> CmdResult<()> {
    validate_activate_args(&args)?;
    let result = window::activate_window(args.hwnd, args.retry, args.settle_delay_ms)
        .map_err(|e| map_os_error("activate_window", e));

    let (outcome, detail) = match &result {
        Ok(_) => ("ok", None),
        Err(e) => ("err", Some(e.code.as_str())),
    };
    write_audit(
        &app_handle,
        AuditEvent {
            ts_ms: now_ms(),
            action: "os_activate",
            outcome,
            trace_id: result
                .as_ref()
                .err()
                .map(|e| e.trace_id.as_str())
                .unwrap_or("n/a"),
            detail,
        },
    );

    result
}

#[tauri::command]
fn os_find_window_by_title_regex(args: FindByRegexArgs) -> CmdResult<WindowInfo> {
    validate_find_args(&args)?;
    window::find_window_by_title_regex(&args.patterns, args.include_invisible)
        .map_err(|e| map_os_error("find_window_by_title_regex", e))
}

#[tauri::command]
fn os_clipboard_get_text() -> CmdResult<String> {
    clipboard::clipboard_get_text().map_err(|e| map_os_error("clipboard_get_text", e))
}

#[tauri::command]
fn os_clipboard_set_text(text: String) -> CmdResult<()> {
    if text.contains('\0') {
        return Err(err(
            "INVALID_ARG",
            "Clipboard text contains null character",
            None,
        ));
    }
    if text.len() > MAX_TEXT_LEN {
        return Err(err(
            "PAYLOAD_TOO_LARGE",
            "Clipboard text exceeds safe size",
            Some(format!("max text length is {}", MAX_TEXT_LEN)),
        ));
    }
    clipboard::clipboard_set_text(&text).map_err(|e| map_os_error("clipboard_set_text", e))
}

#[tauri::command]
fn os_dispatch_paste(app_handle: tauri::AppHandle, args: DispatchArgs) -> CmdResult<()> {
    validate_dispatch_args(&args)?;
    let opts = PasteOptions {
        auto_enter: args.auto_enter,
        paste_delay_ms: args.paste_delay_ms,
        enter_delay_ms: args.enter_delay_ms,
    };

    let req = DispatchRequest {
        hwnd: args.hwnd,
        text: args.text,
        opts,
        activate_retry: args.activate_retry,
        activate_settle_delay_ms: args.activate_settle_delay_ms,
    };

    let result = os_win::dispatch_paste(req).map_err(|e| map_os_error("dispatch_paste", e));

    let (outcome, detail, trace) = match &result {
        Ok(_) => ("ok", None, "n/a".to_string()),
        Err(e) => ("err", Some(e.code.as_str()), e.trace_id.clone()),
    };
    write_audit(
        &app_handle,
        AuditEvent {
            ts_ms: now_ms(),
            action: "os_dispatch_paste",
            outcome,
            trace_id: &trace,
            detail,
        },
    );

    result
}

#[tauri::command]
fn load_targets_config(app_handle: tauri::AppHandle) -> CmdResult<config::TargetsConfig> {
    config::load_targets(&app_handle).map_err(|e| {
        err(
            "CONFIG_LOAD_FAILED",
            "Failed to load targets config",
            Some(e.to_string()),
        )
    })
}

#[tauri::command]
fn save_targets_config(
    app_handle: tauri::AppHandle,
    config_data: config::TargetsConfig,
) -> CmdResult<()> {
    validate_targets_config(&config_data)?;
    config::save_targets(&app_handle, &config_data).map_err(|e| {
        err(
            "CONFIG_SAVE_FAILED",
            "Failed to save targets config",
            Some(e.to_string()),
        )
    })
}

#[tauri::command]
fn load_skills(app_handle: tauri::AppHandle) -> CmdResult<Vec<config::Skill>> {
    config::load_skills(&app_handle).map_err(|e| {
        err(
            "CONFIG_LOAD_FAILED",
            "Failed to load skills",
            Some(e.to_string()),
        )
    })
}

#[tauri::command]
fn load_workflows(app_handle: tauri::AppHandle) -> CmdResult<Vec<config::Workflow>> {
    config::load_workflows(&app_handle).map_err(|e| {
        err(
            "CONFIG_LOAD_FAILED",
            "Failed to load workflows",
            Some(e.to_string()),
        )
    })
}

#[tauri::command]
fn load_router_rules(app_handle: tauri::AppHandle) -> CmdResult<config::RouterRulesConfig> {
    config::load_router_rules(&app_handle).map_err(|e| {
        err(
            "CONFIG_LOAD_FAILED",
            "Failed to load router rules",
            Some(e.to_string()),
        )
    })
}

#[tauri::command]
fn health_check(app_handle: tauri::AppHandle) -> CmdResult<Vec<config::TargetHealth>> {
    let targets_cfg = config::load_targets(&app_handle).map_err(|e| {
        err(
            "CONFIG_LOAD_FAILED",
            "Failed to load targets for health check",
            Some(e.to_string()),
        )
    })?;

    let windows = window::enum_top_level_windows(false).map_err(|e| map_os_error("health_check_enum", e))?;

    let mut results = Vec::new();
    for (id, target) in &targets_cfg.targets {
        let result = evaluate_target_status(id, target, &windows);
        results.push(result);
    }

    // 持久化健康快照 (§2 vault/health)
    let _ = config::save_health_snapshot(&app_handle, &results);

    Ok(results)
}

/// Multi-factor target matching (§9.1): hwnd → exe+class+title → ambiguous
fn evaluate_target_status(
    target_id: &str,
    target: &config::TargetEntry,
    windows: &[WindowInfo],
) -> config::TargetHealth {
    let mc = &target.match_config;

    // Stage 1: Try bound_hwnd first (§9.1 主匹配)
    if let Some(bound_hwnd) = mc.bound_hwnd {
        if window::is_window_valid(bound_hwnd) {
            if let Some(win) = windows.iter().find(|w| w.hwnd == bound_hwnd) {
                return config::TargetHealth {
                    target_id: target_id.to_string(),
                    provider: target.provider.clone(),
                    status: if win.is_minimized { config::TargetStatus::Inactive } else { config::TargetStatus::Ready },
                    matched: true,
                    matched_title: Some(win.title.clone()),
                    matched_hwnd: Some(bound_hwnd),
                    error_code: None,
                    error_message: None,
                };
            }
        }
        // hwnd invalid → fall through to exe+class+title; mark as NeedsRebind if found by other means
    }

    // Stage 2: exe_name + class_name + title_regex composite match
    let mut candidates: Vec<&WindowInfo> = Vec::new();

    for win in windows {
        let mut score = 0u8;

        // exe_name match
        if let Some(ref exe) = mc.exe_name {
            if let Some(ref win_exe) = win.exe_name {
                if win_exe.to_lowercase().contains(&exe.to_lowercase()) {
                    score += 1;
                }
            }
        }

        // class_name match
        if let Some(ref cn) = mc.class_name {
            if win.class_name.to_lowercase().contains(&cn.to_lowercase()) {
                score += 1;
            }
        }

        // title_regex match (fallback §9.1)
        for pat in &mc.title_regex {
            if let Ok(re) = Regex::new(pat) {
                if re.is_match(&win.title) {
                    score += 1;
                    break;
                }
            }
        }

        if score > 0 {
            candidates.push(win);
        }
    }

    let needs_rebind = mc.bound_hwnd.is_some(); // had a bound hwnd but it's invalid

    match candidates.len() {
        0 => config::TargetHealth {
            target_id: target_id.to_string(),
            provider: target.provider.clone(),
            status: config::TargetStatus::Missing,
            matched: false,
            matched_title: None,
            matched_hwnd: None,
            error_code: None,
            error_message: None,
        },
        1 => {
            let win = candidates[0];
            let status = if needs_rebind {
                config::TargetStatus::NeedsRebind
            } else if win.is_minimized {
                config::TargetStatus::Inactive
            } else {
                config::TargetStatus::Ready
            };
            config::TargetHealth {
                target_id: target_id.to_string(),
                provider: target.provider.clone(),
                status,
                matched: true,
                matched_title: Some(win.title.clone()),
                matched_hwnd: Some(win.hwnd),
                error_code: None,
                error_message: None,
            }
        }
        n => {
            // Multiple matches → Ambiguous (§9.1)
            let first = candidates[0];
            config::TargetHealth {
                target_id: target_id.to_string(),
                provider: target.provider.clone(),
                status: config::TargetStatus::Ambiguous,
                matched: true,
                matched_title: Some(first.title.clone()),
                matched_hwnd: Some(first.hwnd),
                error_code: None,
                error_message: Some(format!("{} windows matched, user confirmation needed", n)),
            }
        }
    }
}

// ═══════════════════════════════════════════════════════════
// Preflight Check (§9.3)
// ═══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreflightArgs {
    pub target_id: String,
}

#[tauri::command]
fn preflight_target(app_handle: tauri::AppHandle, args: PreflightArgs) -> CmdResult<config::PreflightResult> {
    let targets_cfg = config::load_targets(&app_handle).map_err(|e| {
        err("CONFIG_LOAD_FAILED", "Failed to load targets", Some(e.to_string()))
    })?;

    let target = targets_cfg.targets.get(&args.target_id).ok_or_else(|| {
        err("TARGET_NOT_FOUND", "Target not found in config", Some(args.target_id.clone()))
    })?;

    let windows = window::enum_top_level_windows(false)
        .map_err(|e| map_os_error("preflight_enum", e))?;

    let health = evaluate_target_status(&args.target_id, target, &windows);

    let suggestion = match &health.status {
        config::TargetStatus::Ready => None,
        config::TargetStatus::Missing => Some("目标窗口未找到，请先打开对应 AI 网页端".to_string()),
        config::TargetStatus::Ambiguous => Some("检测到多个匹配窗口，请进入绑定向导选择".to_string()),
        config::TargetStatus::NeedsRebind => Some("已保存的窗口句柄已失效，请重新绑定".to_string()),
        config::TargetStatus::Inactive => Some("目标窗口处于最小化状态，请恢复窗口".to_string()),
    };

    // Write preflight event
    let _ = config::write_vault_event(&app_handle, &config::VaultEvent {
        ts_ms: now_ms(),
        event_type: "preflight_check".to_string(),
        run_id: None,
        step_id: None,
        trace_id: new_trace_id(),
        action: "preflight_target".to_string(),
        outcome: format!("{:?}", health.status),
        detail: suggestion.clone(),
    });

    Ok(config::PreflightResult {
        target_id: args.target_id,
        status: health.status,
        matched_hwnd: health.matched_hwnd,
        matched_title: health.matched_title,
        candidate_count: if health.matched { 1 } else { 0 },
        suggestion,
    })
}

// ═══════════════════════════════════════════════════════════
// Two-Phase Dispatch (§9.4) + Clipboard Transaction (§9.6)
// + Focus Recipe (§9.7) + Run-ID Watermark (§9.8)
// + Soft Lock (§9.5)
// ═══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DispatchStageArgs {
    pub hwnd: u64,
    pub text: String,
    pub paste_delay_ms: u64,
    pub activate_retry: u32,
    pub activate_settle_delay_ms: u64,
    #[serde(default)]
    pub restore_clipboard: bool,
    #[serde(default)]
    pub focus_recipe: Vec<String>,
    #[serde(default)]
    pub run_id: Option<String>,
    #[serde(default)]
    pub step_id: Option<String>,
    #[serde(default)]
    pub target_id: Option<String>,
    #[serde(default = "default_true_fn")]
    pub append_watermark: bool,
}

fn default_true_fn() -> bool { true }

#[tauri::command]
fn dispatch_stage(app_handle: tauri::AppHandle, args: DispatchStageArgs) -> CmdResult<config::DispatchTrace> {
    let ts_start = now_ms();
    let trace_id = new_trace_id();
    let clipboard_txn_id = format!("ctx-{}", &trace_id);

    // §9.5 Soft Lock: verify foreground before dispatch
    let _fg_before = window::get_foreground_hwnd();

    // Build text with optional Run-ID watermark (§9.8)
    let final_text = if args.append_watermark {
        let run_tag = args.run_id.as_deref().unwrap_or("unknown");
        let step_tag = args.step_id.as_deref().unwrap_or("-");
        let target_tag = args.target_id.as_deref().unwrap_or("-");
        format!("{}\n[AIWB_RUN_ID={} STEP={} TARGET={}]", args.text, run_tag, step_tag, target_tag)
    } else {
        args.text.clone()
    };

    if final_text.len() > MAX_TEXT_LEN {
        return Err(err("PAYLOAD_TOO_LARGE", "Text with watermark exceeds limit", None));
    }

    // Rate limiting
    let guard = DISPATCH_GUARD.get_or_init(|| Mutex::new(DispatchGuard::default()));
    let mut state = guard.lock().map_err(|_| err("INTERNAL_ERROR", "Lock poisoned", None))?;
    if let Some(last) = state.last_dispatch_at {
        if last.elapsed() < Duration::from_millis(MIN_DISPATCH_INTERVAL_MS) {
            return Err(err("DISPATCH_RATE_LIMITED", "Dispatch too frequent", None));
        }
    }
    state.last_dispatch_at = Some(Instant::now());
    drop(state);

    let opts = PasteOptions {
        auto_enter: false, // Stage = no enter (§9.4)
        paste_delay_ms: args.paste_delay_ms,
        enter_delay_ms: 120,
    };

    let req = DispatchRequest {
        hwnd: args.hwnd,
        text: final_text,
        opts,
        activate_retry: args.activate_retry,
        activate_settle_delay_ms: args.activate_settle_delay_ms,
    };

    let focus_recipe_executed = !args.focus_recipe.is_empty();
    let mut activation_ok = false;
    let hwnd_for_trace = req.hwnd;

    // §29.4 Clear confirm guard for this hwnd (new stage cycle)
    if let Some(guard) = CONFIRM_GUARD.get() {
        if let Ok(mut set) = guard.lock() {
            set.remove(&hwnd_for_trace);
        }
    }

    // §9.6 Clipboard Transaction + §9.7 Focus Recipe
    let result = os_win::clipboard_transaction(move || {
        // Activate first
        window::activate_window(req.hwnd, req.activate_retry, req.activate_settle_delay_ms)?;

        // §9.7 Focus Recipe: run keystroke sequence after activation
        if !args.focus_recipe.is_empty() {
            os_win::input::send_key_sequence(&args.focus_recipe, 80)?;
        }

        // §9.5 Soft Lock: verify window is still foreground
        let fg_now = window::get_foreground_hwnd();
        if fg_now != req.hwnd {
            return Err(OsWinError::ActivateFailed);
        }

        // Set clipboard + paste
        clipboard::clipboard_set_text(&req.text)?;
        os_win::input::send_ctrl_v(&req.opts)?;

        Ok(())
    }, args.restore_clipboard);

    let ts_end = now_ms();
    let (outcome, detail_str) = match &result {
        Ok(_) => { activation_ok = true; ("ok".to_string(), None) },
        Err(e) => ("err".to_string(), Some(format!("{}", e))),
    };

    write_audit(&app_handle, AuditEvent {
        ts_ms: ts_end,
        action: "dispatch_stage",
        outcome: &outcome,
        trace_id: &trace_id,
        detail: detail_str.as_deref(),
    });

    // §9.9 + §29.3 构建结构化 DispatchTrace
    let dispatch_trace = config::DispatchTrace {
        trace_id: trace_id.clone(),
        run_id: args.run_id.clone(),
        step_id: args.step_id.clone(),
        target_id: args.target_id.clone(),
        ts_start,
        ts_end,
        duration_ms: ts_end.saturating_sub(ts_start),
        candidate_windows: vec![format!("hwnd={}", hwnd_for_trace)],
        matched_fingerprint: args.target_id.clone(),
        matched_hwnd: Some(hwnd_for_trace),
        activation_ok,
        activation_attempts: args.activate_retry,
        clipboard_backup_ok: args.restore_clipboard,
        clipboard_restore_ok: args.restore_clipboard && result.is_ok(),
        focus_recipe_executed,
        stage_ok: result.is_ok(),
        confirm_ok: None,
        clipboard_txn_id: Some(clipboard_txn_id),
        browser_id: None,
        injection_trace_id: None,
        outcome: outcome.clone(),
        error_detail: detail_str,
    };

    // §9.9 保存 DispatchTrace 到 vault
    let _ = config::save_dispatch_trace(&app_handle, &dispatch_trace);

    // §38 Event Bus
    let _ = app_handle.emit("workbench-event", serde_json::json!({
        "event_type": "StepDispatched",
        "run_id": args.run_id,
        "step_id": args.step_id,
        "target_id": args.target_id,
        "trace_id": trace_id,
        "ts_ms": ts_end,
        "stage_ok": result.is_ok(),
    }));

    result.map_err(|e| map_os_error("dispatch_stage", e))?;
    Ok(dispatch_trace)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DispatchConfirmArgs {
    pub hwnd: u64,
    pub enter_delay_ms: u64,
}

#[tauri::command]
fn dispatch_confirm(app_handle: tauri::AppHandle, args: DispatchConfirmArgs) -> CmdResult<()> {
    // §29.4 Idempotency: prevent duplicate confirm for same hwnd
    let confirm_set = CONFIRM_GUARD.get_or_init(|| Mutex::new(HashSet::new()));
    {
        let mut confirmed = confirm_set.lock().map_err(|_| err("INTERNAL_ERROR", "Confirm lock poisoned", None))?;
        if confirmed.len() > 1000 {
            confirmed.clear();
        }
        if confirmed.contains(&args.hwnd) {
            return Err(err("DISPATCH_DUPLICATE_CONFIRM", "Confirm already sent for this target (idempotency guard)", None));
        }
        confirmed.insert(args.hwnd);
    }

    // §9.5 Soft Lock: verify foreground is target
    let fg = window::get_foreground_hwnd();
    if fg != args.hwnd {
        // Try to re-activate
        window::activate_window(args.hwnd, 2, 80)
            .map_err(|e| map_os_error("dispatch_confirm_activate", e))?;
        let fg2 = window::get_foreground_hwnd();
        if fg2 != args.hwnd {
            return Err(err("TARGET_ACTIVATE_FAILED", "Cannot confirm: target window is not foreground", None));
        }
    }

    let opts = PasteOptions {
        auto_enter: true,
        paste_delay_ms: 0,
        enter_delay_ms: args.enter_delay_ms,
    };

    let result = os_win::dispatch_confirm(&opts).map_err(|e| map_os_error("dispatch_confirm", e));

    let trace = new_trace_id();
    write_audit(&app_handle, AuditEvent {
        ts_ms: now_ms(),
        action: "dispatch_confirm",
        outcome: if result.is_ok() { "ok" } else { "err" },
        trace_id: &trace,
        detail: None,
    });

    result
}

#[tauri::command]
fn get_foreground_hwnd() -> CmdResult<u64> {
    Ok(window::get_foreground_hwnd())
}

// ═══════════════════════════════════════════════════════════
// §60-§61 Browser Detection
// ═══════════════════════════════════════════════════════════

#[tauri::command]
fn detect_browsers() -> CmdResult<config::BrowserDetectionResult> {
    let windows = window::enum_top_level_windows(false)
        .map_err(|e| map_os_error("detect_browsers", e))?;
    let signatures = config::known_browser_signatures();

    let mut profile_map: std::collections::HashMap<String, config::BrowserProfile> =
        std::collections::HashMap::new();

    let mut has_unknown = false;
    let mut unknown_details: Vec<String> = Vec::new();

    for win in &windows {
        let exe = window::exe_name_from_pid(win.process_id).unwrap_or_default();
        let cls = win.class_name.to_lowercase();

        // Level 1: exact exe-name match against known signatures
        let mut matched_id: Option<String> = None;
        for &(bid, exe_pat, _cls_pat) in &signatures {
            if exe.contains(exe_pat) {
                matched_id = Some(bid.to_string());
                break;
            }
        }

        // Level 2: class_name family heuristic
        if matched_id.is_none() {
            if cls.contains("mozillawindowclass") {
                matched_id = Some("firefox".to_string());
            } else if cls.contains("chrome_widgetwin_1") {
                // Could be any Chromium-based browser; default to chrome
                matched_id = Some("chrome".to_string());
            }
        }

        let browser_id = matched_id.unwrap_or_else(|| {
            let title_lower = win.title.to_lowercase();
            if title_lower.contains("http")
                || title_lower.contains("www.")
                || title_lower.contains(" — ")
            {
                has_unknown = true;
                unknown_details.push(format!(
                    "exe={} class={} title={}",
                    exe,
                    win.class_name,
                    &win.title[..win.title.len().min(60)]
                ));
                "other".to_string()
            } else {
                "other".into()
            }
        });

        if browser_id == "other" && !win.is_visible {
            continue;
        }

        let entry = profile_map.entry(browser_id.clone()).or_insert_with(|| {
            config::BrowserProfile {
                browser_id: browser_id.clone(),
                exe_name: exe.clone(),
                class_name: win.class_name.clone(),
                installed: true,
                running: true,
                window_count: 0,
                supports_target: false,
                health_score: 0,
            }
        });
        entry.window_count += 1;

        let mut score: u32 = 50;
        if win.is_visible {
            score += 30;
        }
        if !win.is_minimized {
            score += 20;
        }
        if score > entry.health_score {
            entry.health_score = score;
        }
    }

    let profiles: Vec<config::BrowserProfile> = profile_map.into_values().collect();

    let warning_message = if has_unknown {
        Some(format!(
            "检测到 {} 个未识别的浏览器窗口。建议使用 Firefox/Chrome/Edge/Brave 等主流浏览器以获得最佳兼容性。详情: {}",
            unknown_details.len(),
            unknown_details.join("; ")
        ))
    } else {
        None
    };

    Ok(config::BrowserDetectionResult {
        profiles,
        unknown_browser_warning: has_unknown,
        warning_message,
    })
}

// ═══════════════════════════════════════════════════════════
// Self-Heal (§8)
// ═══════════════════════════════════════════════════════════

#[tauri::command]
fn get_self_heal_registry() -> CmdResult<Vec<config::SelfHealAction>> {
    Ok(config::self_heal_registry())
}

// ═══════════════════════════════════════════════════════════
// State Transition Validation (§10)
// ═══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidateTransitionArgs {
    pub from: String,
    pub to: String,
}

#[tauri::command]
fn validate_run_transition(args: ValidateTransitionArgs) -> CmdResult<bool> {
    Ok(config::validate_run_transition(&args.from, &args.to))
}

// ═══════════════════════════════════════════════════════════
// 规则引擎 v2 命令 (§5)
// ═══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutePromptArgs {
    pub prompt: String,
}

#[tauri::command]
fn route_prompt(app_handle: tauri::AppHandle, args: RoutePromptArgs) -> CmdResult<config::RouteDecision> {
    if args.prompt.trim().is_empty() {
        return Err(err("INPUT_EMPTY", "Prompt is empty", None));
    }
    if args.prompt.len() > MAX_TEXT_LEN {
        return Err(err("INPUT_TOO_LONG", "Prompt exceeds safe size", Some(format!("max {}", MAX_TEXT_LEN))));
    }

    let rules = config::load_router_rules(&app_handle).map_err(|e| {
        err("CONFIG_LOAD_FAILED", "Failed to load router rules", Some(e.to_string()))
    })?;

    let decision = config::route_prompt(&args.prompt, &rules);

    // 写入事件日志
    let _ = config::write_vault_event(&app_handle, &config::VaultEvent {
        ts_ms: now_ms(),
        event_type: "route_decision".to_string(),
        run_id: None,
        step_id: None,
        trace_id: decision.trace_id.clone(),
        action: "route_prompt".to_string(),
        outcome: decision.action.clone(),
        detail: Some(decision.explanation.clone()),
    });

    Ok(decision)
}

// ═══════════════════════════════════════════════════════════
// Route Feedback (§5 反馈学习)
// ═══════════════════════════════════════════════════════════

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteFeedbackArgs {
    pub trace_id: String,
    pub decision_intent: String,
    pub user_action: String,
    pub override_intent: Option<String>,
}

#[tauri::command]
fn save_route_feedback(app_handle: tauri::AppHandle, args: RouteFeedbackArgs) -> CmdResult<()> {
    let fb = config::RouteFeedback {
        trace_id: args.trace_id.clone(),
        decision_intent: args.decision_intent,
        user_action: args.user_action,
        override_intent: args.override_intent,
        ts_ms: now_ms(),
    };
    config::save_route_feedback(&app_handle, &fb).map_err(|e| {
        err("ARCHIVE_WRITE_FAILED", "Failed to save route feedback", Some(e.to_string()))
    })?;

    let _ = config::write_vault_event(&app_handle, &config::VaultEvent {
        ts_ms: now_ms(),
        event_type: "RouteFeedback".to_string(),
        run_id: None,
        step_id: None,
        trace_id: args.trace_id,
        action: "save_route_feedback".to_string(),
        outcome: fb.user_action.clone(),
        detail: fb.override_intent.clone(),
    });

    Ok(())
}

fn derive_governance_records_from_run(run: &config::RunRecord) -> (
    config::ChangeRecord,
    config::QualityGateResult,
    config::ReleaseDecisionRecord,
) {
    let change_id = format!("RUN-{}", run.id);

    let mut hard_gates = HashMap::new();
    let failed = run.status == "failed";
    let security_failed = run
        .error_code
        .as_deref()
        .map(|c| c.contains("SECURITY") || c.contains("POLICY_DENIED"))
        .unwrap_or(false);
    hard_gates.insert("no_open_p0_p1".to_string(), !failed);
    hard_gates.insert("security_high_resolved".to_string(), !security_failed);
    hard_gates.insert("critical_e2e_passed".to_string(), !failed);
    hard_gates.insert("rollback_validated".to_string(), true);

    let scorecard = if failed {
        config::Scorecard {
            correctness: 2,
            stability: 2,
            performance: 3,
            ux_consistency: 3,
            security: if security_failed { 1 } else { 4 },
            maintainability: 4,
            observability: 4,
        }
    } else {
        config::Scorecard {
            correctness: 5,
            stability: 4,
            performance: 4,
            ux_consistency: 4,
            security: 5,
            maintainability: 4,
            observability: 5,
        }
    };

    let quality = config::QualityGateResult {
        change_id: change_id.clone(),
        hard_gates,
        scorecard,
    };
    let score_total = u16::from(quality.scorecard.correctness)
        + u16::from(quality.scorecard.stability)
        + u16::from(quality.scorecard.performance)
        + u16::from(quality.scorecard.ux_consistency)
        + u16::from(quality.scorecard.security)
        + u16::from(quality.scorecard.maintainability)
        + u16::from(quality.scorecard.observability);
    let release_decision = config::release_decision_from_score(score_total);

    let change = config::ChangeRecord {
        change_id: change_id.clone(),
        title: format!("Run {} governance snapshot", run.id),
        owner: "ai-workbench".to_string(),
        scope: format!("run_status={} target={}", run.status, run.target_id),
        risk_level: if failed { "medium".to_string() } else { "low".to_string() },
        run_id: Some(run.id.clone()),
        step_id: run.step_id.clone(),
        trace_id: Some(run.trace_id.clone()),
        acceptance_criteria: vec![
            "run persisted".to_string(),
            "quality gates generated".to_string(),
            "decision generated".to_string(),
        ],
        rollback_plan: "restore previous run state from vault/runs".to_string(),
    };

    let decision = config::ReleaseDecisionRecord {
        change_id,
        decision: release_decision,
        approver: "system:auto".to_string(),
        timestamp_utc: now_iso_stub(),
        evidence: vec![
            format!("vault/runs/{}.json", run.id),
            format!("vault/governance/quality/RUN-{}.json", run.id),
        ],
        notes: Some("auto-generated from run lifecycle".to_string()),
    };

    (change, quality, decision)
}

// ═══════════════════════════════════════════════════════════
// Vault 归档命令 (§2)
// ═══════════════════════════════════════════════════════════

#[tauri::command]
fn save_run(app_handle: tauri::AppHandle, run: config::RunRecord) -> CmdResult<()> {
    let run_id = run.id.clone();
    let step_id = run.step_id.clone();
    let status = run.status.clone();
    let trace_id = run.trace_id.clone();

    // §10 状态约束强制执行: 如果已有旧 run, 校验转换合法性
    if let Ok(existing_runs) = config::load_runs(&app_handle) {
        if let Some(old) = existing_runs.iter().find(|r| r.id == run_id) {
            if old.status != status && !config::validate_run_transition(&old.status, &status) {
                return Err(err(
                    "STATE_TRANSITION_INVALID",
                    &format!("非法状态转换: {} → {}", old.status, status),
                    Some(format!("合法目标: {:?}", config::valid_run_transitions(&old.status))),
                ));
            }
            // §10: archived/done 后禁止改正文
            if (old.status == "done" || old.status == "closed") && old.prompt != run.prompt {
                return Err(err(
                    "STATE_CONSTRAINT_VIOLATED",
                    "已完成的 Run 禁止修改 prompt",
                    None,
                ));
            }
        }
    }

    config::save_run(&app_handle, &run).map_err(|e| {
        err("ARCHIVE_WRITE_FAILED", "Failed to save run", Some(e.to_string()))
    })?;

    // Governance auto-generation: every run produces change/quality/decision snapshots
    let (change, quality, decision) = derive_governance_records_from_run(&run);
    config::save_change_record(&app_handle, &change).map_err(|e| {
        err("ARCHIVE_WRITE_FAILED", "Failed to save governance change record", Some(e.to_string()))
    })?;
    config::save_quality_gate_result(&app_handle, &quality).map_err(|e| {
        err("ARCHIVE_WRITE_FAILED", "Failed to save governance quality result", Some(e.to_string()))
    })?;
    config::save_release_decision(&app_handle, &decision).map_err(|e| {
        err("ARCHIVE_WRITE_FAILED", "Failed to save governance release decision", Some(e.to_string()))
    })?;

    // §38 Event Bus: emit run event via Tauri
    let event_type = match run.status.as_str() {
        "created" => "RunCreated",
        "dispatched" => "StepDispatched",
        "waiting_capture" => "StepAwaitingSend",
        "captured" => "StepCaptured",
        "failed" => "StepFailed",
        _ => "RunUpdated",
    };
    let _ = app_handle.emit("workbench-event", serde_json::json!({
        "event_type": event_type,
        "run_id": run_id.clone(),
        "step_id": step_id.clone(),
        "status": status.clone(),
        "trace_id": trace_id.clone(),
        "ts_ms": now_ms(),
    }));
    let _ = app_handle.emit("workbench-event", serde_json::json!({
        "event_type": "GovernanceUpdated",
        "run_id": run_id.clone(),
        "step_id": step_id.clone(),
        "trace_id": trace_id.clone(),
        "change": change,
        "quality": quality,
        "decision": decision,
        "ts_ms": now_ms(),
    }));

    // 写入事件日志
    let _ = config::write_vault_event(&app_handle, &config::VaultEvent {
        ts_ms: now_ms(),
        event_type: event_type.to_string(),
        run_id: Some(run.id.clone()),
        step_id: run.step_id.clone(),
        trace_id: run.trace_id.clone(),
        action: "save_run".to_string(),
        outcome: run.status.clone(),
        detail: None,
    });

    Ok(())
}

#[tauri::command]
fn load_runs(app_handle: tauri::AppHandle) -> CmdResult<Vec<config::RunRecord>> {
    config::load_runs(&app_handle).map_err(|e| {
        err("ARCHIVE_READ_FAILED", "Failed to load runs", Some(e.to_string()))
    })
}

#[tauri::command]
fn get_error_catalog() -> CmdResult<Vec<config::ErrorDefinition>> {
    Ok(config::error_catalog())
}

#[tauri::command]
fn write_event(app_handle: tauri::AppHandle, event: config::VaultEvent) -> CmdResult<()> {
    // §38 Event Bus: also emit to frontend
    let _ = app_handle.emit("workbench-event", serde_json::json!({
        "event_type": event.event_type,
        "run_id": event.run_id,
        "step_id": event.step_id,
        "trace_id": event.trace_id,
        "ts_ms": event.ts_ms,
    }));

    config::write_vault_event(&app_handle, &event).map_err(|e| {
        err("ARCHIVE_WRITE_FAILED", "Failed to write event", Some(e.to_string()))
    })
}

// ───────── Artifact Commands (§35) ─────────

#[tauri::command]
fn save_artifact(app_handle: tauri::AppHandle, artifact: config::Artifact) -> CmdResult<String> {
    let path = config::save_artifact(&app_handle, &artifact).map_err(|e| {
        err("ARCHIVE_WRITE_FAILED", "Failed to save artifact", Some(e.to_string()))
    })?;

    // §38 Event: artifact saved
    let _ = app_handle.emit("workbench-event", serde_json::json!({
        "event_type": "ArtifactSaved",
        "artifact_id": artifact.artifact_id,
        "run_id": artifact.run_id,
        "step_id": artifact.step_id,
        "ts_ms": now_ms(),
    }));

    let _ = config::write_vault_event(&app_handle, &config::VaultEvent {
        ts_ms: now_ms(),
        event_type: "ArtifactSaved".to_string(),
        run_id: Some(artifact.run_id),
        step_id: artifact.step_id,
        trace_id: artifact.artifact_id.clone(),
        action: "save_artifact".to_string(),
        outcome: "ok".to_string(),
        detail: Some(format!("type={}, producer={}", artifact.artifact_type, artifact.producer)),
    });

    Ok(path)
}

// ───────── Dispatch Trace Commands (§9.9) ─────────

#[tauri::command]
fn save_dispatch_trace(app_handle: tauri::AppHandle, trace: config::DispatchTrace) -> CmdResult<()> {
    config::save_dispatch_trace(&app_handle, &trace).map_err(|e| {
        err("ARCHIVE_WRITE_FAILED", "Failed to save dispatch trace", Some(e.to_string()))
    })
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GovernanceValidateArgs {
    #[serde(default)]
    pub change_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GovernanceLatestArgs {
    #[serde(default)]
    pub change_id: Option<String>,
}

#[tauri::command]
fn governance_validate(
    app_handle: tauri::AppHandle,
    args: GovernanceValidateArgs,
) -> CmdResult<config::GovernanceValidationReport> {
    let change_id = args.change_id.unwrap_or_else(|| {
        let mut latest = String::from("RUN-unknown");
        if let Ok(runs) = config::load_runs(&app_handle) {
            if let Some(run) = runs.first() {
                latest = format!("RUN-{}", run.id);
            }
        }
        latest
    });

    let report = config::governance_validate(&app_handle, &change_id).map_err(|e| {
        err(
            "GOVERNANCE_VALIDATE_FAILED",
            "Failed to validate governance record",
            Some(e.to_string()),
        )
    })?;

    let _ = app_handle.emit("workbench-event", serde_json::json!({
        "event_type": "GovernanceValidation",
        "change_id": change_id,
        "report": report.clone(),
        "ts_ms": now_ms(),
    }));

    Ok(report)
}

#[tauri::command]
fn governance_latest(
    app_handle: tauri::AppHandle,
    args: GovernanceLatestArgs,
) -> CmdResult<Option<config::GovernanceSnapshot>> {
    let change_id = args.change_id.unwrap_or_else(|| {
        let mut latest = String::from("RUN-unknown");
        if let Ok(runs) = config::load_runs(&app_handle) {
            if let Some(run) = runs.first() {
                latest = format!("RUN-{}", run.id);
            }
        }
        latest
    });
    config::governance_latest(&app_handle, &change_id).map_err(|e| {
        err(
            "GOVERNANCE_READ_FAILED",
            "Failed to load governance snapshot",
            Some(e.to_string()),
        )
    })
}

#[tauri::command]
fn governance_emit_telemetry(
    app_handle: tauri::AppHandle,
    event: config::TelemetryEvent,
) -> CmdResult<()> {
    config::save_telemetry_event(&app_handle, &event).map_err(|e| {
        err(
            "TELEMETRY_WRITE_FAILED",
            "Failed to write telemetry event",
            Some(e.to_string()),
        )
    })?;
    let _ = app_handle.emit("workbench-event", serde_json::json!({
        "event_type": "TelemetryEmitted",
        "change_id": event.change_id,
        "run_id": event.run_id,
        "step_id": event.step_id,
        "trace_id": event.trace_id,
        "ts_ms": now_ms(),
    }));
    Ok(())
}

/// §99 Vault 统计 — 返回存档目录大小和文件数量
#[tauri::command]
fn get_vault_stats(app_handle: tauri::AppHandle) -> CmdResult<serde_json::Value> {
    let vault = config::vault_dir(&app_handle);
    let mut total_bytes: u64 = 0;
    let mut file_count: u64 = 0;
    let mut by_subdir: HashMap<String, u64> = HashMap::new();

    if vault.exists() {
        for e in fs::read_dir(&vault)
            .unwrap_or_else(|_| fs::read_dir(std::env::temp_dir()).unwrap())
            .flatten()
        {
            let path = e.path();
            let dir_name = e.file_name().to_string_lossy().to_string();
            let mut dir_bytes: u64 = 0;
            if path.is_dir() {
                if let Ok(subentries) = fs::read_dir(&path) {
                    for sub in subentries.flatten() {
                        if let Ok(meta) = sub.path().metadata() {
                            let len = meta.len();
                            dir_bytes += len;
                            total_bytes += len;
                            file_count += 1;
                        }
                    }
                }
            } else if let Ok(meta) = path.metadata() {
                dir_bytes = meta.len();
                total_bytes += dir_bytes;
                file_count += 1;
            }
            by_subdir.insert(dir_name, dir_bytes);
        }
    }

    Ok(serde_json::json!({
        "vault_path": vault.to_string_lossy(),
        "total_bytes": total_bytes,
        "total_kb": total_bytes / 1024,
        "file_count": file_count,
        "by_subdir": by_subdir,
    }))
}

/// §100 Vault 清理 — 删除超过指定天数的 Run 记录
#[tauri::command]
fn cleanup_vault(app_handle: tauri::AppHandle, older_than_days: u32) -> CmdResult<u32> {
    if older_than_days == 0 {
        return Err(err("INVALID_ARG", "older_than_days must be > 0", None));
    }
    let max_age_ms = older_than_days as u64 * 86_400_000;
    let now = now_ms() as u64;
    let runs_dir = config::vault_dir(&app_handle).join("runs");
    let mut deleted = 0u32;

    if runs_dir.exists() {
        if let Ok(entries) = fs::read_dir(&runs_dir) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.extension().and_then(|e| e.to_str()) != Some("json") {
                    continue;
                }
                if let Ok(content) = fs::read_to_string(&path) {
                    if let Ok(run) = serde_json::from_str::<config::RunRecord>(&content) {
                        if now.saturating_sub(run.ts_start as u64) > max_age_ms {
                            let _ = fs::remove_file(&path);
                            deleted += 1;
                        }
                    }
                }
            }
        }
    }

    tracing::info!("vault_cleanup: deleted {} runs older than {} days", deleted, older_than_days);
    Ok(deleted)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            config::ensure_config_dir(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            os_enum_windows,
            os_activate,
            os_find_window_by_title_regex,
            os_clipboard_get_text,
            os_clipboard_set_text,
            os_dispatch_paste,
            load_targets_config,
            save_targets_config,
            load_skills,
            load_workflows,
            load_router_rules,
            health_check,
            route_prompt,
            save_run,
            load_runs,
            get_error_catalog,
            write_event,
            preflight_target,
            dispatch_stage,
            dispatch_confirm,
            get_foreground_hwnd,
            detect_browsers,
            get_self_heal_registry,
            validate_run_transition,
            save_artifact,
            save_dispatch_trace,
            save_route_feedback,
            governance_validate,
            governance_latest,
            governance_emit_telemetry,
            get_vault_stats,
            cleanup_vault,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod governance_tests {
    use super::*;

    fn sample_run(status: &str, error_code: Option<&str>) -> config::RunRecord {
        config::RunRecord {
            id: "run-ut-001".to_string(),
            ts_start: 1,
            ts_end: None,
            skill_id: "skill.demo".to_string(),
            workflow_id: None,
            step_id: Some("step-1".to_string()),
            target_id: "chatgpt_main".to_string(),
            provider: "chatgpt".to_string(),
            prompt: "demo prompt".to_string(),
            output: None,
            status: status.to_string(),
            error_code: error_code.map(|s| s.to_string()),
            trace_id: "trace-ut-001".to_string(),
            route_decision: None,
            steps: vec![],
            artifact_ids: vec![],
            confirm_source: None,
            browser_id: None,
            browser_candidates: vec![],
            injection_audit: None,
        }
    }

    #[test]
    fn derive_governance_records_success_path() {
        let run = sample_run("dispatched", None);
        let (_change, quality, decision) = derive_governance_records_from_run(&run);
        assert_eq!(quality.hard_gates.get("no_open_p0_p1"), Some(&true));
        assert!(matches!(decision.decision, config::ReleaseDecision::Go));
    }

    #[test]
    fn derive_governance_records_failure_path() {
        let run = sample_run("failed", Some("POLICY_DENIED"));
        let (_change, quality, decision) = derive_governance_records_from_run(&run);
        assert_eq!(quality.hard_gates.get("no_open_p0_p1"), Some(&false));
        assert_eq!(quality.hard_gates.get("security_high_resolved"), Some(&false));
        assert!(matches!(
            decision.decision,
            config::ReleaseDecision::GoWithRisk | config::ReleaseDecision::NoGo
        ));
    }
}
