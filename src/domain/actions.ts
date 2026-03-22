// ═══════════════════════════════════════════════════════════
// Domain Layer — route.md §3 前端闭环
// 所有动作走 precheck → execute → verify → persist → feedback
// ═══════════════════════════════════════════════════════════

import type { Dispatch } from "react";
import type { AppAction } from "../store/AppStore";
import type {
  ApiError,
  RunRecord,
  RouteDecision,
  Skill,
  TargetsConfig,
  PreflightResult,
  SelfHealAction,
  Artifact,
  DispatchTrace,
  StepRecord,
  QualityGate,
  BrowserCandidate,
  BrowserId,
  InjectionAudit,
  InjectionMode,
  InstructionBlock,
  WindowInfo,
} from "../types";
import * as api from "../api";
import * as injection from "./injection";

const MAX_TEXT_LEN = 120_000;
const MAX_INPUT_LEN = 50_000;

// ───────── §28 Quality Gate 验收检查 ─────────

export interface QualityCheckResult {
  passed: boolean;
  failures: string[];
}

/** §28 Review Stage: 对 captured 内容执行质量门检查 */
export function checkQualityGates(text: string, gates: QualityGate[]): QualityCheckResult {
  const failures: string[] = [];
  for (const gate of gates) {
    if (gate.min_length && text.length < gate.min_length) {
      failures.push(`输出长度 (${text.length}) 小于最低要求 (${gate.min_length})`);
    }
    if (gate.max_length && text.length > gate.max_length) {
      failures.push(`输出长度 (${text.length}) 超出最大限制 (${gate.max_length})`);
    }
    for (const kw of gate.must_contain) {
      if (!text.includes(kw)) {
        failures.push(`输出中缺少必须包含的关键词: "${kw}"`);
      }
    }
    for (const kw of gate.must_not_contain) {
      if (text.includes(kw)) {
        failures.push(`输出中包含了禁止出现的关键词: "${kw}"`);
      }
    }
  }
  return { passed: failures.length === 0, failures };
}

// ───────── 脱敏工具 (§3 前端安全 — 错误日志自动脱敏) ─────────

function sanitizeForLog(text: string): string {
  return text
    .replace(/(?:password|token|secret|api[_-]?key)\s*[:=]\s*\S+/gi, "[REDACTED]")
    .replace(/[A-Za-z0-9+/]{32,}/g, "[REDACTED_BASE64]");
}

// ───────── 安全防护层 (Security Hardening) ─────────

/** Prompt 注入检测 — 检查常见 prompt injection 模式 */
const INJECTION_PATTERNS = [
  /ignore\s+(all\s+)?previous\s+instructions/i,
  /forget\s+(all\s+)?previous/i,
  /you\s+are\s+now\s+a/i,
  /system\s*:\s*/i,
  /\[INST\]/i,
  /<<SYS>>/i,
  /\bDAN\b.*\bmode\b/i,
  /jailbreak/i,
  /bypass\s+(all\s+)?safety/i,
  /act\s+as\s+(if\s+)?you\s+(have\s+)?no\s+restrictions/i,
];

export function detectPromptInjection(text: string): { detected: boolean; patterns: string[] } {
  const matched: string[] = [];
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(text)) {
      matched.push(pattern.source);
    }
  }
  return { detected: matched.length > 0, patterns: matched };
}

/** PII 检测 — 检查常见个人敏感信息 */
const PII_PATTERNS = [
  { name: "身份证号", pattern: /\b\d{17}[\dXx]\b/ },
  { name: "手机号", pattern: /\b1[3-9]\d{9}\b/ },
  { name: "邮箱", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/ },
  { name: "银行卡号", pattern: /\b\d{16,19}\b/ },
  { name: "社保号", pattern: /\b\d{3}-\d{2}-\d{4}\b/ },
];

export function detectPII(text: string): { detected: boolean; types: string[] } {
  const found: string[] = [];
  for (const { name, pattern } of PII_PATTERNS) {
    if (pattern.test(text)) {
      found.push(name);
    }
  }
  return { detected: found.length > 0, types: found };
}

