use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs::{self, OpenOptions};

fn atomic_write<P: AsRef<std::path::Path>, C: AsRef<[u8]>>(
    path: P,
    contents: C,
) -> std::io::Result<()> {
    let path = path.as_ref();
    let tmp_path = path.with_extension("tmp");
    std::fs::write(&tmp_path, contents)?;
    std::fs::rename(&tmp_path, path)
}
use std::io::Write as IoWrite;
use std::path::PathBuf;
use tauri::Manager;

// ───────── Target Config (§9.1 多因子指纹) ─────────

/// 多因子窗口指纹 — route.md §9.1
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetMatchConfig {
    #[serde(default)]
    pub title_regex: Vec<String>,
    /// 绑定的 hwnd（主匹配 §9.1）
    #[serde(default)]
    pub bound_hwnd: Option<u64>,
    /// 进程名（exe_name）匹配
    #[serde(default)]
    pub exe_name: Option<String>,
    /// 窗口类名匹配
    #[serde(default)]
    pub class_name: Option<String>,
    /// 进程 ID（短期绑定，重启后失效）
    #[serde(default)]
    pub process_id: Option<u32>,
}

/// §9.3 TargetStatus 状态机
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum TargetStatus {
    Ready,
    Missing,
    Ambiguous,
    NeedsRebind,
    Inactive,
}

/// §9.3 预检查结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PreflightResult {
    pub target_id: String,
    pub status: TargetStatus,
    pub matched_hwnd: Option<u64>,
    pub matched_title: Option<String>,
    pub candidate_count: usize,
    pub suggestion: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetBehavior {
    #[serde(default)]
    pub auto_enter: bool,
    #[serde(default = "default_paste_delay")]
    pub paste_delay_ms: u64,
    /// §9.6 粘贴后恢复剪贴板
    #[serde(default)]
    pub restore_clipboard_after_paste: bool,
    /// §9.7 焦点配方（激活后先跑配方再粘贴）
    #[serde(default)]
    pub focus_recipe: Vec<String>,
    /// §9.8 是否附加 Run-ID 水印
    #[serde(default = "default_true")]
    pub append_run_watermark: bool,
}

