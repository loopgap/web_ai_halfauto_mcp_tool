import { invoke } from "@tauri-apps/api/core";
import type {
  WindowInfo,
  TargetsConfig,
  Skill,
  Workflow,
  RouterRulesConfig,
  TargetHealth,
  RouteDecision,
  RunRecord,
  ErrorDefinition,
  VaultEvent,
  PreflightResult,
  SelfHealAction,
  DispatchStageArgs,
  DispatchConfirmArgs,
  Artifact,
  DispatchTrace,
  TelemetryEvent,
  GovernanceValidationReport,
  GovernanceSnapshot,
  BrowserDetectionResult,
  ScheduledWorkflow,
  NewsSource,
  NewsItem,
  ReportDocument,
} from "./types";
import { normalizeError } from "./domain/errors";

async function invokeSafe<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(cmd, args);
  } catch (error) {
    throw normalizeError(error);
  }
}

// ═══ OS-Win Commands ═══

export async function enumWindows(includeInvisible = false): Promise<WindowInfo[]> {
  return invokeSafe("os_enum_windows", {
    args: { include_invisible: includeInvisible },
  });
}

export async function activateWindow(
  hwnd: number,
  retry = 3,
  settleDelayMs = 80
): Promise<void> {
  return invokeSafe("os_activate", {
    args: { hwnd, retry, settle_delay_ms: settleDelayMs },
  });
}

export async function findWindowByRegex(
  patterns: string[],
  includeInvisible = false
): Promise<WindowInfo> {
  return invokeSafe("os_find_window_by_title_regex", {
    args: { patterns, include_invisible: includeInvisible },
  });
}

export async function clipboardGetText(): Promise<string> {
  return invokeSafe("os_clipboard_get_text");
}

export async function clipboardSetText(text: string): Promise<void> {
  return invokeSafe("os_clipboard_set_text", { text });
}

export async function dispatchPaste(args: {
  hwnd: number;
  text: string;
  autoEnter?: boolean;
  pasteDelayMs?: number;
  enterDelayMs?: number;
  activateRetry?: number;
  activateSettleDelayMs?: number;
}): Promise<void> {
  return invokeSafe("os_dispatch_paste", {
    args: {
      hwnd: args.hwnd,
      text: args.text,
      auto_enter: args.autoEnter ?? false,
      paste_delay_ms: args.pasteDelayMs ?? 80,
      enter_delay_ms: args.enterDelayMs ?? 120,
      activate_retry: args.activateRetry ?? 3,
      activate_settle_delay_ms: args.activateSettleDelayMs ?? 80,
    },
  });
}

// ═══ Config Commands ═══

export async function loadTargetsConfig(): Promise<TargetsConfig> {
  return invokeSafe("load_targets_config");
}

export async function saveTargetsConfig(config: TargetsConfig): Promise<void> {
  return invokeSafe("save_targets_config", { configData: config });
}

export async function loadSkills(): Promise<Skill[]> {
  return invokeSafe("load_skills");
}

export async function loadWorkflows(): Promise<Workflow[]> {
  return invokeSafe("load_workflows");
}

export async function loadRouterRules(): Promise<RouterRulesConfig> {
  return invokeSafe("load_router_rules");
}

export async function saveRouterRules(rules: RouterRulesConfig): Promise<void> {
  return invokeSafe("save_router_rules", { rules });
}

export async function healthCheck(): Promise<TargetHealth[]> {
  return invokeSafe("health_check");
}

// ═══ Rule Engine v2 (§5) ═══

export async function routePrompt(prompt: string): Promise<RouteDecision> {
  return invokeSafe("route_prompt", { args: { prompt } });
}

// ═══ Vault / Archive (§2) ═══

export async function saveRun(run: RunRecord): Promise<void> {
  return invokeSafe("save_run", { run });
}

export async function loadRuns(): Promise<RunRecord[]> {
  return invokeSafe("load_runs");
}

export async function getErrorCatalog(): Promise<ErrorDefinition[]> {
  return invokeSafe("get_error_catalog");
}

export async function writeEvent(event: VaultEvent): Promise<void> {
  return invokeSafe("write_event", { event });
}

// ═══ Preflight (§9.3) ═══

export async function preflightTarget(targetId: string): Promise<PreflightResult> {
  return invokeSafe("preflight_target", { args: { target_id: targetId } });
}

// ═══ Two-Phase Dispatch (§9.4) ═══

export async function dispatchStage(args: DispatchStageArgs): Promise<DispatchTrace> {
  return invokeSafe<DispatchTrace>("dispatch_stage", {
    args: {
      hwnd: args.hwnd,
      text: args.text,
      paste_delay_ms: args.paste_delay_ms,
      activate_retry: args.activate_retry,
      activate_settle_delay_ms: args.activate_settle_delay_ms,
      restore_clipboard: args.restore_clipboard,
      focus_recipe: args.focus_recipe,
      run_id: args.run_id,
      step_id: args.step_id,
      target_id: args.target_id,
      append_watermark: args.append_watermark,
    },
  });
}