/** 输入消毒 — 移除危险字符和控制序列 */
export function sanitizeInput(text: string): string {
  return text
    .replace(/\0/g, "")              // 空字节
    .replace(/[\x01-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "") // 控制字符
    .replace(/\r\n/g, "\n")          // 统一换行
    .trim();
}

/** 速率限制器 — 前端层防护 */
const rateLimitState: Record<string, { count: number; resetAt: number }> = {};

export function checkRateLimit(action: string, maxPerMinute: number = 10): boolean {
  const now = Date.now();
  const state = rateLimitState[action];
  if (!state || now >= state.resetAt) {
    rateLimitState[action] = { count: 1, resetAt: now + 60000 };
    return true;
  }
  if (state.count >= maxPerMinute) {
    return false;
  }
  state.count++;
  return true;
}

// ───────── Agent 闭环检测 (Closed-Loop Detection) ─────────

/** Agent 循环检测 — 检查连续步骤是否产生相似输出 */
export function detectAgentLoop(outputs: string[], similarityThreshold: number = 0.85): boolean {
  if (outputs.length < 3) return false;
  const recent = outputs.slice(-3);
  // 简单 Jaccard 相似度: 如果最近 3 次输出高度相似，认为进入循环
  for (let i = 0; i < recent.length - 1; i++) {
    const setA = new Set(recent[i].split(/\s+/));
    const setB = new Set(recent[i + 1].split(/\s+/));
    const intersection = new Set([...setA].filter((x) => setB.has(x)));
    const union = new Set([...setA, ...setB]);
    const similarity = union.size > 0 ? intersection.size / union.size : 0;
    if (similarity < similarityThreshold) return false;
  }
  return true;
}

/** 闭环一致性校验 — 验证 run 的状态转换是否符合预期 */
export function validateRunConsistency(run: RunRecord): { valid: boolean; issues: string[] } {
  const issues: string[] = [];
  // 1. 状态一致性
  if (run.status === "done" && !run.output) {
    issues.push("状态为 done 但无输出内容");
  }
  if (run.status === "done" && !run.ts_end) {
    issues.push("状态为 done 但无结束时间戳");
  }
  if (run.status === "failed" && !run.error_code) {
    issues.push("状态为 failed 但无错误码");
  }
  // 2. Step 一致性
  for (const step of run.steps ?? []) {
    if (step.status === "captured" && !step.output_artifact) {
      issues.push(`步骤 ${step.id} 状态为 captured 但无输出 artifact`);
    }
    if (step.status === "failed" && !step.error_code) {
      issues.push(`步骤 ${step.id} 状态为 failed 但无错误码`);
    }
  }
  // 3. 时间戳一致性
  if (run.ts_end && run.ts_end < run.ts_start) {
    issues.push("结束时间早于开始时间");
  }
  // 4. Trace ID 存在性
  if (!run.trace_id) {
    issues.push("缺少 trace_id，无法审计追踪");
  }
  return { valid: issues.length === 0, issues };
}

// ───────── 输入校验 (§3 前端安全 — 输入长度与格式校验) ─────────

export function validateInput(key: string, value: string, maxLen?: number): string | null {
  const limit = maxLen ?? MAX_INPUT_LEN;
  if (value.length > limit) {
    return `${key} 超出最大长度限制 (${limit})`;
  }
  if (value.includes('\0')) {
    return `${key} 包含非法字符`;
  }
  return null;
}

export function validatePrompt(text: string): string | null {
  if (text.trim().length === 0) return "Prompt 不能为空";
  if (text.length > MAX_TEXT_LEN) return `Prompt 超出最大长度 (${MAX_TEXT_LEN})`;
  if (text.includes('\0')) return "Prompt 包含非法字符";
  return null;
}

/** §60-§61 浏览器智能检测 — exe + class_name + title 启发式匹配，支持 12 种主流浏览器 */
function detectBrowserId(win: WindowInfo): BrowserId {
  const exe = (win.exe_name ?? "").toLowerCase();
  const cls = (win.class_name ?? "").toLowerCase();
  const title = (win.title ?? "").toLowerCase();

  // ── 精确 exe 匹配 (优先级最高) ──
  if (exe.includes("firefox") || exe.includes("firefox.exe")) return "firefox";
  if (exe.includes("waterfox")) return "waterfox";
  if (exe.includes("librewolf")) return "librewolf";
  if (exe.includes("floorp")) return "floorp";
  if (exe.includes("tor browser") || exe.includes("torbrowser")) return "tor";
  if (exe.includes("msedge")) return "edge";
  if (exe.includes("brave")) return "brave";
  if (exe.includes("vivaldi")) return "vivaldi";
  if (exe.includes("opera") || exe.includes("opera_gx")) return "opera";
  if (exe.includes("arc")) return "arc";
  if (exe.includes("chromium")) return "chromium";
  if (exe.includes("chrome")) return "chrome";

  // ── class_name 启发式 (exe 不可用时回退) ──
  if (cls.includes("mozillawindowclass")) {
    if (title.includes("waterfox")) return "waterfox";
    if (title.includes("librewolf")) return "librewolf";
    if (title.includes("floorp")) return "floorp";
    if (title.includes("tor")) return "tor";
    return "firefox";
  }
  if (cls.includes("chrome_widgetwin_1")) {
    if (title.includes("edge") || exe.includes("edge")) return "edge";
    if (title.includes("brave")) return "brave";
    if (title.includes("vivaldi")) return "vivaldi";
    if (title.includes("opera")) return "opera";
    if (title.includes("arc")) return "arc";
    return "chrome";
  }

  // ── title 兜底启发式 ──
  if (title.includes("firefox")) return "firefox";
  if (title.includes("chrome")) return "chrome";
  if (title.includes("edge")) return "edge";

  return "other";
}

/** 判断浏览器 ID 是否为已知预设类型 */
function isKnownBrowser(id: BrowserId): boolean {
  return id !== "other";
}

function scoreBrowserCandidate(win: WindowInfo): BrowserCandidate {
  const browserId = detectBrowserId(win);
  let score = 0;
  const reasons: string[] = [];
  if (win.is_visible) {
    score += 35;
    reasons.push("window_visible");
  }
  if (!win.is_minimized) {
    score += 25;
    reasons.push("not_minimized");
  }
  if (isKnownBrowser(browserId)) {
    score += 20;
    reasons.push(`known_browser:${browserId}`);
  } else {
    score += 5;
    reasons.push("unknown_browser:detection_heuristic");
  }
  if ((win.title || "").length > 0) {
    score += 10;
    reasons.push("title_present");
  }
  if (win.class_name) {
    score += 10;
    reasons.push("class_present");
  }
  return {
    browser_id: browserId,
    hwnd: win.hwnd,
    title: win.title,
    exe_name: win.exe_name,
    class_name: win.class_name,
    score,
    reasons,
  };
}

/** §60-§62 浏览器智能选择 — 含未知浏览器检测与警告 */
export async function selectBrowserWindowByRegex(patterns: string[]): Promise<{
  selected: BrowserCandidate;
  candidates: BrowserCandidate[];
  unknownBrowserWarning: boolean;
  warningMessage?: string;
}> {
  const windows = await api.enumWindows(false);
  const regexes = patterns
    .map((p) => {
      try {
        return new RegExp(p);
      } catch {
        return null;
      }
    })
    .filter((x): x is RegExp => Boolean(x));
  const matches = windows.filter((w) => regexes.some((re) => re.test(w.title)));
  if (matches.length === 0) {
    throw { code: "TARGET_NOT_FOUND", message: "No matched browser window", trace_id: `t${Date.now()}` } as ApiError;
  }
  const candidates = matches.map(scoreBrowserCandidate).sort((a, b) => b.score - a.score);
  const selected = candidates[0];

  // §60 未知浏览器智能检测与警告
  let unknownBrowserWarning = false;
  let warningMessage: string | undefined;
  if (!isKnownBrowser(selected.browser_id)) {
    unknownBrowserWarning = true;
    const exeHint = selected.exe_name ?? "unknown";
    const classHint = selected.class_name ?? "unknown";
    warningMessage = `检测到未识别的浏览器 (exe: ${exeHint}, class: ${classHint})。` +
      `系统将尝试使用该窗口，但可能存在兼容性风险。` +
      `建议使用 Firefox/Chrome/Edge/Brave 等主流浏览器，或进入绑定向导手动配置。`;
  }
  // §62 分差过小需提醒
  if (candidates.length >= 2 && candidates[0].score - candidates[1].score < 10) {
    if (!warningMessage) warningMessage = "";
    warningMessage += ` 多个浏览器窗口评分接近 (${candidates[0].score} vs ${candidates[1].score})，已自动选择最优窗口。`;
  }

  return { selected, candidates, unknownBrowserWarning, warningMessage };
}

function buildInjectedPrompt(basePrompt: string, mode: InjectionMode, autoInject: boolean): { finalPrompt: string; audit?: InjectionAudit } {
  if (!autoInject) {
    return { finalPrompt: basePrompt };
  }

  const policy = injection.defaultInjectionPolicy();
  policy.mode = mode;

  const workflowBlocks: injection.InjectionBlock[] = [];
  if (mode === "strict") {
    workflowBlocks.push({
      block_id: "strict-structure",
      source: "workflow",
      priority: 3,
      content: "输出必须使用结构化要点，先结论后依据，并列出风险与下一步。",
      dismissible: true,
    });
  } else if (mode === "balanced") {
    workflowBlocks.push({
      block_id: "balanced-clarity",
      source: "workflow",
      priority: 3,
      content: "请保持清晰、简洁且可执行，必要时给出最小闭环步骤。",
      dismissible: true,
    });
  } else {
    workflowBlocks.push({
      block_id: "lean-concise",
      source: "workflow",
      priority: 3,
      content: "请保持简洁，优先给出直接可执行结果。",
      dismissible: true,
    });
  }

  const { applied, dropped, conflicts } = injection.resolveInjectionBlocks(policy, workflowBlocks);
  const finalPrompt = injection.buildFinalPrompt(basePrompt, applied);
  const checksum = injection.promptChecksum(finalPrompt);

  const toInstBlock = (b: injection.InjectionBlock): InstructionBlock => ({
    block_id: b.block_id,
    source: b.source as InstructionBlock["source"],
    priority: b.priority,
    text: b.content,
  });

  return {
    finalPrompt,
    audit: {
      injection_trace_id: `inj-${Date.now()}`,
      mode,
      applied_blocks: applied.map(toInstBlock),
      dropped_blocks: dropped.map(toInstBlock),
      conflicts,
      final_prompt_checksum: checksum,
    },
  };
}

// ───────── §10 状态机约束 ─────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  created: ["dispatched", "failed", "cancelled"],
  dispatched: ["waiting_capture", "captured", "failed", "cancelled"],
  waiting_capture: ["captured", "failed", "cancelled"],
  captured: ["done", "failed"],
  failed: ["compensating", "closed"],
  compensating: ["done", "closed", "failed"],
  done: [],
  closed: [],
  cancelled: [],
};

