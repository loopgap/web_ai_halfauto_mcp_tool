// ═══════════════════════════════════════════════════════════
// AI Workbench 统一类型定义 — 对齐 route.md + Rust 后端
// ═══════════════════════════════════════════════════════════

// ───────── OS-Win Types ─────────

export interface WindowInfo {
  hwnd: number;
  title: string;
  class_name: string;
  process_id: number;
  exe_name: string | null;
  is_visible: boolean;
  is_minimized: boolean;
}

export interface EnumWindowsArgs {
  include_invisible: boolean;
}

export interface ActivateArgs {
  hwnd: number;
  retry: number;
  settle_delay_ms: number;
}

export interface DispatchArgs {
  hwnd: number;
  text: string;
  auto_enter: boolean;
  paste_delay_ms: number;
  enter_delay_ms: number;
  activate_retry: number;
  activate_settle_delay_ms: number;
}

export interface FindByRegexArgs {
  patterns: string[];
  include_invisible: boolean;
}

// ───────── Config Types (§9.1 多因子指纹) ─────────

export interface TargetMatchConfig {
  title_regex: string[];
  /** §9.1 绑定的 hwnd（主匹配） */
  bound_hwnd?: number;
  /** §9.1 exe 名称匹配 */
  exe_name?: string;
  /** §9.1 窗口类名匹配 */
  class_name?: string;
  /** §9.1 进程 ID（短期绑定） */
  process_id?: number;
}

/** §9.3 TargetStatus 状态机 */
export type TargetStatus = "ready" | "missing" | "ambiguous" | "needs_rebind" | "inactive";

/** §9.3 预检查结果 */
export interface PreflightResult {
  target_id: string;
  status: TargetStatus;
  matched_hwnd: number | null;
  matched_title: string | null;
  candidate_count: number;
  suggestion: string | null;
}

export interface TargetBehavior {
  auto_enter: boolean;
  paste_delay_ms: number;
  /** §9.6 粘贴后恢复剪贴板 */
  restore_clipboard_after_paste: boolean;
  /** §9.7 焦点配方 */
  focus_recipe: string[];
  /** §9.8 是否附加 Run-ID 水印 */
  append_run_watermark: boolean;
}

export interface TargetEntry {
  provider: string;
  match: TargetMatchConfig;
  behavior: TargetBehavior;
}

export interface TargetDefaults {
  activate_retry: number;
  fail_fast_ms: number;
}

export interface TargetsConfig {
  targets: Record<string, TargetEntry>;
  defaults: TargetDefaults;
}

// ───────── Skill Schema v3 (§6) ─────────

export interface SkillInput {
  type: string;
  required: boolean;
  description?: string;
  max_length?: number;
}

export interface SkillDispatch {
  mode: string;
  prefer_providers: string[];
  fixed_target: string | null;
  fanout_targets: string[];
  timeout_ms: number;
  retry_count: number;
}

export interface QualityGate {
  min_length?: number;
  max_length?: number;
  must_contain: string[];
  must_not_contain: string[];
}

export interface SkillFallback {
  fallback_providers: string[];
  fallback_skill?: string;
  action: string;
}

export interface SkillObservability {
  emit_start: boolean;
  emit_end: boolean;
  emit_error: boolean;
  custom_metrics: string[];
}

export interface Skill {
  id: string;
  version: string;
  title: string;
  intent_tags: string[];
  inputs: Record<string, SkillInput>;
  prompt_template: string;
  dispatch?: SkillDispatch;
  quality_gates: QualityGate[];
  fallbacks: SkillFallback[];
  observability?: SkillObservability;
  preconditions: string[];
  postconditions: string[];
  safety_level: string;
  cost_class: string;
  latency_class: string;
  determinism: string;
  cache_policy?: string;
}

// ───────── Workflow Schema v3 (§7 DAG++) ─────────

export interface RetryPolicy {
  max_retries: number;
  delay_ms: number;
  backoff: string;
}

export interface WorkflowStep {
  id?: string;
  use: string;
  depends_on: string[];
  retry_policy?: RetryPolicy;
  timeout_ms: number;
  compensation?: string;
  emit_events: string[];
  dispatch?: SkillDispatch;
}

export interface WorkflowPolicy {
  max_parallelism: number;
  global_timeout_ms: number;
  fail_policy: string;
  checkpoint_policy: string;
  resume_policy: string;
  merge_strategy: string;
}