export async function dispatchConfirm(args: DispatchConfirmArgs): Promise<void> {
  return invokeSafe("dispatch_confirm", {
    args: { hwnd: args.hwnd, enter_delay_ms: args.enter_delay_ms },
  });
}

// ═══ Foreground (§9.5 Soft Lock) ═══

export async function getForegroundHwnd(): Promise<number> {
  return invokeSafe("get_foreground_hwnd");
}

// ═══ Self-Heal (§8) ═══

export async function getSelfHealRegistry(): Promise<SelfHealAction[]> {
  return invokeSafe("get_self_heal_registry");
}

// ═══ State Validation (§10) ═══

export async function validateRunTransition(from: string, to: string): Promise<boolean> {
  return invokeSafe("validate_run_transition", { args: { from, to } });
}

// ═══ Artifact (§35) ═══

export async function saveArtifact(artifact: Artifact): Promise<string> {
  return invokeSafe("save_artifact", { artifact });
}

// ═══ Dispatch Trace (§9.9) ═══

export async function saveDispatchTrace(trace: DispatchTrace): Promise<void> {
  return invokeSafe("save_dispatch_trace", { trace });
}

// ═══ Governance v2 ═══

export async function governanceValidate(changeId?: string): Promise<GovernanceValidationReport> {
  return invokeSafe("governance_validate", {
    args: { change_id: changeId ?? null },
  });
}

export async function governanceEmitTelemetry(event: TelemetryEvent): Promise<void> {
  return invokeSafe("governance_emit_telemetry", { event });
}

export async function governanceLatest(changeId?: string): Promise<GovernanceSnapshot | null> {
  return invokeSafe("governance_latest", {
    args: { change_id: changeId ?? null },
  });
}

// ═══ Route Feedback (§5) ═══

export async function saveRouteFeedback(args: {
  trace_id: string;
  decision_intent: string;
  user_action: string;
  override_intent?: string;
}): Promise<void> {
  return invokeSafe("save_route_feedback", {
    args: {
      trace_id: args.trace_id,
      decision_intent: args.decision_intent,
      user_action: args.user_action,
      override_intent: args.override_intent ?? null,
    },
  });
}

export async function getRouteFeedbacks(): Promise<import("./domain/feedback-learning").RouteFeedbackRecord[]> {
  return invokeSafe("get_route_feedbacks");
}

// ═══ Browser Detection (§60-§61) ═══

export async function detectBrowsers(): Promise<BrowserDetectionResult> {
  return invokeSafe("detect_browsers");
}

// ───────── §99-§100 Vault Stats & Cleanup ─────────

export interface VaultStats {
  vault_path: string;
  total_bytes: number;
  total_kb: number;
  file_count: number;
  by_subdir: Record<string, number>;
}

/** §99 获取 Vault 存储统计 */
export async function getVaultStats(): Promise<VaultStats> {
  return invokeSafe("get_vault_stats");
}

/** §100 清理超过指定天数的 Run 存档，返回删除数量 */
export async function cleanupVault(olderThanDays: number): Promise<number> {
  return invokeSafe("cleanup_vault", { olderThanDays });
}

// ───────── Scheduler v1 ─────────

export async function listSchedules(): Promise<ScheduledWorkflow[]> {
  return invokeSafe("list_schedules");
}

export async function saveSchedule(schedule: ScheduledWorkflow): Promise<void> {
  return invokeSafe("save_schedule", { schedule });
}

export async function deleteSchedule(scheduleId: string): Promise<void> {
  return invokeSafe("delete_schedule", { scheduleId });
}

export async function triggerScheduledWorkflow(scheduleId: string): Promise<void> {
  return invokeSafe("trigger_scheduled_workflow", { scheduleId });
}

// ───────── News / Report v1 ─────────

export async function listNewsSources(): Promise<NewsSource[]> {
  return invokeSafe("list_news_sources");
}

export async function saveNewsSource(source: NewsSource): Promise<void> {
  return invokeSafe("save_news_source", { source });
}

export async function deleteNewsSource(sourceId: string): Promise<void> {
  return invokeSafe("delete_news_source", { sourceId });
}

export async function fetchNewsFromSource(sourceId: string): Promise<NewsItem[]> {
  return invokeSafe("fetch_news_from_source", { sourceId });
}

export async function generateNewsReport(args: {
  title: string;
  sourceIds: string[];
  sinceTs?: number;
  untilTs?: number;
}): Promise<ReportDocument> {
  return invokeSafe("generate_news_report", {
    args: {
      title: args.title,
      source_ids: args.sourceIds,
      since_ts: args.sinceTs ?? null,
      until_ts: args.untilTs ?? null,
    },
  });
}

import { sendNotification } from '@tauri-apps/plugin-notification';
export async function notify(title: string, body: string) {
  try {
    sendNotification({ title, body });
  } catch (e) {
    console.warn('Notification failed:', e);
  }
}