export function canTransitionTo(from: string, to: string): boolean {
  return (VALID_TRANSITIONS[from] ?? []).includes(to);
}

// ───────── 闭环流程: 初始化数据加载 ─────────

export async function initializeApp(dispatch: Dispatch<AppAction>): Promise<void> {
  dispatch({ type: "SET_PAGE_STATE", payload: { page: "dashboard", state: "loading" } });
  try {
    const [skills, workflows, targets, health, rules, runs, errorCatalog] =
      await Promise.all([
        api.loadSkills(),
        api.loadWorkflows(),
        api.loadTargetsConfig(),
        api.healthCheck(),
        api.loadRouterRules(),
        api.loadRuns(),
        api.getErrorCatalog(),
      ]);

    dispatch({ type: "SET_SKILLS", payload: skills });
    dispatch({ type: "SET_WORKFLOWS", payload: workflows });
    dispatch({ type: "SET_TARGETS", payload: targets });
    dispatch({ type: "SET_HEALTH", payload: health });
    dispatch({ type: "SET_ROUTER_RULES", payload: rules });
    dispatch({ type: "SET_RUNS", payload: runs });
    dispatch({ type: "SET_ERROR_CATALOG", payload: errorCatalog });
    try {
      const snapshot = await api.governanceLatest();
      if (snapshot) {
        dispatch({ type: "UPSERT_GOV_CHANGE", payload: snapshot.change });
        dispatch({ type: "UPSERT_GOV_QUALITY", payload: snapshot.quality });
        dispatch({ type: "UPSERT_GOV_DECISION", payload: snapshot.decision });
      }
    } catch {
      // governance snapshot is optional during bootstrap
    }
    dispatch({ type: "SET_INITIALIZED", payload: true });
    dispatch({ type: "SET_PAGE_STATE", payload: { page: "dashboard", state: "ready" } });
  } catch (e) {
    const error = e as ApiError;
    console.error("Init error:", sanitizeForLog(JSON.stringify(error)));
    dispatch({ type: "SET_ERROR", payload: error });
    dispatch({ type: "SET_PAGE_STATE", payload: { page: "dashboard", state: "error" } });
  }
}

