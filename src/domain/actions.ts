// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?
// Domain Layer 鈥?route.md 搂3 鍓嶇闂幆
// 鎵€鏈夊姩浣滆蛋 precheck 鈫?execute 鈫?verify 鈫?persist 鈫?feedback
// 鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺愨晲鈺?

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

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ 搂28 Quality Gate 楠屾敹妫€鏌?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export interface QualityCheckResult {
  passed: boolean;
  failures: string[];
}

/** 搂28 Review Stage: 瀵?captured 鍐呭鎵ц璐ㄩ噺闂ㄦ鏌?*/
export function checkQualityGates(text: string, gates: QualityGate[]): QualityCheckResult {
  const failures: string[] = [];
  for (const gate of gates) {
    if (gate.min_length && text.length < gate.min_length) {
      failures.push(`杈撳嚭闀垮害 (${text.length}) 灏忎簬鏈€浣庤姹?(${gate.min_length})`);
    }
    if (gate.max_length && text.length > gate.max_length) {
      failures.push(`杈撳嚭闀垮害 (${text.length}) 瓒呭嚭鏈€澶ч檺鍒?(${gate.max_length})`);
    }
    for (const kw of gate.must_contain) {
      if (!text.includes(kw)) {
        failures.push(`杈撳嚭涓己灏戝繀椤诲寘鍚殑鍏抽敭璇? "${kw}"`);
      }
    }
    for (const kw of gate.must_not_contain) {
      if (text.includes(kw)) {
        failures.push(`杈撳嚭涓寘鍚簡绂佹鍑虹幇鐨勫叧閿瘝: "${kw}"`);
      }
    }
  }
  return { passed: failures.length === 0, failures };
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ 鑴辨晱宸ュ叿 (搂3 鍓嶇瀹夊叏 鈥?閿欒鏃ュ織鑷姩鑴辨晱) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function sanitizeForLog(text: string): string {
  return text
    .replace(/(?:password|token|secret|api[_-]?key)\s*[:=]\s*\S+/gi, "[REDACTED]")
    .replace(/[A-Za-z0-9+/]{32,}/g, "[REDACTED_BASE64]");
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ 杈撳叆鏍￠獙 (搂3 鍓嶇瀹夊叏 鈥?杈撳叆闀垮害涓庢牸寮忔牎楠? 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export function validateInput(key: string, value: string, maxLen?: number): string | null {
  const limit = maxLen ?? MAX_INPUT_LEN;
  if (value.length > limit) {
    return `${key} 瓒呭嚭鏈€澶ч暱搴﹂檺鍒?(${limit})`;
  }
  if (value.includes('\0')) {
    return `${key} 鍖呭惈闈炴硶瀛楃`;
  }
  return null;
}

export function validatePrompt(text: string): string | null {
  if (text.trim().length === 0) return "Prompt 涓嶈兘涓虹┖";
  if (text.length > MAX_TEXT_LEN) return `Prompt 瓒呭嚭鏈€澶ч暱搴?(${MAX_TEXT_LEN})`;
  if (text.includes('\0')) return "Prompt 鍖呭惈闈炴硶瀛楃";
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
    // Mozilla 家族: Firefox/Waterfox/LibreWolf/Floorp/Tor
    if (title.includes("waterfox")) return "waterfox";
    if (title.includes("librewolf")) return "librewolf";
    if (title.includes("floorp")) return "floorp";
    if (title.includes("tor")) return "tor";
    return "firefox";
  }
  if (cls.includes("chrome_widgetwin_1")) {
    // Chromium 家族: Chrome/Edge/Brave/Vivaldi/Opera/Arc
    if (title.includes("edge") || exe.includes("edge")) return "edge";
    if (title.includes("brave")) return "brave";
    if (title.includes("vivaldi")) return "vivaldi";
    if (title.includes("opera")) return "opera";
    if (title.includes("arc")) return "arc";
    return "chrome"; // default Chromium family
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
    // §60 未知浏览器扣分但不排除
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

  // Delegate to unified injection engine (injection.ts §82-86)
  const policy = injection.defaultInjectionPolicy();
  policy.mode = mode;

  // Mode-specific workflow blocks
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

  // Map InjectionBlock → InstructionBlock for the audit record
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

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ 搂10 鐘舵€佹満绾︽潫 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

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

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ 闂幆娴佺▼: 鍒濆鍖栨暟鎹姞杞?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

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

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ 搂9.3 棰勬鏌ラ棴鐜?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export async function preflightCheck(targetId: string): Promise<PreflightResult> {
  return api.preflightTarget(targetId);
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ 闂幆娴佺▼: 涓ら樁娈佃皟搴?(搂9.4) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export interface DispatchFlowParams {
  skill: Skill;
  targetId: string;
  targets: TargetsConfig;
  inputValues: Record<string, string>;
  routeDecision?: RouteDecision;
  /** 搂9.4 涓ら樁娈垫彁浜? true=浠呯矘璐翠笉鍙戦€?*/
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
 * 瀹屾暣璋冨害闂幆: precheck 鈫?preflight 鈫?execute 鈫?verify 鈫?persist 鈫?feedback
 * route.md 搂3 搂8 搂9
 */
export async function executeDispatchFlow(
  params: DispatchFlowParams,
  dispatch: Dispatch<AppAction>,
): Promise<DispatchResult> {
  const traceId = `t${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const runId = crypto.randomUUID();

  // 鈹€鈹€鈹€ 1. Precheck (搂3 搂9.3) 鈹€鈹€鈹€
  dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "validating" } });

  // 鏍￠獙鍙傛暟
  let renderedPrompt = params.skill.prompt_template;
  for (const [key, val] of Object.entries(params.inputValues)) {
    const err = validateInput(key, val, params.skill.inputs[key]?.max_length);
    if (err) {
      dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "error" } });
      return { success: false, error: { code: "INPUT_INVALID_FORMAT", message: err, trace_id: traceId } };
    }
    renderedPrompt = renderedPrompt.replace(new RegExp(`\\{${key}\\}`, "g"), val || `{${key}}`);
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

  // 鏍￠獙 target
  const target = params.targets.targets[params.targetId];
  if (!target) {
    dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "error" } });
    return {
      success: false,
      error: { code: "TARGET_NOT_FOUND", message: `Target ${params.targetId} not found`, trace_id: traceId },
    };
  }

  // 蹇呭～瀛楁妫€鏌?
  for (const [key, input] of Object.entries(params.skill.inputs)) {
    if (input.required && !params.inputValues[key]?.trim()) {
      dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "error" } });
      return {
        success: false,
        error: { code: "INPUT_EMPTY", message: `Required input "${key}" is empty`, trace_id: traceId },
      };
    }
  }

  // 搂9.3 Preflight: 妫€鏌?target 鐘舵€?
  try {
    const preflight = await api.preflightTarget(params.targetId);
    if (preflight.status !== "ready") {
      dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "error" } });
      return {
        success: false,
        error: {
          code: "TARGET_NOT_FOUND",
          message: preflight.suggestion ?? `Target 鐘舵€? ${preflight.status}`,
          trace_id: traceId,
        },
      };
    }
  } catch {
    // Preflight failure is non-blocking in fallback mode, try direct match
  }

  // 鈹€鈹€鈹€ 2. Execute (搂9.4 two-phase) 鈹€鈹€鈹€
  dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "dispatching" } });

  // 搂9.5 Soft Lock: 楠岃瘉鐩爣绐楀彛鍙敤鎬э紙鍓嶇疆妫€鏌ワ級
  try {
    const fgHwnd = await api.getForegroundHwnd();
    // Soft lock just logs for now; actual enforcement is in Rust dispatch_stage
    if (fgHwnd === 0) {
      console.warn("[搂9.5] Foreground hwnd is 0, may indicate focus instability");
    }
  } catch {
    // Soft lock check is non-blocking
  }

  // 搂37 鍒涘缓 StepRecord
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
      // §60 捕获未知浏览器警告
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

    // 搂9.4 Two-phase: use dispatch_stage (paste only, no enter)
    // 搂29.3 杩斿洖缁撴瀯鍖?DispatchTrace
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
    // 搂37 鏇存柊 step 鐘舵€?
    step.status = "dispatched";
    step.trace_id = dispatchTrace.trace_id;

    if (params.stageOnly) {
      // 搂9.4 Stage only: waiting for user confirm
      step.status = "awaiting_send";
      dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "waiting_capture" } });
      dispatch({ type: "ADD_RUN", payload: run });
      await api.saveRun(run).catch((e) => console.error('[actions] saveRun(stage) persist failed:', e));
      return { success: true, run, stagedHwnd: win.hwnd, dispatchTrace, browserWarning };
    }

    // §9.4 Auto-confirm if not stage-only AND auto_enter is true
    if (target.behavior.auto_enter) {
      await api.dispatchConfirm({ hwnd: win.hwnd, enter_delay_ms: 120 });
      step.status = "waiting_output";
      run.confirm_source = "policy";
    }

    // 鈹€鈹€鈹€ 3. Verify (鏍囪绛夊緟 capture) 鈹€鈹€鈹€
    dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "waiting_capture" } });

    // 鈹€鈹€鈹€ 4. Persist 鈹€鈹€鈹€
    dispatch({ type: "ADD_RUN", payload: run });
    await api.saveRun(run).catch((e) => console.error('[actions] saveRun(dispatch) persist failed:', e));

    // ─── 5. Feedback ───
    return { success: true, run, stagedHwnd: win.hwnd, dispatchTrace, browserWarning };
  } catch (e) {
    const error = e as ApiError;
    run.status = "failed";
    run.error_code = error.code;
    run.ts_end = Date.now();
    // 搂37 step 澶辫触
    step.status = "failed";
    step.error_code = error.code;
    step.ts_end = Date.now();

    dispatch({ type: "ADD_RUN", payload: run });
    dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "error" } });
    await api.saveRun(run).catch((e) => console.error('[actions] saveRun(error) persist failed:', e));

    return { success: false, run, error };
  }
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ 搂9.4 涓ら樁娈? 纭鍙戦€?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export async function confirmSend(
  hwnd: number,
  _runId: string,
  dispatch: Dispatch<AppAction>,
): Promise<{ success: boolean; error?: ApiError }> {
  try {
    await api.dispatchConfirm({ hwnd, enter_delay_ms: 120 });
    // 搂29.4 濉厖 confirm_source
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

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ 搂9.8 姘村嵃瑙ｆ瀽宸ュ叿 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

const WATERMARK_REGEX = /\[AIWB_RUN_ID=(\S+)\s+STEP=(\S+)\s+TARGET=(\S+)\]/;

export function parseWatermark(text: string): { runId: string; stepId: string; targetId: string } | null {
  const match = text.match(WATERMARK_REGEX);
  if (!match) return null;
  return { runId: match[1], stepId: match[2], targetId: match[3] };
}

/** 鍘婚櫎姘村嵃鏍囪锛岃繑鍥炵函鍑€鍐呭 */
function stripWatermark(text: string): string {
  return text.replace(WATERMARK_REGEX, "").trim();
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ 搂42.3 鏅鸿兘鎭㈠璺緞 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export interface RecoveryAction {
  label: string;
  action: string;
  description: string;
  primary: boolean;
}

/** 姣忎釜閿欒鐮佺粦瀹?棣栭€変慨澶嶅姩浣? 鈥?route.md 搂42.3 */
export function getRecoveryActions(errorCode: string): RecoveryAction[] {
  const map: Record<string, RecoveryAction[]> = {
    TARGET_NOT_FOUND: [
      { label: "Detect windows again", action: "redetect", description: "Refresh and rematch target windows", primary: true },
      { label: "Open binding wizard", action: "wizard", description: "Open target binding wizard", primary: false },
    ],
    TARGET_ACTIVATE_FAILED: [
      { label: "Run focus recipe", action: "focus_recipe", description: "Re-focus input and reactivate window", primary: true },
      { label: "Switch manually", action: "manual", description: "Switch to target window manually", primary: false },
    ],
    CLIPBOARD_BUSY: [
      { label: "Retry clipboard", action: "retry_clipboard", description: "Retry write and clipboard restore", primary: true },
      { label: "Open guide", action: "guide", description: "Check clipboard permission/settings", primary: false },
    ],
    DISPATCH_RATE_LIMITED: [
      { label: "Retry later", action: "delay_retry", description: "Wait and retry after backoff", primary: true },
    ],
    INPUT_EMPTY: [
      { label: "Back to edit", action: "edit", description: "Fill required inputs", primary: true },
    ],
    INPUT_INVALID_FORMAT: [
      { label: "Back to edit", action: "edit", description: "Fix input format", primary: true },
    ],
    STATE_TRANSITION_INVALID: [
      { label: "Refresh state", action: "refresh", description: "Reload run state", primary: true },
    ],
    PAYLOAD_TOO_LARGE: [
      { label: "Reduce input", action: "edit", description: "Shorten prompt and retry", primary: true },
    ],
    DISPATCH_DUPLICATE_CONFIRM: [
      { label: "Keep waiting", action: "wait", description: "Send already confirmed, wait for output", primary: true },
    ],
    CAPTURE_EMPTY: [
      { label: "Copy and retry", action: "retry_capture", description: "Copy model output first, then capture", primary: true },
      { label: "Mark empty", action: "mark_empty", description: "Confirm no output for this step", primary: false },
    ],
    DISPATCH_FOCUS_DRIFT: [
      { label: "Reactivate window", action: "reactivate", description: "Reactivate target and retry", primary: true },
      { label: "Run focus recipe", action: "focus_recipe", description: "Apply provider focus recipe", primary: false },
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
  };

  return map[errorCode] ?? [
    { label: "Retry", action: "retry", description: "Retry the operation", primary: true },
    { label: "Show details", action: "detail", description: "Inspect error and trace id", primary: false },
  ];
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ 闂幆娴佺▼: Capture 杈撳嚭 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export async function captureOutput(
  runId: string,
  dispatch: Dispatch<AppAction>,
  /** 搂28 quality gates 鈥?浼犲叆褰撳墠 skill 鐨?gates 鐢ㄤ簬楠屾敹 */
  qualityGates?: QualityGate[],
): Promise<{ success: boolean; text?: string; error?: ApiError; boundRunId?: string; boundStepId?: string; qualityResult?: QualityCheckResult }> {
  try {
    const rawText = await api.clipboardGetText();

    // 搂29.5 楠岃瘉杈撳嚭闈炵┖
    if (!rawText || rawText.trim().length === 0) {
      return {
        success: false,
        error: {
          code: "CAPTURE_EMPTY",
          message: "Captured clipboard text is empty. Copy model output first.",
          trace_id: `cap-${Date.now()}`,
        },
      };
    }

    // 搂9.8 姘村嵃瑙ｆ瀽 鈥?鑷姩褰掓。鍒板搴?run/step
    const watermark = parseWatermark(rawText);
    const cleanText = stripWatermark(rawText);
    const effectiveRunId = watermark?.runId ?? runId;
    const effectiveStepId = watermark?.stepId;

    // 搂35 鍒涘缓 Artifact
    const artifact: Artifact = {
      artifact_id: `art-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      run_id: effectiveRunId,
      step_id: effectiveStepId,
      type: "text",
      producer: watermark?.targetId ?? "user",
      created_at: Date.now(),
      content: cleanText,
    };

    // 淇濆瓨 Artifact 鍒?vault
    await api.saveArtifact(artifact).catch((e) => console.error('[actions] saveArtifact persist failed:', e));

    // 搂28 Quality Gate 楠屾敹
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

    return {
      success: true,
      text: cleanText,
      boundRunId: watermark ? effectiveRunId : undefined,
      boundStepId: effectiveStepId ?? undefined,
      qualityResult,
    };
  } catch (e) {
    const error = e as ApiError;
    return { success: false, error };
  }
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ 闂幆娴佺▼: 淇濆瓨 Targets 閰嶇疆 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

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

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ 闂幆娴佺▼: 璺敱鍐崇瓥 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

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

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ 搂5 鍙嶉瀛︿範: 璁板綍鐢ㄦ埛 accept/reject/override 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

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
    // 搂5 feedback is non-blocking; failure doesn't interrupt main flow
    console.warn("[搂5] Failed to save route feedback");
  }
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ 閿欒鐮佹煡鎵?鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export function lookupError(catalog: { code: string; user_message: string; fix_suggestion: string }[], code: string) {
  return catalog.find((e) => e.code === code);
}

// 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€ 搂8 鑷剤鏌ユ壘 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

export function lookupSelfHeal(registry: SelfHealAction[], strategyId: string): SelfHealAction | undefined {
  return registry.find((a) => a.strategy_id === strategyId);
}