fn default_paste_delay() -> u64 {
    80
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetEntry {
    pub provider: String,
    #[serde(rename = "match")]
    pub match_config: TargetMatchConfig,
    pub behavior: TargetBehavior,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetDefaults {
    #[serde(default = "default_activate_retry")]
    pub activate_retry: u32,
    #[serde(default = "default_fail_fast")]
    pub fail_fast_ms: u64,
}

fn default_activate_retry() -> u32 {
    3
}
fn default_fail_fast() -> u64 {
    2500
}

impl Default for TargetDefaults {
    fn default() -> Self {
        Self {
            activate_retry: 3,
            fail_fast_ms: 2500,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetsConfig {
    #[serde(default)]
    pub targets: HashMap<String, TargetEntry>,
    #[serde(default)]
    pub defaults: TargetDefaults,
}

impl Default for TargetsConfig {
    fn default() -> Self {
        let mut targets = HashMap::new();
        for (id, provider, regexes) in [
            (
                "chatgpt_main",
                "chatgpt",
                vec![
                    "ChatGPT.*Mozilla Firefox".to_string(),
                    "ChatGPT.*(Chrome|Chromium|Microsoft Edge|Brave)".to_string(),
                ],
            ),
            (
                "gemini_main",
                "gemini",
                vec![
                    "Gemini.*Mozilla Firefox".to_string(),
                    "Gemini.*(Chrome|Chromium|Microsoft Edge|Brave)".to_string(),
                ],
            ),
            (
                "grok_main",
                "grok",
                vec![
                    "Grok.*Mozilla Firefox".to_string(),
                    "Grok.*(Chrome|Chromium|Microsoft Edge|Brave)".to_string(),
                ],
            ),
            (
                "deepseek_main",
                "deepseek",
                vec![
                    "DeepSeek.*Mozilla Firefox".to_string(),
                    "DeepSeek.*(Chrome|Chromium|Microsoft Edge|Brave)".to_string(),
                ],
            ),
            (
                "kimi_main",
                "kimi",
                vec![
                    "Kimi.*Mozilla Firefox".to_string(),
                    "Kimi.*(Chrome|Chromium|Microsoft Edge|Brave)".to_string(),
                ],
            ),
            (
                "yuanbao_main",
                "yuanbao",
                vec![
                    "元宝.*Mozilla Firefox".to_string(),
                    "Yuanbao.*Mozilla Firefox".to_string(),
                    "(元宝|Yuanbao).*(Chrome|Chromium|Microsoft Edge|Brave)".to_string(),
                ],
            ),
        ] {
            targets.insert(
                id.to_string(),
                TargetEntry {
                    provider: provider.to_string(),
                    match_config: TargetMatchConfig {
                        title_regex: regexes,
                        bound_hwnd: None,
                        exe_name: None,
                        class_name: None,
                        process_id: None,
                    },
                    behavior: TargetBehavior {
                        auto_enter: false,
                        paste_delay_ms: 80,
                        restore_clipboard_after_paste: false,
                        focus_recipe: vec![],
                        append_run_watermark: true,
                    },
                },
            );
        }

        Self {
            targets,
            defaults: TargetDefaults::default(),
        }
    }
}

// ───────── Self-Heal Registry (§8) ─────────

/// 自愈动作注册 — route.md §8
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SelfHealAction {
    pub strategy_id: String,
    pub description: String,
    pub action_type: String, // "retry" | "retry_with_backoff" | "reset_config" | "delay_retry" | "retry_activate" | "escalate"
    pub max_attempts: u32,
    pub cooldown_ms: u64,
}

/// 自愈注册表 — 错误码→修复策略
pub fn self_heal_registry() -> Vec<SelfHealAction> {
    vec![
        SelfHealAction {
            strategy_id: "retry_activate".into(),
            description: "重新激活目标窗口".into(),
            action_type: "retry".into(),
            max_attempts: 3,
            cooldown_ms: 500,
        },
        SelfHealAction {
            strategy_id: "delay_retry".into(),
            description: "等待后重试".into(),
            action_type: "retry_with_backoff".into(),
            max_attempts: 3,
            cooldown_ms: 1000,
        },
        SelfHealAction {
            strategy_id: "retry_with_backoff".into(),
            description: "指数退避重试".into(),
            action_type: "retry_with_backoff".into(),
            max_attempts: 3,
            cooldown_ms: 2000,
        },
        SelfHealAction {
            strategy_id: "reset_config".into(),
            description: "重置配置为默认值".into(),
            action_type: "reset_config".into(),
            max_attempts: 1,
            cooldown_ms: 0,
        },
        SelfHealAction {
            strategy_id: "escalate".into(),
            description: "升级为人工处理".into(),
            action_type: "escalate".into(),
            max_attempts: 1,
            cooldown_ms: 0,
        },
    ]
}

// ───────── Run Status Constraints (§10) ─────────

/// Run 状态机有效转换表 — route.md §10
pub fn valid_run_transitions(from: &str) -> Vec<&'static str> {
    match from {
        "created" => vec!["dispatched", "failed", "cancelled"],
        "dispatched" => vec!["waiting_capture", "captured", "failed", "cancelled"],
        "waiting_capture" => vec!["captured", "failed", "cancelled"],
        "captured" => vec!["done", "failed"],
        "failed" => vec!["compensating", "closed"],
        "compensating" => vec!["done", "closed", "failed"],
        "done" | "closed" | "cancelled" => vec![], // terminal states
        _ => vec![],
    }
}

/// 验证状态转换是否合法
pub fn validate_run_transition(from: &str, to: &str) -> bool {
    valid_run_transitions(from).contains(&to)
}

// ───────── Skill Schema v3 ─────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillInput {
    #[serde(rename = "type")]
    pub input_type: String,
    #[serde(default)]
    pub required: bool,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub max_length: Option<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillDispatch {
    #[serde(default = "default_dispatch_mode")]
    pub mode: String,
    #[serde(default)]
    pub prefer_providers: Vec<String>,
    pub fixed_target: Option<String>,
    #[serde(default)]
    pub fanout_targets: Vec<String>,
    #[serde(default = "default_timeout_ms")]
    pub timeout_ms: u64,
    #[serde(default = "default_retry_count")]
    pub retry_count: u32,
}

fn default_dispatch_mode() -> String {
    "prefer_provider".to_string()
}
fn default_timeout_ms() -> u64 {
    30_000
}
fn default_retry_count() -> u32 {
    2
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityGate {
    #[serde(default)]
    pub min_length: Option<usize>,
    #[serde(default)]
    pub max_length: Option<usize>,
    #[serde(default)]
    pub must_contain: Vec<String>,
    #[serde(default)]
    pub must_not_contain: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillFallback {
    #[serde(default)]
    pub fallback_providers: Vec<String>,
    #[serde(default)]
    pub fallback_skill: Option<String>,
    #[serde(default = "default_fallback_action")]
    pub action: String,
}

fn default_fallback_action() -> String {
    "retry_next_provider".to_string()
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkillObservability {
    #[serde(default = "default_true")]
    pub emit_start: bool,
    #[serde(default = "default_true")]
    pub emit_end: bool,
    #[serde(default = "default_true")]
    pub emit_error: bool,
    #[serde(default)]
    pub custom_metrics: Vec<String>,
}

fn default_true() -> bool {
    true
}

/// Skill Schema v3 — route.md §6 完整实现
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Skill {
    // ─── 必填字段 (§6) ───
    pub id: String,
    #[serde(default = "default_version")]
    pub version: String,
    pub title: String,
    #[serde(default)]
    pub intent_tags: Vec<String>,
    #[serde(default)]
    pub inputs: HashMap<String, SkillInput>,
    #[serde(rename = "prompt_template", alias = "prompt")]
    pub prompt_template: String,
    #[serde(default)]
    pub dispatch: Option<SkillDispatch>,
    #[serde(default)]
    pub quality_gates: Vec<QualityGate>,
    #[serde(default)]
    pub fallbacks: Vec<SkillFallback>,
    #[serde(default)]
    pub observability: Option<SkillObservability>,
    // ─── 高级字段 (§6) ───
    #[serde(default)]
    pub preconditions: Vec<String>,
    #[serde(default)]
    pub postconditions: Vec<String>,
    #[serde(default = "default_safety_level")]
    pub safety_level: String,
    #[serde(default = "default_cost_class")]
    pub cost_class: String,
    #[serde(default = "default_latency_class")]
    pub latency_class: String,
    #[serde(default = "default_determinism")]
    pub determinism: String,
    #[serde(default)]
    pub cache_policy: Option<String>,
}

fn default_version() -> String {
    "1.0.0".to_string()
}
fn default_safety_level() -> String {
    "normal".to_string()
}
fn default_cost_class() -> String {
    "low".to_string()
}
fn default_latency_class() -> String {
    "medium".to_string()
}
fn default_determinism() -> String {
    "non_deterministic".to_string()
}

// ───────── Workflow Schema v3 (DAG++) ─────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RetryPolicy {
    #[serde(default = "default_retry_count")]
    pub max_retries: u32,
    #[serde(default = "default_retry_delay")]
    pub delay_ms: u64,
    #[serde(default = "default_backoff")]
    pub backoff: String,
}

fn default_retry_delay() -> u64 {
    1000
}
fn default_backoff() -> String {
    "exponential".to_string()
}

impl Default for RetryPolicy {
    fn default() -> Self {
        Self {
            max_retries: 2,
            delay_ms: 1000,
            backoff: "exponential".to_string(),
        }
    }
}

/// Workflow Step — route.md §7 全部必填字段
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowStep {
    pub id: Option<String>,
    #[serde(rename = "use")]
    pub use_skill: String,
    #[serde(default)]
    pub depends_on: Vec<String>,
    #[serde(default)]
    pub retry_policy: Option<RetryPolicy>,
    #[serde(default = "default_timeout_ms")]
    pub timeout_ms: u64,
    #[serde(default)]
    pub compensation: Option<String>,
    #[serde(default)]
    pub emit_events: Vec<String>,
    #[serde(default)]
    pub dispatch: Option<SkillDispatch>,
}

/// Workflow 图级策略 — route.md §7
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkflowPolicy {
    #[serde(default = "default_max_parallelism")]
    pub max_parallelism: u32,
    #[serde(default = "default_global_timeout")]
    pub global_timeout_ms: u64,
    #[serde(default = "default_fail_policy")]
    pub fail_policy: String,
    #[serde(default = "default_checkpoint_policy")]
    pub checkpoint_policy: String,
    #[serde(default = "default_resume_policy")]
    pub resume_policy: String,
    #[serde(default = "default_merge_strategy")]
    pub merge_strategy: String,
}

fn default_max_parallelism() -> u32 {
    2
}
fn default_global_timeout() -> u64 {
    120_000
}
fn default_fail_policy() -> String {
    "fail_fast".to_string()
}
fn default_checkpoint_policy() -> String {
    "per_step".to_string()
}
fn default_resume_policy() -> String {
    "from_last_checkpoint".to_string()
}
fn default_merge_strategy() -> String {
    "first_success".to_string()
}

impl Default for WorkflowPolicy {
    fn default() -> Self {
        Self {
            max_parallelism: 2,
            global_timeout_ms: 120_000,
            fail_policy: "fail_fast".to_string(),
            checkpoint_policy: "per_step".to_string(),
            resume_policy: "from_last_checkpoint".to_string(),
            merge_strategy: "first_success".to_string(),
        }
    }
}

/// Workflow Schema v3 — route.md §7
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Workflow {
    pub id: String,
    #[serde(default = "default_version")]
    pub version: String,
    pub title: String,
    pub steps: Vec<WorkflowStep>,
    #[serde(default)]
    pub policy: WorkflowPolicy,
}

// ───────── Router Rules Engine v2 (§5) ─────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntentRule {
    #[serde(default)]
    pub keywords: Vec<String>,
    #[serde(default)]
    pub patterns: Vec<String>,
    #[serde(default)]
    pub dispatch_prefer: Vec<String>,
    #[serde(default)]
    pub fanout: bool,
    #[serde(default = "default_confidence_boost")]
    pub confidence_boost: f64,
}

fn default_confidence_boost() -> f64 {
    0.0
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouterDefaults {
    #[serde(default)]
    pub fanout: bool,
    #[serde(default)]
    pub auto_enter: bool,
    #[serde(default = "default_confidence_auto")]
    pub confidence_auto_threshold: f64,
    #[serde(default = "default_confidence_confirm")]
    pub confidence_confirm_threshold: f64,
}

fn default_confidence_auto() -> f64 {
    0.8
}
fn default_confidence_confirm() -> f64 {
    0.6
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouterRulesConfig {
    #[serde(default)]
    pub intents: HashMap<String, IntentRule>,
    #[serde(default)]
    pub defaults: Option<RouterDefaults>,
}

/// 规则引擎决策候选项（§5 决策输出）
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteCandidate {
    pub intent: String,
    pub score: f64,
    pub providers: Vec<String>,
    pub matched_rule_id: String,
    pub match_type: String,
    pub score_breakdown: HashMap<String, f64>,
    pub fanout: bool,
}

/// 规则引擎完整决策输出
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteDecision {
    pub top_candidates: Vec<RouteCandidate>,
    pub selected: Option<RouteCandidate>,
    pub confidence: f64,
    pub action: String, // "auto_execute" | "user_confirm" | "fallback_default"
    pub explanation: String,
    pub trace_id: String,
}

// ───────── Unified Error Model (§9) ─────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorDefinition {
    pub code: String,
    pub category: String,
    pub user_message: String,
    pub fix_suggestion: String,
    pub alert_level: String,
    pub auto_fix_strategy: Option<String>,
}

/// 统一错误码目录 — route.md §9
pub fn error_catalog() -> Vec<ErrorDefinition> {
    vec![
        ErrorDefinition {
            code: "INPUT_EMPTY".into(),
            category: "INPUT".into(),
            user_message: "输入内容为空".into(),
            fix_suggestion: "请输入非空文本".into(),
            alert_level: "warn".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "INPUT_TOO_LONG".into(),
            category: "INPUT".into(),
            user_message: "输入超出长度限制".into(),
            fix_suggestion: "缩短输入文本后重试".into(),
            alert_level: "warn".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "INPUT_INVALID_FORMAT".into(),
            category: "INPUT".into(),
            user_message: "输入格式无效".into(),
            fix_suggestion: "检查输入格式".into(),
            alert_level: "warn".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "PAYLOAD_TOO_LARGE".into(),
            category: "INPUT".into(),
            user_message: "内容超出载荷限制".into(),
            fix_suggestion: "缩短 prompt 后重试".into(),
            alert_level: "warn".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "TARGET_NOT_FOUND".into(),
            category: "TARGET".into(),
            user_message: "未找到匹配的目标窗口".into(),
            fix_suggestion: "请先打开目标 AI 网页端".into(),
            alert_level: "error".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "TARGET_ACTIVATE_FAILED".into(),
            category: "TARGET".into(),
            user_message: "目标窗口无法激活".into(),
            fix_suggestion: "手动切换到窗口后重试".into(),
            alert_level: "error".into(),
            auto_fix_strategy: Some("retry_activate".into()),
        },
        ErrorDefinition {
            code: "DISPATCH_RATE_LIMITED".into(),
            category: "DISPATCH".into(),
            user_message: "投递过于频繁".into(),
            fix_suggestion: "等待片刻后重试".into(),
            alert_level: "warn".into(),
            auto_fix_strategy: Some("delay_retry".into()),
        },
        ErrorDefinition {
            code: "DISPATCH_TIMEOUT".into(),
            category: "DISPATCH".into(),
            user_message: "投递超时".into(),
            fix_suggestion: "检查目标窗口是否响应".into(),
            alert_level: "error".into(),
            auto_fix_strategy: Some("retry_with_backoff".into()),
        },
        ErrorDefinition {
            code: "DISPATCH_FAILED".into(),
            category: "DISPATCH".into(),
            user_message: "投递失败".into(),
            fix_suggestion: "检查窗口状态后重试".into(),
            alert_level: "error".into(),
            auto_fix_strategy: Some("retry_activate".into()),
        },
        ErrorDefinition {
            code: "DISPATCH_DUPLICATE_CONFIRM".into(),
            category: "DISPATCH".into(),
            user_message: "重复确认发送（幂等保护）".into(),
            fix_suggestion: "该发送已确认，无需重复操作".into(),
            alert_level: "info".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "CLIPBOARD_BUSY".into(),
            category: "CLIPBOARD".into(),
            user_message: "剪贴板被占用".into(),
            fix_suggestion: "关闭占用剪贴板的程序后重试".into(),
            alert_level: "warn".into(),
            auto_fix_strategy: Some("delay_retry".into()),
        },
        ErrorDefinition {
            code: "CLIPBOARD_FAILED".into(),
            category: "CLIPBOARD".into(),
            user_message: "剪贴板操作失败".into(),
            fix_suggestion: "清空剪贴板后重试".into(),
            alert_level: "error".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "CONFIG_LOAD_FAILED".into(),
            category: "CONFIG".into(),
            user_message: "配置文件加载失败".into(),
            fix_suggestion: "检查配置文件格式".into(),
            alert_level: "error".into(),
            auto_fix_strategy: Some("reset_config".into()),
        },
        ErrorDefinition {
            code: "CONFIG_SAVE_FAILED".into(),
            category: "CONFIG".into(),
            user_message: "配置保存失败".into(),
            fix_suggestion: "检查磁盘空间与权限".into(),
            alert_level: "error".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "CONFIG_INVALID".into(),
            category: "CONFIG".into(),
            user_message: "配置格式无效".into(),
            fix_suggestion: "参考默认配置模板修复".into(),
            alert_level: "error".into(),
            auto_fix_strategy: Some("reset_config".into()),
        },
        ErrorDefinition {
            code: "POLICY_DENIED".into(),
            category: "POLICY".into(),
            user_message: "安全策略阻止了此操作".into(),
            fix_suggestion: "检查安全策略配置".into(),
            alert_level: "critical".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "POLICY_APPROVAL_TIMEOUT".into(),
            category: "POLICY".into(),
            user_message: "审批超时自动拒绝".into(),
            fix_suggestion: "重新发起审批".into(),
            alert_level: "warn".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "APPROVAL_REQUIRED".into(),
            category: "APPROVAL".into(),
            user_message: "此操作需要二次确认".into(),
            fix_suggestion: "确认后继续".into(),
            alert_level: "info".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "PLUGIN_LOAD_FAILED".into(),
            category: "PLUGIN".into(),
            user_message: "插件加载失败".into(),
            fix_suggestion: "检查插件版本兼容性".into(),
            alert_level: "error".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "PLUGIN_SIGNATURE_INVALID".into(),
            category: "PLUGIN".into(),
            user_message: "插件签名校验失败".into(),
            fix_suggestion: "使用受信任的插件".into(),
            alert_level: "critical".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "ARCHIVE_WRITE_FAILED".into(),
            category: "ARCHIVE".into(),
            user_message: "归档写入失败".into(),
            fix_suggestion: "检查磁盘空间".into(),
            alert_level: "warn".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "ARCHIVE_READ_FAILED".into(),
            category: "ARCHIVE".into(),
            user_message: "归档读取失败".into(),
            fix_suggestion: "检查文件完整性".into(),
            alert_level: "warn".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "INTERNAL_ERROR".into(),
            category: "INTERNAL".into(),
            user_message: "内部系统错误".into(),
            fix_suggestion: "重启应用后重试".into(),
            alert_level: "critical".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "INTERNAL_LOCK_POISONED".into(),
            category: "INTERNAL".into(),
            user_message: "内部锁状态异常".into(),
            fix_suggestion: "重启应用".into(),
            alert_level: "critical".into(),
            auto_fix_strategy: None,
        },
        // §66 BROWSER_* — 浏览器智能检测与选择
        ErrorDefinition {
            code: "BROWSER_NOT_AVAILABLE".into(),
            category: "BROWSER".into(),
            user_message: "未检测到可用的浏览器窗口".into(),
            fix_suggestion: "请打开目标浏览器后重试".into(),
            alert_level: "error".into(),
            auto_fix_strategy: Some("redetect_browser".into()),
        },
        ErrorDefinition {
            code: "BROWSER_SELECT_CONFLICT".into(),
            category: "BROWSER".into(),
            user_message: "多个浏览器窗口冲突，无法自动选择".into(),
            fix_suggestion: "请手动选择目标浏览器窗口".into(),
            alert_level: "warn".into(),
            auto_fix_strategy: Some("manual_select".into()),
        },
        ErrorDefinition {
            code: "BROWSER_FALLBACK_FAILED".into(),
            category: "BROWSER".into(),
            user_message: "浏览器回退失败".into(),
            fix_suggestion: "尝试进入绑定向导重新绑定".into(),
            alert_level: "error".into(),
            auto_fix_strategy: Some("bind_wizard".into()),
        },
        // §66 CAPTURE_* — 输出采集
        ErrorDefinition {
            code: "CAPTURE_EMPTY".into(),
            category: "CAPTURE".into(),
            user_message: "采集到的输出内容为空".into(),
            fix_suggestion: "请复制模型输出后重试".into(),
            alert_level: "warn".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "CAPTURE_WATERMARK_MISSING".into(),
            category: "CAPTURE".into(),
            user_message: "输出中缺少 Run-ID 水印".into(),
            fix_suggestion: "请手动选择归档目标 step".into(),
            alert_level: "info".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "CAPTURE_BIND_FAILED".into(),
            category: "CAPTURE".into(),
            user_message: "输出与 step 绑定失败".into(),
            fix_suggestion: "手动选择归档到具体 step".into(),
            alert_level: "warn".into(),
            auto_fix_strategy: None,
        },
        // §66 GOVERNANCE_* — 治理门禁
        ErrorDefinition {
            code: "GOVERNANCE_VALIDATE_FAILED".into(),
            category: "GOVERNANCE".into(),
            user_message: "治理门禁验证失败".into(),
            fix_suggestion: "检查变更记录和质量门禁是否完整".into(),
            alert_level: "error".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "GOVERNANCE_EVIDENCE_MISSING".into(),
            category: "GOVERNANCE".into(),
            user_message: "证据包生成不完整".into(),
            fix_suggestion: "补充缺失的验证记录".into(),
            alert_level: "warn".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "GOVERNANCE_DECISION_CONFLICT".into(),
            category: "GOVERNANCE".into(),
            user_message: "门禁评分与决策结论不一致".into(),
            fix_suggestion: "检查评分卡与硬门禁结果".into(),
            alert_level: "error".into(),
            auto_fix_strategy: None,
        },
        // §66 UI_* — 前端渲染与状态异常
        ErrorDefinition {
            code: "UI_STATE_INVALID".into(),
            category: "UI".into(),
            user_message: "页面状态异常".into(),
            fix_suggestion: "刷新页面恢复到初始状态".into(),
            alert_level: "warn".into(),
            auto_fix_strategy: Some("refresh_page".into()),
        },
        ErrorDefinition {
            code: "UI_RENDER_ERROR".into(),
            category: "UI".into(),
            user_message: "页面渲染异常".into(),
            fix_suggestion: "刷新页面后重试".into(),
            alert_level: "error".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "UI_EVENT_BUS_STALE".into(),
            category: "UI".into(),
            user_message: "事件总线消息过期或乱序".into(),
            fix_suggestion: "刷新列表获取最新状态".into(),
            alert_level: "info".into(),
            auto_fix_strategy: Some("refresh_data".into()),
        },
        // §66 DISPATCH_* additional
        ErrorDefinition {
            code: "DISPATCH_FOCUS_DRIFT".into(),
            category: "DISPATCH".into(),
            user_message: "投递过程中焦点发生漂移".into(),
            fix_suggestion: "重新激活目标窗口后重试".into(),
            alert_level: "error".into(),
            auto_fix_strategy: Some("retry_activate".into()),
        },
        // §66 STATE_* for completeness
        ErrorDefinition {
            code: "STATE_TRANSITION_INVALID".into(),
            category: "INTERNAL".into(),
            user_message: "非法状态转换".into(),
            fix_suggestion: "刷新状态后重试".into(),
            alert_level: "error".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "STATE_CONSTRAINT_VIOLATED".into(),
            category: "INTERNAL".into(),
            user_message: "状态约束被违反".into(),
            fix_suggestion: "已完成的记录禁止修改".into(),
            alert_level: "error".into(),
            auto_fix_strategy: None,
        },
        // ───────── SECURITY_* — 安全防护 ─────────
        ErrorDefinition {
            code: "SECURITY_PROMPT_INJECTION".into(),
            category: "SECURITY".into(),
            user_message: "检测到可疑 Prompt 注入".into(),
            fix_suggestion: "请移除可疑指令后重试".into(),
            alert_level: "critical".into(),
            auto_fix_strategy: Some("sanitize_input".into()),
        },
        ErrorDefinition {
            code: "SECURITY_RATE_LIMIT_EXCEEDED".into(),
            category: "SECURITY".into(),
            user_message: "操作频率超出安全阈值".into(),
            fix_suggestion: "请等待冷却期后重试".into(),
            alert_level: "warn".into(),
            auto_fix_strategy: Some("delay_retry".into()),
        },
        ErrorDefinition {
            code: "SECURITY_UNAUTHORIZED".into(),
            category: "SECURITY".into(),
            user_message: "未授权的操作".into(),
            fix_suggestion: "请确认操作权限".into(),
            alert_level: "critical".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "SECURITY_INPUT_SANITIZE_FAILED".into(),
            category: "SECURITY".into(),
            user_message: "输入消毒失败".into(),
            fix_suggestion: "请检查输入内容是否包含恶意代码".into(),
            alert_level: "error".into(),
            auto_fix_strategy: Some("sanitize_input".into()),
        },
        ErrorDefinition {
            code: "SECURITY_PII_DETECTED".into(),
            category: "SECURITY".into(),
            user_message: "检测到个人敏感信息（PII）".into(),
            fix_suggestion: "请移除身份证号、手机号等敏感信息".into(),
            alert_level: "warn".into(),
            auto_fix_strategy: Some("redact_pii".into()),
        },
        ErrorDefinition {
            code: "SECURITY_OUTPUT_VALIDATION_FAILED".into(),
            category: "SECURITY".into(),
            user_message: "输出安全校验未通过".into(),
            fix_suggestion: "输出包含受限内容，已自动过滤".into(),
            alert_level: "warn".into(),
            auto_fix_strategy: Some("filter_output".into()),
        },
        // ───────── AGENT_* — Agent 模式 ─────────
        ErrorDefinition {
            code: "AGENT_LOOP_DETECTED".into(),
            category: "AGENT".into(),
            user_message: "检测到 Agent 执行循环".into(),
            fix_suggestion: "已自动中断循环，请调整任务描述后重试".into(),
            alert_level: "error".into(),
            auto_fix_strategy: Some("break_loop".into()),
        },
        ErrorDefinition {
            code: "AGENT_MAX_STEPS_EXCEEDED".into(),
            category: "AGENT".into(),
            user_message: "Agent 执行步骤超过上限".into(),
            fix_suggestion: "请缩小任务范围或增大步骤限制".into(),
            alert_level: "warn".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "AGENT_BUDGET_EXCEEDED".into(),
            category: "AGENT".into(),
            user_message: "Agent 预算已耗尽".into(),
            fix_suggestion: "当前任务预算不足，请调整预算或简化任务".into(),
            alert_level: "error".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "AGENT_PRECONDITION_FAILED".into(),
            category: "AGENT".into(),
            user_message: "Agent 前置条件未满足".into(),
            fix_suggestion: "请确认已启用 Agent 模式并完成预算检查".into(),
            alert_level: "warn".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "AGENT_OUTPUT_UNSAFE".into(),
            category: "AGENT".into(),
            user_message: "Agent 输出未通过安全扫描".into(),
            fix_suggestion: "输出包含潜在风险内容，已拦截".into(),
            alert_level: "critical".into(),
            auto_fix_strategy: Some("filter_output".into()),
        },
        // ───────── CLOSED_LOOP_* — 闭环检测 ─────────
        ErrorDefinition {
            code: "CLOSED_LOOP_TIMEOUT".into(),
            category: "CLOSED_LOOP".into(),
            user_message: "闭环流程超时".into(),
            fix_suggestion: "检查目标窗口响应状态".into(),
            alert_level: "error".into(),
            auto_fix_strategy: Some("retry_with_backoff".into()),
        },
        ErrorDefinition {
            code: "CLOSED_LOOP_QUALITY_FAIL".into(),
            category: "CLOSED_LOOP".into(),
            user_message: "闭环质量门未通过".into(),
            fix_suggestion: "输出不满足质量要求，请重新投递或调整参数".into(),
            alert_level: "warn".into(),
            auto_fix_strategy: None,
        },
        ErrorDefinition {
            code: "CLOSED_LOOP_INCONSISTENT".into(),
            category: "CLOSED_LOOP".into(),
            user_message: "闭环状态不一致".into(),
            fix_suggestion: "检测到状态不一致，请刷新后重试".into(),
            alert_level: "error".into(),
            auto_fix_strategy: Some("refresh_data".into()),
        },
    ]
}

// ───────── Artifact Model (§35 统一输入/输出模型) ─────────

/// Artifact 统一制品 — route.md §35
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Artifact {
    pub artifact_id: String,
    pub run_id: String,
    #[serde(default)]
    pub step_id: Option<String>,
    /// text | markdown | json | file
    #[serde(rename = "type")]
    pub artifact_type: String,
    /// user | collector | grok | gemini | chatgpt_plus | deepseek | kimi 等
    pub producer: String,
    #[serde(default)]
    pub path: Option<String>,
    pub created_at: u128,
    #[serde(default)]
    pub checksum: Option<String>,
    #[serde(default)]
    pub content: Option<String>,
}

// ───────── Step Status Machine (§37 Run/Step 状态机) ─────────

/// Step 状态 — route.md §37
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum StepStatus {
    Pending,
    Dispatched,
    AwaitingSend,
    WaitingOutput,
    Captured,
    Failed,
}

/// Step 归档记录 — route.md §37
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StepRecord {
    pub id: String,
    pub run_id: String,
    pub skill_id: String,
    pub status: StepStatus,
    #[serde(default)]
    pub target_id: Option<String>,
    #[serde(default)]
    pub input_artifacts: Vec<String>, // artifact_ids
    #[serde(default)]
    pub output_artifact: Option<String>, // artifact_id
    #[serde(default)]
    pub error_code: Option<String>,
    #[serde(default)]
    pub trace_id: Option<String>,
    pub ts_start: Option<u128>,
    pub ts_end: Option<u128>,
}

// ───────── Dispatch Trace (§9.9 关键日志 + §29 E2E Contract) ─────────

/// 结构化 dispatch 执行日志 — route.md §9.9 + §29.3
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DispatchTrace {
    pub trace_id: String,
    pub run_id: Option<String>,
    pub step_id: Option<String>,
    pub target_id: Option<String>,
    pub ts_start: u128,
    pub ts_end: u128,
    pub duration_ms: u128,
    /// 候选窗口列表
    pub candidate_windows: Vec<String>,
    /// 最终匹配的指纹信息
    pub matched_fingerprint: Option<String>,
    pub matched_hwnd: Option<u64>,
    /// 激活校验结果
    pub activation_ok: bool,
    pub activation_attempts: u32,
    /// 剪贴板事务结果
    pub clipboard_backup_ok: bool,
    pub clipboard_restore_ok: bool,
    /// 焦点配方执行
    pub focus_recipe_executed: bool,
    /// 发送动作结果
    pub stage_ok: bool,
    pub confirm_ok: Option<bool>,
    /// §29.3 clipboard_txn_id
    pub clipboard_txn_id: Option<String>,
    #[serde(default)]
    pub browser_id: Option<String>,
    #[serde(default)]
    pub injection_trace_id: Option<String>,
    /// 总执行结果
    pub outcome: String,
    pub error_detail: Option<String>,
}

// ───────── Vault / Run Archive (§2 统一数据面) ─────────

/// Run 归档记录 — vault/runs/*.json
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunRecord {
    pub id: String,
    pub ts_start: u128,
    pub ts_end: Option<u128>,
    pub skill_id: String,
    pub workflow_id: Option<String>,
    pub step_id: Option<String>,
    pub target_id: String,
    pub provider: String,
    pub prompt: String,
    pub output: Option<String>,
    pub status: String, // "created" | "dispatched" | "waiting_capture" | "captured" | "done" | "failed" | "compensating" | "cancelled" | "closed"
    pub error_code: Option<String>,
    pub trace_id: String,
    pub route_decision: Option<RouteDecision>,
    /// §37 步骤列表
    #[serde(default)]
    pub steps: Vec<StepRecord>,
    /// §35 输出制品 ID 列表
    #[serde(default)]
    pub artifact_ids: Vec<String>,
    /// §29 confirm_source: "user" | "policy" | null
    #[serde(default)]
    pub confirm_source: Option<String>,
    #[serde(default)]
    pub browser_id: Option<String>,
    #[serde(default)]
    pub browser_candidates: Vec<BrowserCandidate>,
    #[serde(default)]
    pub injection_audit: Option<InjectionAudit>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserCandidate {
    pub browser_id: String,
    pub hwnd: u64,
    pub title: String,
    #[serde(default)]
    pub exe_name: Option<String>,
    #[serde(default)]
    pub class_name: Option<String>,
    pub score: u32,
    #[serde(default)]
    pub reasons: Vec<String>,
}

/// §61 BrowserProfile — 浏览器画像
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserProfile {
    pub browser_id: String,
    pub exe_name: String,
    pub class_name: String,
    pub installed: bool,
    pub running: bool,
    pub window_count: usize,
    pub supports_target: bool,
    pub health_score: u32,
}

/// §60 浏览器检测结果
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BrowserDetectionResult {
    pub profiles: Vec<BrowserProfile>,
    pub unknown_browser_warning: bool,
    pub warning_message: Option<String>,
}

/// §60-§61 已知浏览器特征库
pub fn known_browser_signatures() -> Vec<(&'static str, &'static str, &'static str)> {
    // (browser_id, exe_pattern, class_name_pattern)
    vec![
        ("firefox", "firefox", "MozillaWindowClass"),
        ("chrome", "chrome", "Chrome_WidgetWin_1"),
        ("edge", "msedge", "Chrome_WidgetWin_1"),
        ("brave", "brave", "Chrome_WidgetWin_1"),
        ("opera", "opera", "Chrome_WidgetWin_1"),
        ("vivaldi", "vivaldi", "Chrome_WidgetWin_1"),
        ("arc", "arc", "Chrome_WidgetWin_1"),
        ("chromium", "chromium", "Chrome_WidgetWin_1"),
        ("waterfox", "waterfox", "MozillaWindowClass"),
        ("librewolf", "librewolf", "MozillaWindowClass"),
        ("floorp", "floorp", "MozillaWindowClass"),
        ("tor", "torbrowser", "MozillaWindowClass"),
    ]
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstructionBlock {
    pub block_id: String,
    pub source: String,
    pub priority: u32,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InjectionAudit {
    pub injection_trace_id: String,
    pub mode: String,
    #[serde(default)]
    pub applied_blocks: Vec<InstructionBlock>,
    #[serde(default)]
    pub dropped_blocks: Vec<InstructionBlock>,
    #[serde(default)]
    pub conflicts: Vec<String>,
    pub final_prompt_checksum: String,
}

/// 事件日志 — vault/events/*.jsonl
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VaultEvent {
    pub ts_ms: u128,
    pub event_type: String,
    pub run_id: Option<String>,
    pub step_id: Option<String>,
    pub trace_id: String,
    pub action: String,
    pub outcome: String,
    pub detail: Option<String>,
}

// ───────── Health Check ─────────

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TargetHealth {
    pub target_id: String,
    pub provider: String,
    pub status: TargetStatus,
    pub matched: bool,
    pub matched_title: Option<String>,
    pub matched_hwnd: Option<u64>,
    #[serde(default)]
    pub error_code: Option<String>,
    #[serde(default)]
    pub error_message: Option<String>,
}

// ───────── File I/O ─────────

fn config_dir(app: &tauri::AppHandle) -> PathBuf {
    let base = app
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    base.join("config")
}

pub fn ensure_config_dir(app: &tauri::AppHandle) -> Result<(), Box<dyn std::error::Error>> {
    let dir = config_dir(app);
    fs::create_dir_all(&dir)?;

    // ─── Vault 统一数据面 (§2) ───
    let base = app
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    fs::create_dir_all(base.join("vault").join("runs"))?;
    fs::create_dir_all(base.join("vault").join("events"))?;
    fs::create_dir_all(base.join("vault").join("audit"))?;
    fs::create_dir_all(base.join("vault").join("health"))?;
    fs::create_dir_all(base.join("vault").join("artifacts"))?; // §35
    fs::create_dir_all(base.join("vault").join("governance").join("changes"))?;
    fs::create_dir_all(base.join("vault").join("governance").join("quality"))?;
    fs::create_dir_all(base.join("vault").join("governance").join("decisions"))?;

    // Write default targets.yaml if not exists
    let targets_path = dir.join("targets.yaml");
    if !targets_path.exists() {
        let default = TargetsConfig::default();
        let yaml = serde_yaml::to_string(&default)?;
        atomic_write(&targets_path, yaml)?;
    }

    // Write default router_rules.yaml if not exists
    let router_path = dir.join("router_rules.yaml");
    if !router_path.exists() {
        let default_rules = default_router_rules();
        let yaml = serde_yaml::to_string(&default_rules)?;
        atomic_write(&router_path, yaml)?;
    }

    // Ensure skills/ and workflows/ dirs
    fs::create_dir_all(dir.join("skills"))?;
    fs::create_dir_all(dir.join("workflows"))?;

    // Write default skills if empty
    let skills_dir = dir.join("skills");
    if fs::read_dir(&skills_dir)?.count() == 0 {
        write_default_skills(&skills_dir)?;
    }

    // Write default workflows if empty
    let workflows_dir = dir.join("workflows");
    if fs::read_dir(&workflows_dir)?.count() == 0 {
        write_default_workflows(&workflows_dir)?;
    }

    Ok(())
}

pub fn load_targets(app: &tauri::AppHandle) -> Result<TargetsConfig, Box<dyn std::error::Error>> {
    let path = config_dir(app).join("targets.yaml");
    if path.exists() {
        let content = fs::read_to_string(&path)?;
        let cfg: TargetsConfig = serde_yaml::from_str(&content)?;
        Ok(cfg)
    } else {
        Ok(TargetsConfig::default())
    }
}

pub fn save_targets(
    app: &tauri::AppHandle,
    cfg: &TargetsConfig,
) -> Result<(), Box<dyn std::error::Error>> {
    let path = config_dir(app).join("targets.yaml");
    let yaml = serde_yaml::to_string(cfg)?;
    atomic_write(&path, yaml)?;
    Ok(())
}

pub fn load_skills(app: &tauri::AppHandle) -> Result<Vec<Skill>, Box<dyn std::error::Error>> {
    let dir = config_dir(app).join("skills");
    let mut skills = Vec::new();
    if dir.exists() {
        for entry in fs::read_dir(&dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().is_some_and(|e| e == "yaml" || e == "yml") {
                let content = fs::read_to_string(&path)?;
                let skill: Skill = serde_yaml::from_str(&content)?;
                skills.push(skill);
            }
        }
    }
    Ok(skills)
}

pub fn load_workflows(app: &tauri::AppHandle) -> Result<Vec<Workflow>, Box<dyn std::error::Error>> {
    let dir = config_dir(app).join("workflows");
    let mut workflows = Vec::new();
    if dir.exists() {
        for entry in fs::read_dir(&dir)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().is_some_and(|e| e == "yaml" || e == "yml") {
                let content = fs::read_to_string(&path)?;
                let wf: Workflow = serde_yaml::from_str(&content)?;
                workflows.push(wf);
            }
        }
    }
    Ok(workflows)
}

pub fn load_router_rules(
    app: &tauri::AppHandle,
) -> Result<RouterRulesConfig, Box<dyn std::error::Error>> {
    let path = config_dir(app).join("router_rules.yaml");
    if path.exists() {
        let content = fs::read_to_string(&path)?;
        let cfg: RouterRulesConfig = serde_yaml::from_str(&content)?;
        Ok(cfg)
    } else {
        Ok(default_router_rules())
    }
}

pub fn save_router_rules(
    app: &tauri::AppHandle,
    rules: &RouterRulesConfig,
) -> Result<(), Box<dyn std::error::Error>> {
    let path = config_dir(app).join("router_rules.yaml");
    let yaml = serde_yaml::to_string(rules)?;
    atomic_write(&path, yaml)?;
    Ok(())
}

fn default_router_rules() -> RouterRulesConfig {
    let mut intents = HashMap::new();
    intents.insert(
        "realtime".to_string(),
        IntentRule {
            keywords: vec![
                "最新".into(),
                "最近".into(),
                "更新".into(),
                "release".into(),
                "漏洞".into(),
                "CVE".into(),
                "breaking change".into(),
            ],
            patterns: vec![r"(最新|实时|热点).*".into()],
            dispatch_prefer: vec!["grok".into(), "kimi".into(), "yuanbao".into()],
            fanout: false,
            confidence_boost: 0.1,
        },
    );
    intents.insert(
        "analyze".to_string(),
        IntentRule {
            keywords: vec![
                "可行性".into(),
                "风险".into(),
                "对比".into(),
                "选型".into(),
                "trade-off".into(),
                "架构".into(),
            ],
            patterns: vec![r"(分析|评估|对比).*".into()],
            dispatch_prefer: vec!["deepseek".into(), "gemini".into()],
            fanout: true,
            confidence_boost: 0.05,
        },
    );
    intents.insert(
        "write".to_string(),
        IntentRule {
            keywords: vec![
                "润色".into(),
                "汇报".into(),
                "成稿".into(),
                "PPT".into(),
                "摘要".into(),
                "学术".into(),
            ],
            patterns: vec![r"(润色|撰写|汇报|摘要).*".into()],
            dispatch_prefer: vec!["chatgpt".into(), "kimi".into()],
            fanout: false,
            confidence_boost: 0.0,
        },
    );
    intents.insert(
        "code".to_string(),
        IntentRule {
            keywords: vec![
                "代码".into(),
                "审查".into(),
                "code review".into(),
                "重构".into(),
                "生成代码".into(),
                "脚手架".into(),
                "bug".into(),
                "测试".into(),
            ],
            patterns: vec![r"(代码|review|审查|重构|生成|修复).*(代码|bug|函数|模块)".into()],
            dispatch_prefer: vec!["deepseek".into(), "chatgpt".into(), "gemini".into()],
            fanout: false,
            confidence_boost: 0.05,
        },
    );
    intents.insert(
        "security".to_string(),
        IntentRule {
            keywords: vec![
                "安全".into(),
                "漏洞".into(),
                "审计".into(),
                "CVE".into(),
                "OWASP".into(),
                "渗透".into(),
                "加固".into(),
                "合规".into(),
            ],
            patterns: vec![r"(安全|漏洞|审计|渗透|加固|合规).*".into()],
            dispatch_prefer: vec!["deepseek".into(), "gemini".into(), "chatgpt".into()],
            fanout: true,
            confidence_boost: 0.1,
        },
    );
    intents.insert(
        "translate".to_string(),
        IntentRule {
            keywords: vec![
                "翻译".into(),
                "translate".into(),
                "本地化".into(),
                "localize".into(),
                "中英".into(),
                "英中".into(),
            ],
            patterns: vec![r"(翻译|translate|本地化).*".into()],
            dispatch_prefer: vec!["chatgpt".into(), "kimi".into(), "deepseek".into()],
            fanout: false,
            confidence_boost: 0.0,
        },
    );
    intents.insert(
        "data".to_string(),
        IntentRule {
            keywords: vec![
                "数据".into(),
                "分析".into(),
                "统计".into(),
                "可视化".into(),
                "报表".into(),
                "SQL".into(),
                "ETL".into(),
            ],
            patterns: vec![r"(数据|统计|可视化|报表|分析).*".into()],
            dispatch_prefer: vec!["deepseek".into(), "gemini".into()],
            fanout: false,
            confidence_boost: 0.05,
        },
    );
    intents.insert(
        "agent".to_string(),
        IntentRule {
            keywords: vec![
                "agent".into(),
                "自主".into(),
                "多轮".into(),
                "规划".into(),
                "分解".into(),
                "编排".into(),
                "研究".into(),
            ],
            patterns: vec![r"(agent|自主|多轮|编排|规划|分解).*".into()],
            dispatch_prefer: vec!["deepseek".into(), "gemini".into(), "grok".into()],
            fanout: false,
            confidence_boost: 0.1,
        },
    );

    RouterRulesConfig {
        intents,
        defaults: Some(RouterDefaults {
            fanout: false,
            auto_enter: false,
            confidence_auto_threshold: 0.8,
            confidence_confirm_threshold: 0.6,
        }),
    }
}

fn write_default_skills(dir: &std::path::Path) -> Result<(), Box<dyn std::error::Error>> {
    let skills = [
        r#"id: collect.realtime_brief
version: "1.0.0"
title: 实时信息要点收集
intent_tags: [realtime, collect, news]
inputs:
  topic:
    type: string
    required: true
    description: 要查询的主题
    max_length: 500
  time_range:
    type: string
    required: false
    description: 时间范围
prompt_template: |
  请搜索并整理关于 {topic} 的最新信息要点。
  时间范围：{time_range}
  要求：
  1. 列出关键信息来源
  2. 按时间线排列
  3. 标注信息可靠度
dispatch:
  mode: prefer_provider
  prefer_providers: [grok, kimi, yuanbao]
  timeout_ms: 30000
  retry_count: 2
quality_gates:
  - min_length: 50
    must_contain: []
fallbacks:
  - fallback_providers: [chatgpt, deepseek]
    action: retry_next_provider
observability:
  emit_start: true
  emit_end: true
  emit_error: true
safety_level: normal
cost_class: low
latency_class: medium
determinism: non_deterministic
"#,
        r#"id: analysis.tech_feasibility
version: "1.0.0"
title: 技术可行性评估
intent_tags: [analyze, feasibility, tech]
inputs:
  topic:
    type: string
    required: true
    description: 评估主题
  context:
    type: string
    required: false
    description: 上下文背景
  constraints:
    type: string
    required: false
    description: 约束条件
prompt_template: |
  你是资深技术架构师。
  任务：对 {topic} 做技术可行性评估。
  上下文：{context}
  约束：{constraints}
  要求：
  1. 技术可行性分析
  2. 风险评估（高/中/低）
  3. 推荐方案
  4. 时间/成本估算
dispatch:
  mode: prefer_provider
  prefer_providers: [gemini, deepseek, chatgpt]
  timeout_ms: 60000
  retry_count: 2
quality_gates:
  - min_length: 100
    must_contain: ["风险"]
fallbacks:
  - fallback_providers: [chatgpt, kimi]
    action: retry_next_provider
observability:
  emit_start: true
  emit_end: true
  emit_error: true
safety_level: normal
cost_class: medium
latency_class: high
determinism: non_deterministic
"#,
        r#"id: analysis.arch_tradeoff
version: "1.0.0"
title: 架构 Trade-off 分析
intent_tags: [analyze, architecture, tradeoff]
inputs:
  options:
    type: string
    required: true
    description: 方案选项列表
  criteria:
    type: string
    required: false
    description: 评估维度
prompt_template: |
  请对以下技术方案进行 Trade-off 分析：
  方案选项：{options}
  评估维度：{criteria}
  要求输出：对比表格 + 推荐结论
dispatch:
  mode: prefer_provider
  prefer_providers: [deepseek, gemini]
  timeout_ms: 60000
  retry_count: 2
quality_gates:
  - min_length: 80
    must_contain: []
fallbacks:
  - fallback_providers: [chatgpt]
    action: retry_next_provider
observability:
  emit_start: true
  emit_end: true
  emit_error: true
safety_level: normal
cost_class: medium
latency_class: high
determinism: non_deterministic
"#,
        r#"id: writing.proposal_polish
version: "1.0.0"
title: 方案书润色成稿
intent_tags: [write, polish, proposal]
inputs:
  draft:
    type: string
    required: true
    description: 草稿内容
    max_length: 50000
  audience:
    type: string
    required: false
    description: 目标读者
prompt_template: |
  请将以下草稿润色为正式方案书：
  {draft}
  目标读者：{audience}
  要求：结构清晰、用语专业、逻辑严谨
dispatch:
  mode: prefer_provider
  prefer_providers: [chatgpt, kimi]
  timeout_ms: 45000
  retry_count: 2
quality_gates:
  - min_length: 200
    must_contain: []
fallbacks:
  - fallback_providers: [deepseek, gemini]
    action: retry_next_provider
observability:
  emit_start: true
  emit_end: true
  emit_error: true
safety_level: normal
cost_class: low
latency_class: medium
determinism: non_deterministic
"#,
        r#"id: writing.exec_summary
version: "1.0.0"
title: 管理层摘要
intent_tags: [write, summary, executive]
inputs:
  content:
    type: string
    required: true
    description: 需要提炼的内容
    max_length: 50000
prompt_template: |
  请将以下内容提炼为管理层摘要（300字以内）：
  {content}
  要求：突出关键结论、风险、行动建议
dispatch:
  mode: prefer_provider
  prefer_providers: [chatgpt, kimi]
  timeout_ms: 30000
  retry_count: 2
quality_gates:
  - max_length: 1000
    must_contain: []
fallbacks:
  - fallback_providers: [deepseek]
    action: retry_next_provider
observability:
  emit_start: true
  emit_end: true
  emit_error: true
safety_level: normal
cost_class: low
latency_class: low
determinism: non_deterministic
"#,
        // ───────── 新增 Skills: 代码 / 安全 / 翻译 / 数据 / Agent ─────────
        r#"id: code.review
version: "1.0.0"
title: 代码审查与优化建议
intent_tags: [code, review, quality]
inputs:
  code_snippet:
    type: string
    required: true
    description: 需要审查的代码片段
    max_length: 100000
  language:
    type: string
    required: false
    description: 编程语言（如 Rust, TypeScript, Python）
  focus_areas:
    type: string
    required: false
    description: 关注维度（安全/性能/可维护性/规范）
prompt_template: |
  你是资深代码审查专家。
  请审查以下 {language} 代码：
  ```
  {code_snippet}
  ```
  重点关注：{focus_areas}
  要求输出：
  1. 问题清单（严重度：Critical/Major/Minor/Info）
  2. 安全漏洞检查（SQL 注入、XSS、路径遍历等）
  3. 性能瓶颈分析
  4. 改进建议与修复示例代码
dispatch:
  mode: prefer_provider
  prefer_providers: [deepseek, gemini, chatgpt]
  timeout_ms: 60000
  retry_count: 2
quality_gates:
  - min_length: 100
    must_contain: []
fallbacks:
  - fallback_providers: [chatgpt, kimi]
    action: retry_next_provider
observability:
  emit_start: true
  emit_end: true
  emit_error: true
safety_level: normal
cost_class: medium
latency_class: high
determinism: non_deterministic
"#,
        r#"id: code.generation
version: "1.0.0"
title: 代码生成与脚手架
intent_tags: [code, generate, scaffold]
inputs:
  requirement:
    type: string
    required: true
    description: 功能需求描述
    max_length: 10000
  language:
    type: string
    required: true
    description: 目标编程语言
  framework:
    type: string
    required: false
    description: 框架/库约束
  constraints:
    type: string
    required: false
    description: 约束条件（安全要求、编码规范等）
prompt_template: |
  你是高级软件工程师。
  请根据以下需求生成 {language} 代码：
  需求：{requirement}
  框架：{framework}
  约束：{constraints}
  要求：
  1. 生产级代码质量，含完整错误处理
  2. 必须包含类型定义/接口
  3. 包含单元测试示例
  4. 遵循 SOLID 原则
  5. 安全编码（无硬编码密钥、SQL 注入防护等）
dispatch:
  mode: prefer_provider
  prefer_providers: [deepseek, chatgpt, gemini]
  timeout_ms: 60000
  retry_count: 2
quality_gates:
  - min_length: 200
    must_contain: []
fallbacks:
  - fallback_providers: [kimi]
    action: retry_next_provider
observability:
  emit_start: true
  emit_end: true
  emit_error: true
safety_level: normal
cost_class: medium
latency_class: high
determinism: non_deterministic
"#,
        r#"id: security.audit
version: "1.0.0"
title: 安全审计与漏洞扫描
intent_tags: [security, audit, vulnerability, CVE]
inputs:
  target_description:
    type: string
    required: true
    description: 审计对象描述（代码/架构/配置）
    max_length: 100000
  scope:
    type: string
    required: false
    description: 审计范围（OWASP Top 10/CWE/自定义）
  compliance:
    type: string
    required: false
    description: 合规标准（PCI-DSS/GDPR/等保）
prompt_template: |
  你是信息安全专家，请对以下目标进行安全审计：
  审计对象：{target_description}
  审计范围：{scope}
  合规标准：{compliance}
  要求输出：
  1. 漏洞清单（CVSS 评分 + CWE 编号）
  2. 风险矩阵（可能性 × 影响）
  3. 修复建议（优先级排序）
  4. 合规差距分析
  5. 加固检查清单
dispatch:
  mode: prefer_provider
  prefer_providers: [deepseek, gemini, chatgpt]
  timeout_ms: 90000
  retry_count: 2
quality_gates:
  - min_length: 200
    must_contain: ["风险"]
fallbacks:
  - fallback_providers: [chatgpt, kimi]
    action: retry_next_provider
observability:
  emit_start: true
  emit_end: true
  emit_error: true
safety_level: dangerous
cost_class: high
latency_class: high
determinism: non_deterministic
"#,
        r#"id: translate.document
version: "1.0.0"
title: 专业文档翻译
intent_tags: [translate, document, localize]
inputs:
  content:
    type: string
    required: true
    description: 需要翻译的文档内容
    max_length: 50000
  source_lang:
    type: string
    required: false
    description: 源语言（默认自动检测）
  target_lang:
    type: string
    required: true
    description: 目标语言
  domain:
    type: string
    required: false
    description: 专业领域（技术/法律/金融/医学）
prompt_template: |
  你是专业翻译，请将以下内容翻译为 {target_lang}：
  源语言：{source_lang}
  专业领域：{domain}
  内容：
  {content}
  要求：
  1. 保持专业术语准确性
  2. 保留原文格式与结构
  3. 术语一致性，附术语对照表
  4. 标注不确定的翻译
dispatch:
  mode: prefer_provider
  prefer_providers: [chatgpt, kimi, deepseek]
  timeout_ms: 45000
  retry_count: 2
quality_gates:
  - min_length: 50
    must_contain: []
fallbacks:
  - fallback_providers: [gemini]
    action: retry_next_provider
observability:
  emit_start: true
  emit_end: true
  emit_error: true
safety_level: safe
cost_class: low
latency_class: medium
determinism: non_deterministic
"#,
        r#"id: data.analysis
version: "1.0.0"
title: 数据分析与可视化建议
intent_tags: [data, analyze, statistics, visualization]
inputs:
  dataset_desc:
    type: string
    required: true
    description: 数据集描述或样本数据
    max_length: 50000
  analysis_goal:
    type: string
    required: true
    description: 分析目标
  output_format:
    type: string
    required: false
    description: 输出格式偏好（表格/图表建议/代码）
prompt_template: |
  你是数据分析专家。
  数据集：{dataset_desc}
  分析目标：{analysis_goal}
  输出格式：{output_format}
  要求：
  1. 数据概览与统计摘要
  2. 关键发现与异常值分析
  3. 可视化建议（图表类型 + 维度选择）
  4. 推荐 Python/SQL 分析代码片段
  5. 结论与行动建议
dispatch:
  mode: prefer_provider
  prefer_providers: [deepseek, gemini, chatgpt]
  timeout_ms: 60000
  retry_count: 2
quality_gates:
  - min_length: 150
    must_contain: []
fallbacks:
  - fallback_providers: [chatgpt, kimi]
    action: retry_next_provider
observability:
  emit_start: true
  emit_end: true
  emit_error: true
safety_level: normal
cost_class: medium
latency_class: high
determinism: non_deterministic
"#,
        r#"id: agent.research
version: "1.0.0"
title: Agent 研究助手（多轮自主探索）
intent_tags: [agent, research, multi_step, autonomous]
inputs:
  research_topic:
    type: string
    required: true
    description: 研究课题
    max_length: 5000
  depth:
    type: string
    required: false
    description: 研究深度（survey/deep_dive/exhaustive）
  constraints:
    type: string
    required: false
    description: 约束条件（时间/来源/语言）
prompt_template: |
  你是自主研究 Agent，请对以下课题进行多轮深度研究：
  课题：{research_topic}
  研究深度：{depth}
  约束：{constraints}
  执行策略：
  1. 第一轮：信息收集与概览
  2. 第二轮：关键点深挖与交叉验证
  3. 第三轮：形成结构化研究报告
  输出格式：
  - 研究摘要（300 字以内）
  - 关键发现清单（含可信度评级）
  - 信息来源与引用
  - 开放问题与后续建议
  安全约束：
  - 仅使用公开可验证信息
  - 不执行任何代码或系统操作
  - 每轮操作必须可审计
dispatch:
  mode: prefer_provider
  prefer_providers: [grok, gemini, deepseek]
  timeout_ms: 120000
  retry_count: 3
quality_gates:
  - min_length: 200
    must_contain: ["摘要"]
fallbacks:
  - fallback_providers: [chatgpt, kimi]
    action: retry_next_provider
observability:
  emit_start: true
  emit_end: true
  emit_error: true
preconditions:
  - "user_confirmed_agent_mode"
  - "budget_check_passed"
postconditions:
  - "output_safety_scan_passed"
  - "no_pii_leaked"
safety_level: dangerous
cost_class: high
latency_class: high
determinism: non_deterministic
"#,
        r#"id: agent.task_planner
version: "1.0.0"
title: Agent 任务规划器（目标分解与编排）
intent_tags: [agent, plan, decompose, orchestrate]
inputs:
  goal:
    type: string
    required: true
    description: 总体目标描述
    max_length: 10000
  available_skills:
    type: string
    required: false
    description: 可用 Skill 列表（JSON 或逗号分隔）
  max_steps:
    type: string
    required: false
    description: 最大步骤数限制
prompt_template: |
  你是 AI 任务规划器。
  总体目标：{goal}
  可用技能：{available_skills}
  最大步骤数：{max_steps}
  请生成可执行的任务计划：
  1. 目标分解（子任务 DAG）
  2. 每个子任务映射到具体 Skill
  3. 依赖关系与执行顺序
  4. 预估时间与成本
  5. 风险评估与回退方案
  6. 检查点与验收标准
  输出格式为 YAML workflow 定义。
  安全约束：
  - 遵循最小权限原则
  - 高危操作必须人工确认
  - 总预算不超过限制
dispatch:
  mode: prefer_provider
  prefer_providers: [deepseek, gemini, chatgpt]
  timeout_ms: 90000
  retry_count: 2
quality_gates:
  - min_length: 100
    must_contain: []
fallbacks:
  - fallback_providers: [chatgpt]
    action: retry_next_provider
observability:
  emit_start: true
  emit_end: true
  emit_error: true
preconditions:
  - "user_confirmed_agent_mode"
postconditions:
  - "plan_safety_validated"
safety_level: dangerous
cost_class: medium
latency_class: high
determinism: non_deterministic
"#,
    ];

    for (i, skill_yaml) in skills.iter().enumerate() {
        let filename = format!("skill_{}.yaml", i + 1);
        atomic_write(dir.join(filename), skill_yaml)?;
    }
    Ok(())
}

fn write_default_workflows(dir: &std::path::Path) -> Result<(), Box<dyn std::error::Error>> {
    let workflows = [
        r#"id: robotics.realtime_to_proposal
version: "1.0.0"
title: 实时信息→分析→成稿（多模型协作）
policy:
  max_parallelism: 2
  global_timeout_ms: 180000
  fail_policy: fail_fast
  checkpoint_policy: per_step
  resume_policy: from_last_checkpoint
  merge_strategy: first_success
steps:
  - id: step_collect
    use: collect.realtime_brief
    depends_on: []
    retry_policy:
      max_retries: 2
      delay_ms: 1000
      backoff: exponential
    timeout_ms: 30000
    compensation: skip
    emit_events: [step_start, step_end]
    dispatch:
      mode: prefer_provider
      prefer_providers: [grok, kimi, yuanbao]
  - id: step_analyze
    use: analysis.tech_feasibility
    depends_on: [step_collect]
    retry_policy:
      max_retries: 2
      delay_ms: 1000
      backoff: exponential
    timeout_ms: 60000
    compensation: skip
    emit_events: [step_start, step_end]
    dispatch:
      mode: prefer_provider
      prefer_providers: [gemini, deepseek]
  - id: step_polish
    use: writing.proposal_polish
    depends_on: [step_analyze]
    retry_policy:
      max_retries: 1
      delay_ms: 2000
      backoff: linear
    timeout_ms: 45000
    compensation: skip
    emit_events: [step_start, step_end]
    dispatch:
      mode: prefer_provider
      prefer_providers: [chatgpt, kimi]
"#,
        r#"id: tech.arch_decision
version: "1.0.0"
title: 架构选型全流程
policy:
  max_parallelism: 2
  global_timeout_ms: 180000
  fail_policy: fail_fast
  checkpoint_policy: per_step
  resume_policy: from_last_checkpoint
  merge_strategy: first_success
steps:
  - id: step_collect
    use: collect.realtime_brief
    depends_on: []
    retry_policy:
      max_retries: 2
      delay_ms: 1000
      backoff: exponential
    timeout_ms: 30000
    compensation: skip
    emit_events: [step_start, step_end]
    dispatch:
      mode: prefer_provider
      prefer_providers: [grok, kimi]
  - id: step_tradeoff
    use: analysis.arch_tradeoff
    depends_on: [step_collect]
    retry_policy:
      max_retries: 2
      delay_ms: 1000
      backoff: exponential
    timeout_ms: 60000
    compensation: skip
    emit_events: [step_start, step_end]
    dispatch:
      mode: prefer_provider
      prefer_providers: [deepseek, gemini]
  - id: step_summary
    use: writing.exec_summary
    depends_on: [step_tradeoff]
    retry_policy:
      max_retries: 1
      delay_ms: 2000
      backoff: linear
    timeout_ms: 30000
    compensation: skip
    emit_events: [step_start, step_end]
    dispatch:
      mode: prefer_provider
      prefer_providers: [chatgpt]
"#,
        // ───────── 新增 Workflow: Agent 研究报告 ─────────
        r#"id: agent.research_report
version: "1.0.0"
title: Agent 研究→分析→摘要（自主闭环）
policy:
  max_parallelism: 1
  global_timeout_ms: 300000
  fail_policy: fail_fast
  checkpoint_policy: per_step
  resume_policy: from_last_checkpoint
  merge_strategy: first_success
steps:
  - id: step_research
    use: agent.research
    depends_on: []
    retry_policy:
      max_retries: 3
      delay_ms: 2000
      backoff: exponential
    timeout_ms: 120000
    compensation: skip
    emit_events: [step_start, step_end, agent_iteration]
    dispatch:
      mode: prefer_provider
      prefer_providers: [grok, gemini]
  - id: step_analyze
    use: analysis.tech_feasibility
    depends_on: [step_research]
    retry_policy:
      max_retries: 2
      delay_ms: 1000
      backoff: exponential
    timeout_ms: 60000
    compensation: skip
    emit_events: [step_start, step_end]
    dispatch:
      mode: prefer_provider
      prefer_providers: [deepseek, gemini]
  - id: step_summary
    use: writing.exec_summary
    depends_on: [step_analyze]
    retry_policy:
      max_retries: 1
      delay_ms: 2000
      backoff: linear
    timeout_ms: 30000
    compensation: skip
    emit_events: [step_start, step_end]
    dispatch:
      mode: prefer_provider
      prefer_providers: [chatgpt]
"#,
        // ───────── 新增 Workflow: 安全审计全流程 ─────────
        r#"id: security.full_audit
version: "1.0.0"
title: 安全审计全流程（收集→审计→报告）
policy:
  max_parallelism: 1
  global_timeout_ms: 300000
  fail_policy: fail_fast
  checkpoint_policy: per_step
  resume_policy: from_last_checkpoint
  merge_strategy: first_success
steps:
  - id: step_collect_info
    use: collect.realtime_brief
    depends_on: []
    retry_policy:
      max_retries: 2
      delay_ms: 1000
      backoff: exponential
    timeout_ms: 30000
    compensation: skip
    emit_events: [step_start, step_end]
    dispatch:
      mode: prefer_provider
      prefer_providers: [grok, kimi]
  - id: step_security_audit
    use: security.audit
    depends_on: [step_collect_info]
    retry_policy:
      max_retries: 2
      delay_ms: 2000
      backoff: exponential
    timeout_ms: 90000
    compensation: skip
    emit_events: [step_start, step_end]
    dispatch:
      mode: prefer_provider
      prefer_providers: [deepseek, gemini]
  - id: step_audit_report
    use: writing.proposal_polish
    depends_on: [step_security_audit]
    retry_policy:
      max_retries: 1
      delay_ms: 2000
      backoff: linear
    timeout_ms: 45000
    compensation: skip
    emit_events: [step_start, step_end]
    dispatch:
      mode: prefer_provider
      prefer_providers: [chatgpt, kimi]
"#,
        // ───────── 新增 Workflow: 代码生成→审查闭环 ─────────
        r#"id: code.generate_and_review
version: "1.0.0"
title: 代码生成→审查→优化闭环
policy:
  max_parallelism: 1
  global_timeout_ms: 240000
  fail_policy: fail_fast
  checkpoint_policy: per_step
  resume_policy: from_last_checkpoint
  merge_strategy: first_success
steps:
  - id: step_generate
    use: code.generation
    depends_on: []
    retry_policy:
      max_retries: 2
      delay_ms: 1000
      backoff: exponential
    timeout_ms: 60000
    compensation: skip
    emit_events: [step_start, step_end]
    dispatch:
      mode: prefer_provider
      prefer_providers: [deepseek, chatgpt]
  - id: step_review
    use: code.review
    depends_on: [step_generate]
    retry_policy:
      max_retries: 2
      delay_ms: 1000
      backoff: exponential
    timeout_ms: 60000
    compensation: skip
    emit_events: [step_start, step_end]
    dispatch:
      mode: prefer_provider
      prefer_providers: [gemini, deepseek]
  - id: step_summary_report
    use: writing.exec_summary
    depends_on: [step_review]
    retry_policy:
      max_retries: 1
      delay_ms: 2000
      backoff: linear
    timeout_ms: 30000
    compensation: skip
    emit_events: [step_start, step_end]
    dispatch:
      mode: prefer_provider
      prefer_providers: [chatgpt]
"#,
    ];

    for (i, wf_yaml) in workflows.iter().enumerate() {
        let filename = format!("workflow_{}.yaml", i + 1);
        atomic_write(dir.join(filename), wf_yaml)?;
    }
    Ok(())
}

// ───────── Vault I/O (§2 统一数据面) ─────────

pub(crate) fn vault_dir(app: &tauri::AppHandle) -> PathBuf {
    let base = app
        .path()
        .app_config_dir()
        .unwrap_or_else(|_| PathBuf::from("."));
    base.join("vault")
}

pub fn save_run(app: &tauri::AppHandle, run: &RunRecord) -> Result<(), Box<dyn std::error::Error>> {
    let dir = vault_dir(app).join("runs");
    fs::create_dir_all(&dir)?;
    let path = dir.join(format!("{}.json", run.id));
    let json = serde_json::to_string_pretty(run)?;
    atomic_write(&path, json)?;
    Ok(())
}

pub fn load_runs(app: &tauri::AppHandle) -> Result<Vec<RunRecord>, Box<dyn std::error::Error>> {
    let dir = vault_dir(app).join("runs");
    let mut runs = Vec::new();
    if dir.exists() {
        let mut entries: Vec<_> = fs::read_dir(&dir)?
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().is_some_and(|x| x == "json"))
            .collect();
        entries.sort_by_key(|b| std::cmp::Reverse(b.file_name()));
        for entry in entries.iter().take(200) {
            let content = fs::read_to_string(entry.path())?;
            if let Ok(run) = serde_json::from_str::<RunRecord>(&content) {
                runs.push(run);
            }
        }
    }
    Ok(runs)
}

pub fn write_vault_event(
    app: &tauri::AppHandle,
    event: &VaultEvent,
) -> Result<(), Box<dyn std::error::Error>> {
    let dir = vault_dir(app).join("events");
    fs::create_dir_all(&dir)?;
    let date = chrono_date_stub();
    let path = dir.join(format!("events_{}.jsonl", date));
    let mut file = OpenOptions::new().create(true).append(true).open(path)?;
    let line = serde_json::to_string(event)?;
    writeln!(file, "{}", line)?;
    Ok(())
}

pub fn save_health_snapshot(
    app: &tauri::AppHandle,
    health: &[TargetHealth],
) -> Result<(), Box<dyn std::error::Error>> {
    let dir = vault_dir(app).join("health");
    fs::create_dir_all(&dir)?;
    let path = dir.join("latest.json");
    let json = serde_json::to_string_pretty(health)?;
    atomic_write(&path, json)?;
    Ok(())
}

/// §35 保存 Artifact 到 vault/artifacts/
pub fn save_artifact(
    app: &tauri::AppHandle,
    artifact: &Artifact,
) -> Result<String, Box<dyn std::error::Error>> {
    let dir = vault_dir(app).join("artifacts");
    fs::create_dir_all(&dir)?;
    let path = dir.join(format!("{}.json", artifact.artifact_id));
    let json = serde_json::to_string_pretty(artifact)?;
    atomic_write(&path, json)?;
    Ok(path.to_string_lossy().to_string())
}

/// §9.9 保存 DispatchTrace 到 vault/audit/
pub fn save_dispatch_trace(
    app: &tauri::AppHandle,
    trace: &DispatchTrace,
) -> Result<(), Box<dyn std::error::Error>> {
    let dir = vault_dir(app).join("audit");
    fs::create_dir_all(&dir)?;
    let path = dir.join(format!("dispatch_trace_{}.json", trace.trace_id));
    let json = serde_json::to_string_pretty(trace)?;
    atomic_write(&path, json)?;
    Ok(())
}

pub fn chrono_date_stub() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    let days = (secs / 86400) as i64;
    // Civil date from day count (Algorithm by Howard Hinnant)
    // Reference: http://howardhinnant.github.io/date_algorithms.html
    let z = days + 719468;
    let era = if z >= 0 { z } else { z - 146096 } / 146097;
    let doe = (z - era * 146097) as u32; // day of era [0, 146096]
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = (yoe as i64) + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    format!("{:04}-{:02}-{:02}", y, m, d)
}

// ───────── Rule Engine v2 (§5 规则匹配引擎) ─────────

/// §5 规则管道 (8 stages): normalize → hard_match → keyword_match → pattern_match → semantic_match → policy_filter → rank → explain
pub fn route_prompt(prompt: &str, rules: &RouterRulesConfig) -> RouteDecision {
    // ─── Stage 1: normalize ───
    let normalized = prompt.to_lowercase();
    let trace_id = format!(
        "route-{}",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );

    let mut candidates: Vec<RouteCandidate> = Vec::new();

    for (intent_name, rule) in &rules.intents {
        let mut score = 0.0_f64;
        let mut breakdown = HashMap::new();
        let mut match_types: Vec<&str> = Vec::new();

        // ─── Stage 2: hard_match — exact full-keyword match (highest weight) ───
        let hard_hits: usize = rule
            .keywords
            .iter()
            .filter(|kw| {
                let kw_lower = kw.to_lowercase();
                // Exact word boundary match: the keyword appears as a standalone token
                normalized.split_whitespace().any(|w| w == kw_lower)
                    || normalized.contains(&kw_lower) // fallback to substring for CJK
            })
            .count();
        // §G3.1 Partial matching: award proportional score for partial matches
        let hard_match_score = if !rule.keywords.is_empty() && hard_hits > 0 {
            (hard_hits as f64) / (rule.keywords.len() as f64)
        } else {
            0.0
        };
        breakdown.insert("hard_match".to_string(), hard_match_score);
        if hard_match_score > 0.0 {
            score += hard_match_score * 0.3;
            match_types.push("hard");
        }

        // ─── Stage 3: keyword_match — partial keyword match ───
        let keyword_hits: usize = rule
            .keywords
            .iter()
            .filter(|kw| normalized.contains(&kw.to_lowercase()))
            .count();
        let keyword_score = if !rule.keywords.is_empty() {
            (keyword_hits as f64) / (rule.keywords.len() as f64)
        } else {
            0.0
        };
        breakdown.insert("keyword_match".to_string(), keyword_score);
        score += keyword_score * 0.3;
        if keyword_hits > 0 {
            match_types.push("keyword");
        }

        // ─── Stage 4: pattern_match — regex patterns ───
        let mut pattern_score = 0.0;
        for pat in &rule.patterns {
            if let Ok(re) = regex::Regex::new(pat) {
                if re.is_match(&normalized) {
                    pattern_score = 1.0;
                    break;
                }
            }
        }
        breakdown.insert("pattern_match".to_string(), pattern_score);
        score += pattern_score * 0.2;
        if pattern_score > 0.0 {
            match_types.push("pattern");
        }

        // ─── Stage 5: semantic_match — stub (placeholder for local SLM §4) ───
        // When local SLM is available, this stage will compute embedding similarity.
        // For now, we use a simple heuristic: check intent_tags overlap with prompt tokens.
        let semantic_score = 0.0_f64; // Reserved for future SLM integration
        breakdown.insert("semantic_match".to_string(), semantic_score);

        // ─── confidence_boost from rule config ───
        // §G3.2 Apply boost with decay to preserve differentiation (0.9+0.2→0.96 not 1.0)
        score += rule.confidence_boost;
        breakdown.insert("confidence_boost".to_string(), rule.confidence_boost);

        // Apply soft clamp to preserve differentiation
        if score > 1.0 {
            score = 1.0 - (score - 1.0) * 0.5; // Decay instead of hard clamp
        }
        score = score.clamp(0.0, 1.0);

        let match_type = if match_types.is_empty() {
            "none"
        } else {
            // Join match types: e.g., "hard+keyword+pattern"
            // Use the most specific combined description
            if match_types.len() >= 3 {
                "hard+keyword+pattern"
            } else if match_types.contains(&"hard") && match_types.contains(&"keyword") {
                "hard+keyword"
            } else if match_types.contains(&"keyword") && match_types.contains(&"pattern") {
                "keyword+pattern"
            } else if match_types.contains(&"hard") {
                "hard"
            } else if match_types.contains(&"keyword") {
                "keyword"
            } else {
                "pattern"
            }
        };

        if score > 0.0 {
            candidates.push(RouteCandidate {
                intent: intent_name.clone(),
                score,
                providers: rule.dispatch_prefer.clone(),
                matched_rule_id: intent_name.clone(),
                match_type: match_type.to_string(),
                score_breakdown: breakdown,
                fanout: rule.fanout,
            });
        }
    }

    // ─── Stage 6: policy_filter — remove candidates blocked by safety_level policy ───
    // Currently filters candidates with no providers (unusable)
    candidates.retain(|c| !c.providers.is_empty() || c.fanout);

    // ─── Stage 7: rank ───
    candidates.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    candidates.truncate(3); // §5: top3 candidates

    // ─── Stage 8: explain — determine action based on confidence thresholds (§5) ───
    let defaults = rules.defaults.as_ref();
    let auto_threshold = defaults.map(|d| d.confidence_auto_threshold).unwrap_or(0.8);
    let confirm_threshold = defaults
        .map(|d| d.confidence_confirm_threshold)
        .unwrap_or(0.6);

    let (selected, confidence, action, explanation) = if let Some(top) = candidates.first() {
        let conf = top.score;
        if conf >= auto_threshold {
            (
                Some(top.clone()),
                conf,
                "auto_execute".to_string(),
                format!(
                    "置信度 {:.2} >= {:.2}, 自动执行 intent={}, 命中规则={}, 打分明细={:?}",
                    conf, auto_threshold, top.intent, top.matched_rule_id, top.score_breakdown
                ),
            )
        } else if conf >= confirm_threshold {
            (Some(top.clone()), conf, "user_confirm".to_string(),
             format!("置信度 {:.2} 在 [{:.2}, {:.2}) 之间, 需用户确认 intent={}, 命中规则={}, 打分明细={:?}",
                     conf, confirm_threshold, auto_threshold, top.intent, top.matched_rule_id, top.score_breakdown))
        } else {
            (
                None,
                conf,
                "fallback_default".to_string(),
                format!(
                    "置信度 {:.2} < {:.2}, 回退默认路径",
                    conf, confirm_threshold
                ),
            )
        }
    } else {
        (
            None,
            0.0,
            "fallback_default".to_string(),
            "无匹配规则, 回退默认路径".to_string(),
        )
    };

    RouteDecision {
        top_candidates: candidates,
        selected,
        confidence,
        action,
        explanation,
        trace_id,
    }
}

/// §5 反馈记录: 记录用户 accept/reject/override 决策用于后续规则权重调整
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RouteFeedback {
    pub trace_id: String,
    pub decision_intent: String,
    pub user_action: String, // "accept" | "reject" | "override"
    pub override_intent: Option<String>,
    pub ts_ms: u128,
}

pub fn save_route_feedback(
    app: &tauri::AppHandle,
    fb: &RouteFeedback,
) -> Result<(), Box<dyn std::error::Error>> {
    let dir = vault_dir(app).join("route_feedback");
    fs::create_dir_all(&dir)?;
    let path = dir.join(format!("feedback_{}.json", fb.trace_id));
    let json = serde_json::to_string_pretty(fb)?;
    atomic_write(&path, json)?;
    Ok(())
}

/// §5 加载所有路由反馈记录
pub fn load_route_feedbacks(
    app: &tauri::AppHandle,
) -> Result<Vec<RouteFeedback>, Box<dyn std::error::Error>> {
    let dir = vault_dir(app).join("route_feedback");
    let mut feedbacks = Vec::new();
    if dir.exists() {
        let mut entries: Vec<_> = fs::read_dir(&dir)?
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().is_some_and(|x| x == "json"))
            .collect();
        entries.sort_by_key(|b| std::cmp::Reverse(b.file_name()));
        for entry in entries.iter().take(500) {
            let content = fs::read_to_string(entry.path())?;
            if let Ok(fb) = serde_json::from_str::<RouteFeedback>(&content) {
                feedbacks.push(fb);
            }
        }
    }
    Ok(feedbacks)
}

// Enterprise Closed Loop v2 shared contracts

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChangeRecord {
    pub change_id: String,
    pub title: String,
    pub owner: String,
    pub scope: String,
    pub risk_level: String,
    #[serde(default)]
    pub run_id: Option<String>,
    #[serde(default)]
    pub step_id: Option<String>,
    #[serde(default)]
    pub trace_id: Option<String>,
    #[serde(default)]
    pub acceptance_criteria: Vec<String>,
    pub rollback_plan: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Scorecard {
    pub correctness: u8,
    pub stability: u8,
    pub performance: u8,
    pub ux_consistency: u8,
    pub security: u8,
    pub maintainability: u8,
    pub observability: u8,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityGateResult {
    pub change_id: String,
    pub hard_gates: HashMap<String, bool>,
    pub scorecard: Scorecard,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum ReleaseDecision {
    Go,
    GoWithRisk,
    NoGo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReleaseDecisionRecord {
    pub change_id: String,
    pub decision: ReleaseDecision,
    pub approver: String,
    pub timestamp_utc: String,
    #[serde(default)]
    pub evidence: Vec<String>,
    #[serde(default)]
    pub notes: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TelemetryEvent {
    pub ts_ms: u64,
    pub project: String,
    pub module: String,
    pub feature: String,
    pub code: String,
    pub severity: String,
    #[serde(default)]
    pub run_id: Option<String>,
    #[serde(default)]
    pub step_id: Option<String>,
    #[serde(default)]
    pub change_id: Option<String>,
    #[serde(default)]
    pub trace_id: Option<String>,
    #[serde(default)]
    pub detail: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GovernanceValidationReport {
    pub change_id: String,
    pub hard_gate_results: HashMap<String, bool>,
    pub score_total: u16,
    pub decision: ReleaseDecision,
    pub passed: bool,
    pub issues: Vec<String>,
    pub generated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GovernanceSnapshot {
    pub change: ChangeRecord,
    pub quality: QualityGateResult,
    pub decision: ReleaseDecisionRecord,
}

fn governance_dir(app: &tauri::AppHandle) -> PathBuf {
    vault_dir(app).join("governance")
}

fn score_total(score: &Scorecard) -> u16 {
    u16::from(score.correctness)
        + u16::from(score.stability)
        + u16::from(score.performance)
        + u16::from(score.ux_consistency)
        + u16::from(score.security)
        + u16::from(score.maintainability)
        + u16::from(score.observability)
}

pub fn release_decision_from_score(total: u16) -> ReleaseDecision {
    if total >= 30 {
        ReleaseDecision::Go
    } else if total >= 24 {
        ReleaseDecision::GoWithRisk
    } else {
        ReleaseDecision::NoGo
    }
}

pub fn save_change_record(
    app: &tauri::AppHandle,
    change: &ChangeRecord,
) -> Result<(), Box<dyn std::error::Error>> {
    let dir = governance_dir(app).join("changes");
    fs::create_dir_all(&dir)?;
    let path = dir.join(format!("{}.json", change.change_id));
    atomic_write(path, serde_json::to_string_pretty(change)?)?;
    Ok(())
}

pub fn save_quality_gate_result(
    app: &tauri::AppHandle,
    quality: &QualityGateResult,
) -> Result<(), Box<dyn std::error::Error>> {
    let dir = governance_dir(app).join("quality");
    fs::create_dir_all(&dir)?;
    let path = dir.join(format!("{}.json", quality.change_id));
    atomic_write(path, serde_json::to_string_pretty(quality)?)?;
    Ok(())
}

pub fn save_release_decision(
    app: &tauri::AppHandle,
    decision: &ReleaseDecisionRecord,
) -> Result<(), Box<dyn std::error::Error>> {
    let dir = governance_dir(app).join("decisions");
    fs::create_dir_all(&dir)?;
    let path = dir.join(format!("{}.json", decision.change_id));
    atomic_write(path, serde_json::to_string_pretty(decision)?)?;
    Ok(())
}

pub fn save_telemetry_event(
    app: &tauri::AppHandle,
    event: &TelemetryEvent,
) -> Result<(), Box<dyn std::error::Error>> {
    let dir = vault_dir(app).join("audit");
    fs::create_dir_all(&dir)?;
    let date = chrono_date_stub();
    let path = dir.join(format!("telemetry_{}.jsonl", date));
    let mut file = OpenOptions::new().create(true).append(true).open(path)?;
    writeln!(file, "{}", serde_json::to_string(event)?)?;
    Ok(())
}

pub fn load_change_record(
    app: &tauri::AppHandle,
    change_id: &str,
) -> Result<Option<ChangeRecord>, Box<dyn std::error::Error>> {
    let path = governance_dir(app)
        .join("changes")
        .join(format!("{}.json", change_id));
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path)?;
    Ok(Some(serde_json::from_str(&content)?))
}

pub fn load_quality_gate_result(
    app: &tauri::AppHandle,
    change_id: &str,
) -> Result<Option<QualityGateResult>, Box<dyn std::error::Error>> {
    let path = governance_dir(app)
        .join("quality")
        .join(format!("{}.json", change_id));
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path)?;
    Ok(Some(serde_json::from_str(&content)?))
}

pub fn load_release_decision(
    app: &tauri::AppHandle,
    change_id: &str,
) -> Result<Option<ReleaseDecisionRecord>, Box<dyn std::error::Error>> {
    let path = governance_dir(app)
        .join("decisions")
        .join(format!("{}.json", change_id));
    if !path.exists() {
        return Ok(None);
    }
    let content = fs::read_to_string(path)?;
    Ok(Some(serde_json::from_str(&content)?))
}

pub fn governance_validate(
    app: &tauri::AppHandle,
    change_id: &str,
) -> Result<GovernanceValidationReport, Box<dyn std::error::Error>> {
    let quality = load_quality_gate_result(app, change_id)?
        .ok_or_else(|| format!("quality record not found for {}", change_id))?;
    let total = score_total(&quality.scorecard);
    let decision = release_decision_from_score(total);
    let mut issues = Vec::new();
    let mut passed = true;
    for (k, v) in &quality.hard_gates {
        if !*v {
            passed = false;
            issues.push(format!("hard gate failed: {}", k));
        }
    }
    if matches!(decision, ReleaseDecision::NoGo) {
        passed = false;
        issues.push("score total below GoWithRisk threshold".to_string());
    }

    Ok(GovernanceValidationReport {
        change_id: change_id.to_string(),
        hard_gate_results: quality.hard_gates,
        score_total: total,
        decision,
        passed,
        issues,
        generated_at: chrono_date_stub(),
    })
}

pub fn governance_latest(
    app: &tauri::AppHandle,
    change_id: &str,
) -> Result<Option<GovernanceSnapshot>, Box<dyn std::error::Error>> {
    let Some(change) = load_change_record(app, change_id)? else {
        return Ok(None);
    };
    let Some(quality) = load_quality_gate_result(app, change_id)? else {
        return Ok(None);
    };
    let Some(decision) = load_release_decision(app, change_id)? else {
        return Ok(None);
    };
    Ok(Some(GovernanceSnapshot {
        change,
        quality,
        decision,
    }))
}

// ============================================================================
// Context-aware path functions (for standalone mode)
// ============================================================================

use crate::context::AppContext;

/// Get config directory from AppContext
#[allow(dead_code)]
pub fn config_dir_from_context(ctx: &dyn AppContext) -> PathBuf {
    ctx.config_base().join("config")
}

/// Get vault directory from AppContext
#[allow(dead_code)]
pub fn vault_dir_from_context(ctx: &dyn AppContext) -> PathBuf {
    ctx.config_base().join("vault")
}

/// Get health snapshots directory from AppContext
#[allow(dead_code)]
pub fn health_snapshots_dir_from_context(ctx: &dyn AppContext) -> PathBuf {
    ctx.config_base().join("health")
}

/// Get archive directory from AppContext
#[allow(dead_code)]
pub fn archive_dir_from_context(ctx: &dyn AppContext) -> PathBuf {
    ctx.config_base().join("archive")
}

/// Get telemetry directory from AppContext
#[allow(dead_code)]
pub fn telemetry_dir_from_context(ctx: &dyn AppContext) -> PathBuf {
    ctx.config_base().join("telemetry")
}