// ───────── §9.3 预检查闭环 ─────────

export async function preflightCheck(targetId: string): Promise<PreflightResult> {
  return api.preflightTarget(targetId);
}

// ───────── 闭环流程: 两阶段调度 (§9.4) ─────────

export interface DispatchFlowParams {
  skill: Skill;
  targetId: string;
  targets: TargetsConfig;
  inputValues: Record<string, string>;
  routeDecision?: RouteDecision;
  /** §9.4 两阶段提交: true=仅粘贴不发送 */
  stageOnly?: boolean;
  autoBrowserSelect?: boolean;
  autoInject?: boolean;
  injectionMode?: InjectionMode;
}

export interface DispatchResult {
  success: boolean;
  run?: RunRecord;
  error?: ApiError;
  /** §9.4 两阶段: 已暂存的 hwnd，用于 confirm */
  stagedHwnd?: number;
  /** §29.3 结构化执行证据 */
  dispatchTrace?: DispatchTrace;
  /** §60 未知浏览器警告 */
  browserWarning?: string;
}

/**
 * 完整调度闭环: precheck → preflight → execute → verify → persist → feedback
 * route.md §3 §8 §9
 */
export async function executeDispatchFlow(
  params: DispatchFlowParams,
  dispatch: Dispatch<AppAction>,
): Promise<DispatchResult> {
  const traceId = `t${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const runId = crypto.randomUUID();

  // ─── 0. 安全预检 ───
  // 速率限制检查
  if (!checkRateLimit("dispatch", 15)) {
    dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "error" } });
    return { success: false, error: { code: "SECURITY_RATE_LIMIT_EXCEEDED", message: "操作频率超出安全阈值，请稍后重试", trace_id: traceId } };
  }

  // ─── 1. Precheck (§3 §9.3) ───
  dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "validating" } });

  // 校验参数
  let renderedPrompt = params.skill.prompt_template;
  for (const [key, val] of Object.entries(params.inputValues)) {
    const err = validateInput(key, val, params.skill.inputs[key]?.max_length);
    if (err) {
      dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "error" } });
      return { success: false, error: { code: "INPUT_INVALID_FORMAT", message: err, trace_id: traceId } };
    }
    // 输入消毒
    const sanitized = sanitizeInput(val);
    renderedPrompt = renderedPrompt.replace(new RegExp(`\\{${key}\\}`, "g"), sanitized || `{${key}}`);
  }

  // Prompt 注入检测
  const injectionCheck = detectPromptInjection(renderedPrompt);
  if (injectionCheck.detected) {
    dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "error" } });
    return {
      success: false,
      error: {
        code: "SECURITY_PROMPT_INJECTION",
        message: `检测到可疑 Prompt 注入模式: ${injectionCheck.patterns.slice(0, 2).join(", ")}`,
        trace_id: traceId,
      },
    };
  }

  // PII 检测（仅警告，不阻止）
  const piiCheck = detectPII(renderedPrompt);
  if (piiCheck.detected) {
    console.warn(`[Security] PII detected in prompt: ${piiCheck.types.join(", ")}. Consider redacting.`);
  }

  const { finalPrompt, audit: injectionAudit } = buildInjectedPrompt(
    renderedPrompt,
    params.injectionMode ?? "balanced",
    params.autoInject ?? true,
  );

  const promptErr = validatePrompt(finalPrompt);
  if (promptErr) {
    dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "error" } });
    return { success: false, error: { code: "INPUT_EMPTY", message: promptErr, trace_id: traceId } };
  }

  // 校验 target
  const target = params.targets.targets[params.targetId];
  if (!target) {
    dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "error" } });
    return {
      success: false,
      error: { code: "TARGET_NOT_FOUND", message: `Target ${params.targetId} not found`, trace_id: traceId },
    };
  }

  // 必填字段检查
  for (const [key, input] of Object.entries(params.skill.inputs)) {
    if (input.required && !params.inputValues[key]?.trim()) {
      dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "error" } });
      return {
        success: false,
        error: { code: "INPUT_EMPTY", message: `Required input "${key}" is empty`, trace_id: traceId },
      };
    }
  }

  // Agent 模式前置条件检查
  if (params.skill.preconditions?.includes("user_confirmed_agent_mode")) {
    // Agent 模式需要额外确认（由 UI 层 showConfirm 处理）
    if (params.skill.safety_level === "dangerous") {
      console.info(`[Agent] Skill ${params.skill.id} requires agent mode confirmation`);
    }
  }

  // §9.3 Preflight: 检查 target 状态
  try {
    const preflight = await api.preflightTarget(params.targetId);
    if (preflight.status !== "ready") {
      dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "error" } });
      return {
        success: false,
        error: {
          code: "TARGET_NOT_FOUND",
          message: preflight.suggestion ?? `Target 状态: ${preflight.status}`,
          trace_id: traceId,
        },
      };
    }
  } catch {
    // Preflight failure is non-blocking in fallback mode
  }

  // ─── 2. Execute (§9.4 two-phase) ───
  dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "dispatching" } });

  // §9.5 Soft Lock: 验证目标窗口可用性
  try {
    const fgHwnd = await api.getForegroundHwnd();
    if (fgHwnd === 0) {
      console.warn("[§9.5] Foreground hwnd is 0, may indicate focus instability");
    }
  } catch {
    // Soft lock check is non-blocking
  }

  // §37 创建 StepRecord
  const stepId = `step-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const step: StepRecord = {
    id: stepId,
    run_id: runId,
    skill_id: params.skill.id,
    status: "pending",
    target_id: params.targetId,
    input_artifacts: [],
    ts_start: Date.now(),
  };

  const run: RunRecord = {
    id: runId,
    ts_start: Date.now(),
    skill_id: params.skill.id,
    target_id: params.targetId,
    provider: target.provider,
    prompt: finalPrompt,
    status: "dispatched",
    trace_id: traceId,
    route_decision: params.routeDecision,
    steps: [step],
  };

  try {
    let win: WindowInfo;
    let browserCandidates: BrowserCandidate[] = [];
    let browserWarning: string | undefined;
    if (params.autoBrowserSelect ?? true) {
      const browserSelection = await selectBrowserWindowByRegex(target.match.title_regex);
      browserCandidates = browserSelection.candidates;
      if (browserSelection.unknownBrowserWarning && browserSelection.warningMessage) {
        browserWarning = browserSelection.warningMessage;
      }
      win = {
        hwnd: browserSelection.selected.hwnd,
        title: browserSelection.selected.title,
        class_name: browserSelection.selected.class_name ?? "",
        process_id: 0,
        exe_name: browserSelection.selected.exe_name ?? null,
        is_visible: true,
        is_minimized: false,
      };
      run.browser_id = browserSelection.selected.browser_id;
      run.browser_candidates = browserCandidates;
    } else {
      win = await api.findWindowByRegex(target.match.title_regex);
      const detected = detectBrowserId(win);
      run.browser_id = detected;
      run.browser_candidates = [scoreBrowserCandidate(win)];
      if (!isKnownBrowser(detected)) {
        browserWarning = `检测到未识别的浏览器 (exe: ${win.exe_name ?? "unknown"})。建议使用主流浏览器以获得最佳兼容性。`;
      }
    }
    if (injectionAudit) {
      run.injection_audit = injectionAudit;
    }

    // §9.4 Two-phase: dispatch_stage (paste only, no enter)
    const dispatchTrace = await api.dispatchStage({
      hwnd: win.hwnd,
      text: finalPrompt,
      paste_delay_ms: target.behavior.paste_delay_ms,
      activate_retry: 3,
      activate_settle_delay_ms: 80,
      restore_clipboard: target.behavior.restore_clipboard_after_paste,
      focus_recipe: target.behavior.focus_recipe,
      run_id: runId,
      step_id: stepId,
      target_id: params.targetId,
      append_watermark: target.behavior.append_run_watermark,
    });
    run.trace_id = dispatchTrace.trace_id;
    step.status = "dispatched";
    step.trace_id = dispatchTrace.trace_id;

    if (params.stageOnly) {
      step.status = "awaiting_send";
      dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "waiting_capture" } });
      dispatch({ type: "ADD_RUN", payload: run });
      await api.saveRun(run).catch((e) => console.error('[actions] saveRun(stage) persist failed:', e));
      return { success: true, run, stagedHwnd: win.hwnd, dispatchTrace, browserWarning };
    }

    // §9.4 Auto-confirm if auto_enter
    if (target.behavior.auto_enter) {
      await api.dispatchConfirm({ hwnd: win.hwnd, enter_delay_ms: 120 });
      step.status = "waiting_output";
      run.confirm_source = "policy";
    }

    // ─── 3. Verify (标记等待 capture) ───
    dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "waiting_capture" } });

    // ─── 4. Persist ───
    dispatch({ type: "ADD_RUN", payload: run });
    await api.saveRun(run).catch((e) => console.error('[actions] saveRun(dispatch) persist failed:', e));

    // ─── 5. Feedback ───
    return { success: true, run, stagedHwnd: win.hwnd, dispatchTrace, browserWarning };
  } catch (e) {
    const error = e as ApiError;
    run.status = "failed";
    run.error_code = error.code;
    run.ts_end = Date.now();
    step.status = "failed";
    step.error_code = error.code;
    step.ts_end = Date.now();

    dispatch({ type: "ADD_RUN", payload: run });
    dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "error" } });
    await api.saveRun(run).catch((e) => console.error('[actions] saveRun(error) persist failed:', e));

    // 闭环一致性校验
    const consistency = validateRunConsistency(run);
    if (!consistency.valid) {
      console.warn("[ClosedLoop] Run consistency issues:", consistency.issues);
    }

    return { success: false, run, error };
  }
}