export interface Workflow {
  id: string;
  version: string;
  title: string;
  steps: WorkflowStep[];
  policy: WorkflowPolicy;
}

// ───────── Router Rules Engine v2 (§5) ─────────

export interface IntentRule {
  keywords: string[];
  patterns: string[];
  dispatch_prefer: string[];
  fanout: boolean;
  confidence_boost: number;
}

export interface RouterRulesConfig {
  intents: Record<string, IntentRule>;
  defaults?: {
    fanout: boolean;
    auto_enter: boolean;
    confidence_auto_threshold: number;
    confidence_confirm_threshold: number;
  };
}

export interface RouteCandidate {
  intent: string;
  score: number;
  providers: string[];
  matched_rule_id: string;
  match_type: string;
  score_breakdown: Record<string, number>;
  fanout: boolean;
}

export interface RouteDecision {
  top_candidates: RouteCandidate[];
  selected?: RouteCandidate;
  confidence: number;
  action: string;
  explanation: string;
  trace_id: string;
}

// ───────── Health Check ─────────

export interface TargetHealth {
  target_id: string;
  provider: string;
  status: TargetStatus;
  matched: boolean;
  matched_title: string | null;
  matched_hwnd: number | null;
  error_code?: string | null;
  error_message?: string | null;
}

// ───────── Unified Error Model (§9) ─────────

export interface ApiError {
  code: string;
  message: string;
  details?: string;
  trace_id: string;
}

export interface ErrorDefinition {
  code: string;
  category: string;
  user_message: string;
  fix_suggestion: string;
  alert_level: string;
  auto_fix_strategy?: string;
}

// ───────── Vault / Run Archive (§2) ─────────

export interface RunRecord {
  id: string;
  ts_start: number;
  ts_end?: number;
  skill_id: string;
  workflow_id?: string;
  step_id?: string;
  target_id: string;
  provider: string;
  prompt: string;
  output?: string;
  status: string;
  error_code?: string;
  trace_id: string;
  route_decision?: RouteDecision;
  /** §37 步骤列表 */
  steps?: StepRecord[];
  /** §35 输出制品 ID 列表 */
  artifact_ids?: string[];
  /** §29 confirm_source: "user" | "policy" | null */
  confirm_source?: string;
  browser_id?: BrowserId;
  browser_candidates?: BrowserCandidate[];
  injection_audit?: InjectionAudit;
}

export interface VaultEvent {
  ts_ms: number;
  event_type: string;
  run_id?: string;
  step_id?: string;
  trace_id: string;
  action: string;
  outcome: string;
  detail?: string;
}

// ───────── Frontend State Machine (§3) ─────────

export type PageState =
  | "idle"
  | "loading"
  | "ready"
  | "editing"
  | "saving"
  | "validating"
  | "dispatching"
  | "waiting_capture"
  | "archived"
  | "error";

export interface StateTransition {
  from: PageState;
  to: PageState;
  action: string;
  timestamp: number;
}

// ───────── Self-Heal (§8) ─────────

export interface SelfHealAction {
  strategy_id: string;
  description: string;
  action_type: string;
  max_attempts: number;
  cooldown_ms: number;
}

// ───────── Artifact Model (§35) ─────────

export interface Artifact {
  artifact_id: string;
  run_id: string;
  step_id?: string;
  /** text | markdown | json | file */
  type: string;
  /** user | collector | grok | gemini | chatgpt_plus | deepseek | kimi 等 */
  producer: string;
  path?: string;
  created_at: number;
  checksum?: string;
  content?: string;
}

// ───────── Step Status Machine (§37) ─────────

export type StepStatus = "pending" | "dispatched" | "awaiting_send" | "waiting_output" | "captured" | "failed";

export interface StepRecord {
  id: string;
  run_id: string;
  skill_id: string;
  status: StepStatus;
  target_id?: string;
  input_artifacts: string[];
  output_artifact?: string;
  error_code?: string;
  trace_id?: string;
  ts_start?: number;
  ts_end?: number;
}

// ───────── Dispatch Trace (§9.9 + §29) ─────────

export interface DispatchTrace {
  trace_id: string;
  run_id?: string;
  step_id?: string;
  target_id?: string;
  ts_start: number;
  ts_end: number;
  duration_ms: number;
  candidate_windows: string[];
  matched_fingerprint?: string;
  matched_hwnd?: number;
  activation_ok: boolean;
  activation_attempts: number;
  clipboard_backup_ok: boolean;
  clipboard_restore_ok: boolean;
  focus_recipe_executed: boolean;
  stage_ok: boolean;
  confirm_ok?: boolean;
  clipboard_txn_id?: string;
  browser_id?: BrowserId;
  injection_trace_id?: string;
  outcome: string;
  error_detail?: string;
}