// ───────── §9.4 两阶段: 确认发送 ─────────

export async function confirmSend(
  hwnd: number,
  _runId: string,
  dispatch: Dispatch<AppAction>,
): Promise<{ success: boolean; error?: ApiError }> {
  // 速率限制
  if (!checkRateLimit("confirm_send", 20)) {
    return { success: false, error: { code: "SECURITY_RATE_LIMIT_EXCEEDED", message: "确认发送过于频繁", trace_id: `cs-${Date.now()}` } };
  }
  try {
    await api.dispatchConfirm({ hwnd, enter_delay_ms: 120 });
    dispatch({
      type: "UPDATE_RUN",
      payload: { id: _runId, updates: { confirm_source: "user" } },
    });
    dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "waiting_capture" } });
    return { success: true };
  } catch (e) {
    const error = e as ApiError;
    dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "error" } });
    return { success: false, error };
  }
}

// ───────── §9.8 水印解析工具 ─────────

const WATERMARK_REGEX = /\[AIWB_RUN_ID=(\S+)\s+STEP=(\S+)\s+TARGET=(\S+)\]/;

export function parseWatermark(text: string): { runId: string; stepId: string; targetId: string } | null {
  const match = text.match(WATERMARK_REGEX);
  if (!match) return null;
  return { runId: match[1], stepId: match[2], targetId: match[3] };
}