// ───────── Dispatch Stage Args (§9.4) ─────────

export interface DispatchStageArgs {
  hwnd: number;
  text: string;
  paste_delay_ms: number;
  activate_retry: number;
  activate_settle_delay_ms: number;
  restore_clipboard: boolean;
  focus_recipe: string[];
  run_id?: string;
  step_id?: string;
  target_id?: string;
  append_watermark: boolean;
}

export interface DispatchConfirmArgs {
  hwnd: number;
  enter_delay_ms: number;
}

export type BrowserId = "firefox" | "chrome" | "chromium" | "edge" | "brave" | "opera" | "vivaldi" | "arc" | "waterfox" | "librewolf" | "floorp" | "tor" | "other";

/** §61 浏览器画像 (BrowserProfile) */
export interface BrowserProfile {
  browser_id: BrowserId;
  exe_name: string;
  class_name: string;
  installed: boolean;
  running: boolean;
  window_count: number;
  supports_target: boolean;
  health_score: number;
}

/** §60 浏览器检测结果 — 含置信度与未知浏览器提醒 */
export interface BrowserDetectionResult {
  profiles: BrowserProfile[];
  /** 当浏览器不在预设名单时为 true，需提醒用户 */
  unknown_browser_warning: boolean;
  /** 给用户的提示文案 */
  warning_message?: string;
}

export interface BrowserCandidate {
  browser_id: BrowserId;
  hwnd: number;
  title: string;
  exe_name?: string | null;
  class_name?: string;
  score: number;
  reasons: string[];
}

export type InjectionMode = "strict" | "balanced" | "lean";

export interface InstructionBlock {
  block_id: string;
  source: "policy" | "user" | "workflow" | "skill" | "auto";
  priority: number;
  text: string;
}

export interface InjectionAudit {
  injection_trace_id: string;
  mode: InjectionMode;
  applied_blocks: InstructionBlock[];
  dropped_blocks: InstructionBlock[];
  conflicts: string[];
  final_prompt_checksum: string;
}

// Enterprise Closed Loop v2 shared contracts

export type MaturityLevel = "L1" | "L2" | "L3";

export type LifecyclePhase =
  | "demand"
  | "scope"
  | "design"
  | "build"
  | "verify"
  | "review"
  | "release"
  | "observe"
  | "improve"
  | "blocked";

export type ReleaseDecision = "Go" | "GoWithRisk" | "NoGo";

export type ReviewConclusion = "Pass" | "PassWithActions" | "Blocked";

export interface ChangeRecord {
  change_id: string;
  title: string;
  owner: string;
  scope: string;
  risk_level: string;
  run_id?: string;
  step_id?: string;
  trace_id?: string;
  acceptance_criteria: string[];
  rollback_plan: string;
}

export interface QualityGateResult {
  change_id: string;
  hard_gates: Record<string, boolean>;
  scorecard: {
    correctness: number;
    stability: number;
    performance: number;
    ux_consistency: number;
    security: number;
    maintainability: number;
    observability: number;
  };
}

export interface ReleaseDecisionRecord {
  change_id: string;
  decision: ReleaseDecision;
  approver: string;
  timestamp_utc: string;
  evidence: string[];
  notes?: string;
}

export interface IncidentRecord {
  incident_id: string;
  change_id?: string;
  severity: string;
  start_time_utc: string;
  end_time_utc?: string;
  impact: string;
  root_cause?: string;
  mitigation?: string;
  recovery_verification?: string;
  capa_actions: string[];
}

export interface TelemetryEvent {
  ts_ms: number;
  project: string;
  module: string;
  feature: string;
  code: string;
  severity: string;
  run_id?: string;
  step_id?: string;
  change_id?: string;
  trace_id?: string;
  detail?: string;
}

export interface GovernanceValidationReport {
  change_id: string;
  hard_gate_results: Record<string, boolean>;
  score_total: number;
  decision: ReleaseDecision;
  passed: boolean;
  issues: string[];
  generated_at: string;
}

export interface GovernanceSnapshot {
  change: ChangeRecord;
  quality: QualityGateResult;
  decision: ReleaseDecisionRecord;
}