/** 去除水印标记，返回纯净内容 */
function stripWatermark(text: string): string {
  return text.replace(WATERMARK_REGEX, "").trim();
}

// ───────── §42.3 智能恢复路径 ─────────

export interface RecoveryAction {
  label: string;
  action: string;
  description: string;
  primary: boolean;
}

/** 每个错误码绑定首选修复动作 — route.md §42.3 */
export function getRecoveryActions(errorCode: string): RecoveryAction[] {
  const map: Record<string, RecoveryAction[]> = {
    TARGET_NOT_FOUND: [
      { label: "重新检测窗口", action: "redetect", description: "刷新并重新匹配目标窗口", primary: true },
      { label: "打开绑定向导", action: "wizard", description: "进入目标绑定向导", primary: false },
    ],
    TARGET_ACTIVATE_FAILED: [
      { label: "执行焦点配方", action: "focus_recipe", description: "重新聚焦并激活窗口", primary: true },
      { label: "手动切换", action: "manual", description: "手动切换到目标窗口", primary: false },
    ],
    CLIPBOARD_BUSY: [
      { label: "重试剪贴板", action: "retry_clipboard", description: "重试写入并恢复剪贴板", primary: true },
      { label: "查看指南", action: "guide", description: "检查剪贴板权限/设置", primary: false },
    ],
    DISPATCH_RATE_LIMITED: [
      { label: "稍后重试", action: "delay_retry", description: "等待后自动重试", primary: true },
    ],
    INPUT_EMPTY: [
      { label: "返回编辑", action: "edit", description: "填写必要的输入字段", primary: true },
    ],
    INPUT_INVALID_FORMAT: [
      { label: "返回编辑", action: "edit", description: "修正输入格式", primary: true },
    ],
    STATE_TRANSITION_INVALID: [
      { label: "刷新状态", action: "refresh", description: "重新加载运行状态", primary: true },
    ],
    PAYLOAD_TOO_LARGE: [
      { label: "缩减输入", action: "edit", description: "缩短 Prompt 后重试", primary: true },
    ],
    DISPATCH_DUPLICATE_CONFIRM: [
      { label: "继续等待", action: "wait", description: "发送已确认，等待输出", primary: true },
    ],
    CAPTURE_EMPTY: [
      { label: "复制后重试", action: "retry_capture", description: "先复制模型输出，再执行 Capture", primary: true },
      { label: "标记为空", action: "mark_empty", description: "确认该步骤无输出", primary: false },
    ],
    DISPATCH_FOCUS_DRIFT: [
      { label: "重新激活", action: "reactivate", description: "重新激活目标窗口后重试", primary: true },
      { label: "执行焦点配方", action: "focus_recipe", description: "执行 Provider 焦点配方", primary: false },
    ],
    BROWSER_NOT_AVAILABLE: [
      { label: "打开浏览器", action: "open_browser", description: "请打开目标浏览器后重试", primary: true },
      { label: "切换推荐浏览器", action: "switch_browser", description: "使用其他可用浏览器", primary: false },
    ],
    BROWSER_SELECT_CONFLICT: [
      { label: "手动选择", action: "manual_select", description: "手动指定目标浏览器窗口", primary: true },
      { label: "进入绑定向导", action: "wizard", description: "通过向导精确绑定窗口", primary: false },
    ],
    BROWSER_FALLBACK_FAILED: [
      { label: "进入绑定向导", action: "wizard", description: "重新绑定目标浏览器", primary: true },
      { label: "重新检测", action: "redetect", description: "刷新窗口列表并重新匹配", primary: false },
    ],
    // ── 安全相关恢复动作 ──
    SECURITY_PROMPT_INJECTION: [
      { label: "清理输入", action: "edit", description: "移除可疑注入内容后重试", primary: true },
      { label: "查看详情", action: "detail", description: "查看检测到的注入模式", primary: false },
    ],
    SECURITY_RATE_LIMIT_EXCEEDED: [
      { label: "等待冷却", action: "delay_retry", description: "等待速率限制冷却后重试", primary: true },
    ],
    SECURITY_INPUT_SANITIZE_FAILED: [
      { label: "返回编辑", action: "edit", description: "检查并修正输入内容", primary: true },
    ],
    SECURITY_PII_DETECTED: [
      { label: "脱敏后重试", action: "edit", description: "移除敏感信息后重试", primary: true },
    ],
    // ── Agent 相关恢复动作 ──
    AGENT_LOOP_DETECTED: [
      { label: "调整任务描述", action: "edit", description: "修改任务描述以打破循环", primary: true },
      { label: "手动中断", action: "cancel", description: "终止 Agent 执行", primary: false },
    ],
    AGENT_MAX_STEPS_EXCEEDED: [
      { label: "增大步骤限制", action: "edit", description: "提高最大步骤数后重试", primary: true },
      { label: "缩小任务范围", action: "edit", description: "缩减任务范围", primary: false },
    ],
    AGENT_BUDGET_EXCEEDED: [
      { label: "调整预算", action: "edit", description: "增加预算或简化任务", primary: true },
    ],
    // ── 闭环检测恢复动作 ──
    CLOSED_LOOP_TIMEOUT: [
      { label: "重试", action: "retry", description: "重新执行闭环流程", primary: true },
      { label: "检查目标", action: "redetect", description: "检查目标窗口状态", primary: false },
    ],
    CLOSED_LOOP_QUALITY_FAIL: [
      { label: "重新投递", action: "retry", description: "重新投递并等待更高质量输出", primary: true },
      { label: "调整参数", action: "edit", description: "修改输入参数后重试", primary: false },
    ],
    CLOSED_LOOP_INCONSISTENT: [
      { label: "刷新数据", action: "refresh", description: "重新加载最新状态", primary: true },
    ],
  };

  return map[errorCode] ?? [
    { label: "重试", action: "retry", description: "重试此操作", primary: true },
    { label: "查看详情", action: "detail", description: "检查错误与追踪 ID", primary: false },
  ];
}

// ───────── 闭环流程: Capture 输出 ─────────

export async function captureOutput(
  runId: string,
  dispatch: Dispatch<AppAction>,
  /** §28 quality gates — 传入当前 skill 的 gates 用于验收 */
  qualityGates?: QualityGate[],
): Promise<{ success: boolean; text?: string; error?: ApiError; boundRunId?: string; boundStepId?: string; qualityResult?: QualityCheckResult; securityWarnings?: string[] }> {
  try {
    const rawText = await api.clipboardGetText();

    // §29.5 验证输出非空
    if (!rawText || rawText.trim().length === 0) {
      return {
        success: false,
        error: {
          code: "CAPTURE_EMPTY",
          message: "采集到的剪贴板内容为空。请先复制模型输出。",
          trace_id: `cap-${Date.now()}`,
        },
      };
    }

    // §9.8 水印解析 — 自动归档到对应 run/step
    const watermark = parseWatermark(rawText);
    const cleanText = stripWatermark(rawText);
    const effectiveRunId = watermark?.runId ?? runId;
    const effectiveStepId = watermark?.stepId;

    const securityWarnings: string[] = [];

    // 输出安全校验
    const outputInjection = detectPromptInjection(cleanText);
    if (outputInjection.detected) {
      console.warn("[Security] Output contains suspicious patterns:", outputInjection.patterns);
      securityWarnings.push(`检测到输出可疑模式: ${outputInjection.patterns.slice(0, 2).join(", ")}`);
    }

    // §35 创建 Artifact
    const artifact: Artifact = {
      artifact_id: `art-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      run_id: effectiveRunId,
      step_id: effectiveStepId,
      type: "text",
      producer: watermark?.targetId ?? "user",
      created_at: Date.now(),
      content: cleanText,
    };

    // 保存 Artifact 到 vault
    await api.saveArtifact(artifact).catch((e) => console.error('[actions] saveArtifact persist failed:', e));

    // §28 Quality Gate 验收
    const qualityResult = qualityGates && qualityGates.length > 0
      ? checkQualityGates(cleanText, qualityGates)
      : { passed: true, failures: [] };

    dispatch({
      type: "UPDATE_RUN",
      payload: {
        id: effectiveRunId,
        updates: {
          output: cleanText,
          status: qualityResult.passed ? "captured" : "captured",
          ts_end: Date.now(),
          artifact_ids: [artifact.artifact_id],
        },
      },
    });
    dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "archived" } });

    api.notify("AI Workbench", "输出已成功拉取并归档").catch(() => {});

    return {
      success: true,
      text: cleanText,
      boundRunId: watermark ? effectiveRunId : undefined,
      boundStepId: effectiveStepId ?? undefined,
      qualityResult,
      securityWarnings,
    };
  } catch (e) {
    const error = e as ApiError;
    return { success: false, error };
  }
}

// ───────── 闭环流程: 保存 Targets 配置 ─────────

export async function saveTargetsFlow(
  config: TargetsConfig,
  dispatch: Dispatch<AppAction>,
): Promise<{ success: boolean; error?: ApiError }> {
  dispatch({ type: "SET_PAGE_STATE", payload: { page: "targets", state: "saving" } });
  try {
    await api.saveTargetsConfig(config);
    dispatch({ type: "SET_TARGETS", payload: config });
    dispatch({ type: "SET_PAGE_STATE", payload: { page: "targets", state: "ready" } });
    return { success: true };
  } catch (e) {
    const error = e as ApiError;
    dispatch({ type: "SET_ERROR", payload: error });
    dispatch({ type: "SET_PAGE_STATE", payload: { page: "targets", state: "error" } });
    return { success: false, error };
  }
}

// ───────── 闭环流程: 路由决策 ─────────

export async function routePromptFlow(
  prompt: string,
): Promise<{ success: boolean; decision?: RouteDecision; error?: ApiError }> {
  try {
    const decision = await api.routePrompt(prompt);
    return { success: true, decision };
  } catch (e) {
    return { success: false, error: e as ApiError };
  }
}

// ───────── §5 反馈学习: 记录用户 accept/reject/override ─────────

export async function recordRouteFeedback(
  traceId: string,
  decisionIntent: string,
  userAction: "accept" | "reject" | "override",
  overrideIntent?: string,
): Promise<void> {
  try {
    await api.saveRouteFeedback({
      trace_id: traceId,
      decision_intent: decisionIntent,
      user_action: userAction,
      override_intent: overrideIntent,
    });
  } catch {
    console.warn("[§5] Failed to save route feedback");
  }
}

// ───────── 错误码查找 ─────────

export function lookupError(catalog: { code: string; user_message: string; fix_suggestion: string }[], code: string) {
  return catalog.find((e) => e.code === code);
}

// ───────── §8 自愈查找 ─────────

export function lookupSelfHeal(registry: SelfHealAction[], strategyId: string): SelfHealAction | undefined {
  return registry.find((a) => a.strategy_id === strategyId);
}


