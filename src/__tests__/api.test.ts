// ═══════════════════════════════════════════════════════════
// api.ts 单元测试 — Tauri invoke 包装函数
// ═══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from "vitest";
import { invoke } from "@tauri-apps/api/core";
import {
  enumWindows,
  activateWindow,
  findWindowByRegex,
  clipboardGetText,
  clipboardSetText,
  dispatchPaste,
  loadTargetsConfig,
  saveTargetsConfig,
  loadSkills,
  loadWorkflows,
  loadRouterRules,
  healthCheck,
  routePrompt,
  saveRun,
  loadRuns,
  getErrorCatalog,
  writeEvent,
  preflightTarget,
  dispatchStage,
  dispatchConfirm,
  getForegroundHwnd,
  getSelfHealRegistry,
  validateRunTransition,
  saveArtifact,
  saveDispatchTrace,
  governanceValidate,
  governanceEmitTelemetry,
  governanceLatest,
  saveRouteFeedback,
  detectBrowsers,
  getVaultStats,
  cleanupVault,
  listSchedules,
  saveSchedule,
  deleteSchedule,
  triggerScheduledWorkflow,
  listNewsSources,
  saveNewsSource,
  deleteNewsSource,
  fetchNewsFromSource,
  generateNewsReport,
  notify,
} from "../api";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

vi.mock("@tauri-apps/plugin-notification", () => ({
  sendNotification: vi.fn(),
}));

const mockInvoke = vi.mocked(invoke);

beforeEach(() => {
  mockInvoke.mockReset();
});

// ═══════════════════════════════════════════════════════════
// Mock Data
// ═══════════════════════════════════════════════════════════

const MOCK_WINDOW_INFO = {
  hwnd: 12345,
  title: "Test Window",
  class_name: "TestClass",
  process_id: 999,
  exe_name: "test.exe",
  is_visible: true,
  is_minimized: false,
};

const MOCK_TARGETS_CONFIG = {
  targets: {
    notepad: {
      provider: "notepad",
      match: { title_regex: ["Notepad"] },
      behavior: {
        auto_enter: false,
        paste_delay_ms: 80,
        restore_clipboard_after_paste: true,
        focus_recipe: [],
        append_run_watermark: false,
      },
    },
  },
  defaults: { activate_retry: 3, fail_fast_ms: 5000 },
};

const MOCK_SKILL = {
  id: "skill-1",
  version: "1.0",
  title: "Test Skill",
  intent_tags: ["test"],
  inputs: {},
  prompt_template: "Test prompt",
  quality_gates: [],
  fallbacks: [],
  preconditions: [],
  postconditions: [],
  safety_level: "low",
  cost_class: "cheap",
  latency_class: "fast",
  determinism: "high",
};

const MOCK_WORKFLOW = {
  id: "wf-1",
  version: "1.0",
  title: "Test Workflow",
  steps: [],
  policy: {
    max_parallelism: 1,
    global_timeout_ms: 60000,
    fail_policy: "abort",
    checkpoint_policy: "none",
    resume_policy: "none",
    merge_strategy: "replace",
  },
};

const MOCK_ROUTER_RULES = {
  intents: {
    test: {
      keywords: ["test"],
      patterns: [],
      dispatch_prefer: [],
      fanout: false,
      confidence_boost: 0,
    },
  },
};

const MOCK_TARGET_HEALTH = {
  target_id: "notepad",
  provider: "notepad",
  status: "ready" as const,
  matched: true,
  matched_title: "Notepad",
  matched_hwnd: 12345,
};

const MOCK_ROUTE_DECISION = {
  top_candidates: [],
  selected: undefined,
  confidence: 0.9,
  action: "dispatch",
  explanation: "Test",
  trace_id: "trace-1",
};

const MOCK_RUN_RECORD = {
  id: "run-1",
  ts_start: Date.now(),
  skill_id: "skill-1",
  target_id: "notepad",
  provider: "notepad",
  prompt: "test prompt",
  status: "completed",
  trace_id: "trace-1",
};

const MOCK_ERROR_DEFINITION = {
  code: "TEST_ERROR",
  category: "TEST",
  user_message: "Test error",
  fix_suggestion: "Fix it",
  alert_level: "warn",
};

const MOCK_VAULT_EVENT = {
  ts_ms: Date.now(),
  event_type: "test_event",
  trace_id: "trace-1",
  action: "test",
  outcome: "success",
};

const MOCK_PREFLIGHT_RESULT = {
  target_id: "notepad",
  status: "ready" as const,
  matched_hwnd: 12345,
  matched_title: "Notepad",
  candidate_count: 1,
  suggestion: null,
};

const MOCK_DISPATCH_TRACE = {
  trace_id: "trace-1",
  ts_start: Date.now() - 1000,
  ts_end: Date.now(),
  duration_ms: 1000,
  candidate_windows: [],
  activation_ok: true,
  activation_attempts: 1,
  clipboard_backup_ok: true,
  clipboard_restore_ok: true,
  focus_recipe_executed: false,
  stage_ok: true,
  outcome: "success",
};

const MOCK_SELF_HEAL_ACTION = {
  strategy_id: "retry",
  description: "Retry action",
  action_type: "RETRY",
  max_attempts: 3,
  cooldown_ms: 1000,
};

const MOCK_ARTIFACT = {
  artifact_id: "art-1",
  run_id: "run-1",
  type: "text",
  producer: "user",
  created_at: Date.now(),
  content: "Test content",
};

const MOCK_GOVERNANCE_REPORT = {
  change_id: "change-1",
  hard_gate_results: { gate1: true },
  score_total: 80,
  decision: "Go" as const,
  passed: true,
  issues: [],
  generated_at: new Date().toISOString(),
};

const MOCK_GOVERNANCE_SNAPSHOT = {
  change: {
    change_id: "change-1",
    title: "Test Change",
    owner: "test",
    scope: "test",
    risk_level: "low",
    acceptance_criteria: [],
    rollback_plan: "none",
  },
  quality: {
    change_id: "change-1",
    hard_gates: {},
    scorecard: {
      correctness: 80,
      stability: 80,
      performance: 80,
      ux_consistency: 80,
      security: 80,
      maintainability: 80,
      observability: 80,
    },
  },
  decision: {
    change_id: "change-1",
    decision: "Go" as const,
    approver: "test",
    timestamp_utc: new Date().toISOString(),
    evidence: [],
  },
};

const MOCK_BROWSER_RESULT = {
  profiles: [
    {
      browser_id: "chrome" as const,
      exe_name: "chrome.exe",
      class_name: "Chrome_WidgetWin_1",
      installed: true,
      running: false,
      window_count: 0,
      supports_target: true,
      health_score: 100,
    },
  ],
  unknown_browser_warning: false,
};

const MOCK_VAULT_STATS = {
  vault_path: "/vault",
  total_bytes: 1024,
  total_kb: 1,
  file_count: 10,
  by_subdir: { runs: 10 },
};

const MOCK_SCHEDULE = {
  id: "sched-1",
  workflow_id: "wf-1",
  trigger: { type: "once" as const, once_at: Date.now() + 86400000 },
  enabled: true,
  next_run_at: Date.now() + 86400000,
  last_run_at: undefined,
  failure_count: 0,
  created_at: Date.now(),
  updated_at: Date.now(),
};

const MOCK_NEWS_SOURCE = {
  id: "source-1",
  name: "Test Source",
  type: "rss" as const,
  endpoint: "https://example.com/feed",
  enabled: true,
  poll_interval_ms: 3600000,
};

const MOCK_NEWS_ITEM = {
  id: "news-1",
  source_id: "source-1",
  source_name: "Test Source",
  title: "Test News",
  content: "Test content",
  published_at: Date.now(),
  fetched_at: Date.now(),
};

const MOCK_REPORT_DOCUMENT = {
  id: "report-1",
  title: "Test Report",
  generated_at: Date.now(),
  format: "markdown" as const,
  content: "# Test Report\n\nTest content",
  source_ids: ["source-1"],
  item_ids: ["news-1"],
};

// ═══════════════════════════════════════════════════════════
// OS-Win Commands
// ═══════════════════════════════════════════════════════════

describe("OS-Win Commands", () => {
  describe("enumWindows", () => {
    it("returns window list without includeInvisible", async () => {
      mockInvoke.mockResolvedValueOnce([MOCK_WINDOW_INFO]);
      const result = await enumWindows();
      expect(result).toEqual([MOCK_WINDOW_INFO]);
      expect(mockInvoke).toHaveBeenCalledWith("os_enum_windows", {
        args: { include_invisible: false },
      });
    });

    it("passes includeInvisible when true", async () => {
      mockInvoke.mockResolvedValueOnce([MOCK_WINDOW_INFO]);
      await enumWindows(true);
      expect(mockInvoke).toHaveBeenCalledWith("os_enum_windows", {
        args: { include_invisible: true },
      });
    });
  });

  describe("activateWindow", () => {
    it("calls os_activate with default params", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await activateWindow(12345);
      expect(mockInvoke).toHaveBeenCalledWith("os_activate", {
        args: { hwnd: 12345, retry: 3, settle_delay_ms: 80 },
      });
    });

    it("passes custom retry and delay params", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await activateWindow(12345, 5, 100);
      expect(mockInvoke).toHaveBeenCalledWith("os_activate", {
        args: { hwnd: 12345, retry: 5, settle_delay_ms: 100 },
      });
    });
  });

  describe("findWindowByRegex", () => {
    it("calls os_find_window_by_title_regex with patterns", async () => {
      mockInvoke.mockResolvedValueOnce(MOCK_WINDOW_INFO);
      const patterns = ["Notepad", "Editor"];
      const result = await findWindowByRegex(patterns, true);
      expect(result).toEqual(MOCK_WINDOW_INFO);
      expect(mockInvoke).toHaveBeenCalledWith("os_find_window_by_title_regex", {
        args: { patterns, include_invisible: true },
      });
    });
  });

  describe("clipboardGetText", () => {
    it("returns text from clipboard", async () => {
      mockInvoke.mockResolvedValueOnce("clipboard text");
      const result = await clipboardGetText();
      expect(result).toBe("clipboard text");
      expect(mockInvoke).toHaveBeenCalledWith("os_clipboard_get_text", undefined);
    });
  });

  describe("clipboardSetText", () => {
    it("sets text to clipboard", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await clipboardSetText("test text");
      expect(mockInvoke).toHaveBeenCalledWith("os_clipboard_set_text", {
        text: "test text",
      });
    });
  });

  describe("dispatchPaste", () => {
    it("calls os_dispatch_paste with all args", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await dispatchPaste({
        hwnd: 12345,
        text: "paste me",
        autoEnter: true,
        pasteDelayMs: 100,
        enterDelayMs: 200,
        activateRetry: 5,
        activateSettleDelayMs: 90,
      });
      expect(mockInvoke).toHaveBeenCalledWith("os_dispatch_paste", {
        args: {
          hwnd: 12345,
          text: "paste me",
          auto_enter: true,
          paste_delay_ms: 100,
          enter_delay_ms: 200,
          activate_retry: 5,
          activate_settle_delay_ms: 90,
        },
      });
    });

    it("uses default values when optional args omitted", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await dispatchPaste({ hwnd: 12345, text: "paste me" });
      expect(mockInvoke).toHaveBeenCalledWith("os_dispatch_paste", {
        args: {
          hwnd: 12345,
          text: "paste me",
          auto_enter: false,
          paste_delay_ms: 80,
          enter_delay_ms: 120,
          activate_retry: 3,
          activate_settle_delay_ms: 80,
        },
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════
// Config Commands
// ═══════════════════════════════════════════════════════════

describe("Config Commands", () => {
  describe("loadTargetsConfig", () => {
    it("returns targets config", async () => {
      mockInvoke.mockResolvedValueOnce(MOCK_TARGETS_CONFIG);
      const result = await loadTargetsConfig();
      expect(result).toEqual(MOCK_TARGETS_CONFIG);
      expect(mockInvoke).toHaveBeenCalledWith("load_targets_config", undefined);
    });
  });

  describe("saveTargetsConfig", () => {
    it("saves targets config", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await saveTargetsConfig(MOCK_TARGETS_CONFIG);
      expect(mockInvoke).toHaveBeenCalledWith("save_targets_config", {
        configData: MOCK_TARGETS_CONFIG,
      });
    });
  });

  describe("loadSkills", () => {
    it("returns skill list", async () => {
      mockInvoke.mockResolvedValueOnce([MOCK_SKILL]);
      const result = await loadSkills();
      expect(result).toEqual([MOCK_SKILL]);
      expect(mockInvoke).toHaveBeenCalledWith("load_skills", undefined);
    });
  });

  describe("loadWorkflows", () => {
    it("returns workflow list", async () => {
      mockInvoke.mockResolvedValueOnce([MOCK_WORKFLOW]);
      const result = await loadWorkflows();
      expect(result).toEqual([MOCK_WORKFLOW]);
      expect(mockInvoke).toHaveBeenCalledWith("load_workflows", undefined);
    });
  });

  describe("loadRouterRules", () => {
    it("returns router rules config", async () => {
      mockInvoke.mockResolvedValueOnce(MOCK_ROUTER_RULES);
      const result = await loadRouterRules();
      expect(result).toEqual(MOCK_ROUTER_RULES);
      expect(mockInvoke).toHaveBeenCalledWith("load_router_rules", undefined);
    });
  });

  describe("healthCheck", () => {
    it("returns target health list", async () => {
      mockInvoke.mockResolvedValueOnce([MOCK_TARGET_HEALTH]);
      const result = await healthCheck();
      expect(result).toEqual([MOCK_TARGET_HEALTH]);
      expect(mockInvoke).toHaveBeenCalledWith("health_check", undefined);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// Rule Engine v2
// ═══════════════════════════════════════════════════════════

describe("Rule Engine v2", () => {
  describe("routePrompt", () => {
    it("returns route decision", async () => {
      mockInvoke.mockResolvedValueOnce(MOCK_ROUTE_DECISION);
      const result = await routePrompt("test prompt");
      expect(result).toEqual(MOCK_ROUTE_DECISION);
      expect(mockInvoke).toHaveBeenCalledWith("route_prompt", {
        args: { prompt: "test prompt" },
      });
    });

    it("normalizes error response", async () => {
      mockInvoke.mockRejectedValueOnce({
        code: "ROUTE_ERROR",
        message: "Routing failed",
        trace_id: "t1",
      });
      await expect(routePrompt("test")).rejects.toMatchObject({
        code: "ROUTE_ERROR",
        message: "Routing failed",
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════
// Vault / Archive
// ═══════════════════════════════════════════════════════════

describe("Vault / Archive", () => {
  describe("saveRun", () => {
    it("saves run record", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await saveRun(MOCK_RUN_RECORD);
      expect(mockInvoke).toHaveBeenCalledWith("save_run", {
        run: MOCK_RUN_RECORD,
      });
    });
  });

  describe("loadRuns", () => {
    it("returns run record list", async () => {
      mockInvoke.mockResolvedValueOnce([MOCK_RUN_RECORD]);
      const result = await loadRuns();
      expect(result).toEqual([MOCK_RUN_RECORD]);
      expect(mockInvoke).toHaveBeenCalledWith("load_runs", undefined);
    });
  });

  describe("getErrorCatalog", () => {
    it("returns error definition list", async () => {
      mockInvoke.mockResolvedValueOnce([MOCK_ERROR_DEFINITION]);
      const result = await getErrorCatalog();
      expect(result).toEqual([MOCK_ERROR_DEFINITION]);
      expect(mockInvoke).toHaveBeenCalledWith("get_error_catalog", undefined);
    });
  });

  describe("writeEvent", () => {
    it("writes vault event", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await writeEvent(MOCK_VAULT_EVENT);
      expect(mockInvoke).toHaveBeenCalledWith("write_event", {
        event: MOCK_VAULT_EVENT,
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════
// Preflight
// ═══════════════════════════════════════════════════════════

describe("Preflight", () => {
  describe("preflightTarget", () => {
    it("returns preflight result", async () => {
      mockInvoke.mockResolvedValueOnce(MOCK_PREFLIGHT_RESULT);
      const result = await preflightTarget("notepad");
      expect(result).toEqual(MOCK_PREFLIGHT_RESULT);
      expect(mockInvoke).toHaveBeenCalledWith("preflight_target", {
        args: { target_id: "notepad" },
      });
    });

    it("normalizes error from Tauri", async () => {
      mockInvoke.mockRejectedValueOnce({
        code: "TARGET_NOT_FOUND",
        message: "Target not found",
        trace_id: "t1",
        details: "No matching window",
      });
      await expect(preflightTarget("unknown")).rejects.toMatchObject({
        code: "TARGET_NOT_FOUND",
        message: "Target not found",
        details: "No matching window",
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════
// Two-Phase Dispatch
// ═══════════════════════════════════════════════════════════

describe("Two-Phase Dispatch", () => {
  describe("dispatchStage", () => {
    it("calls dispatch_stage with full args", async () => {
      mockInvoke.mockResolvedValueOnce(MOCK_DISPATCH_TRACE);
      const args = {
        hwnd: 12345,
        text: "test text",
        paste_delay_ms: 80,
        activate_retry: 3,
        activate_settle_delay_ms: 80,
        restore_clipboard: true,
        focus_recipe: ["Alt+D", "Ctrl+F"],
        run_id: "run-1",
        step_id: "step-1",
        target_id: "notepad",
        append_watermark: false,
      };
      const result = await dispatchStage(args);
      expect(result).toEqual(MOCK_DISPATCH_TRACE);
      expect(mockInvoke).toHaveBeenCalledWith("dispatch_stage", { args });
    });

    it("normalizes error with trace_id", async () => {
      mockInvoke.mockRejectedValueOnce({
        code: "DISPATCH_FAILED",
        message: "Dispatch stage failed",
        trace_id: "trace-error-1",
      });
      await expect(
        dispatchStage({
          hwnd: 12345,
          text: "test",
          paste_delay_ms: 80,
          activate_retry: 3,
          activate_settle_delay_ms: 80,
          restore_clipboard: false,
          focus_recipe: [],
          append_watermark: false,
        })
      ).rejects.toMatchObject({
        code: "DISPATCH_FAILED",
        trace_id: "trace-error-1",
      });
    });
  });

  describe("dispatchConfirm", () => {
    it("calls dispatch_confirm with args", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await dispatchConfirm({ hwnd: 12345, enter_delay_ms: 120 });
      expect(mockInvoke).toHaveBeenCalledWith("dispatch_confirm", {
        args: { hwnd: 12345, enter_delay_ms: 120 },
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════
// Foreground
// ═══════════════════════════════════════════════════════════

describe("Foreground", () => {
  describe("getForegroundHwnd", () => {
    it("returns foreground window handle", async () => {
      mockInvoke.mockResolvedValueOnce(12345);
      const result = await getForegroundHwnd();
      expect(result).toBe(12345);
      expect(mockInvoke).toHaveBeenCalledWith("get_foreground_hwnd", undefined);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// Self-Heal
// ═══════════════════════════════════════════════════════════

describe("Self-Heal", () => {
  describe("getSelfHealRegistry", () => {
    it("returns self heal actions", async () => {
      mockInvoke.mockResolvedValueOnce([MOCK_SELF_HEAL_ACTION]);
      const result = await getSelfHealRegistry();
      expect(result).toEqual([MOCK_SELF_HEAL_ACTION]);
      expect(mockInvoke).toHaveBeenCalledWith("get_self_heal_registry", undefined);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// State Validation
// ═══════════════════════════════════════════════════════════

describe("State Validation", () => {
  describe("validateRunTransition", () => {
    it("returns true for valid transition", async () => {
      mockInvoke.mockResolvedValueOnce(true);
      const result = await validateRunTransition("idle", "ready");
      expect(result).toBe(true);
      expect(mockInvoke).toHaveBeenCalledWith("validate_run_transition", {
        args: { from: "idle", to: "ready" },
      });
    });

    it("returns false for invalid transition", async () => {
      mockInvoke.mockResolvedValueOnce(false);
      const result = await validateRunTransition("archived", "idle");
      expect(result).toBe(false);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// Artifact
// ═══════════════════════════════════════════════════════════

describe("Artifact", () => {
  describe("saveArtifact", () => {
    it("returns artifact id", async () => {
      mockInvoke.mockResolvedValueOnce("art-1");
      const result = await saveArtifact(MOCK_ARTIFACT);
      expect(result).toBe("art-1");
      expect(mockInvoke).toHaveBeenCalledWith("save_artifact", {
        artifact: MOCK_ARTIFACT,
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════
// Dispatch Trace
// ═══════════════════════════════════════════════════════════

describe("Dispatch Trace", () => {
  describe("saveDispatchTrace", () => {
    it("saves dispatch trace", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await saveDispatchTrace(MOCK_DISPATCH_TRACE);
      expect(mockInvoke).toHaveBeenCalledWith("save_dispatch_trace", {
        trace: MOCK_DISPATCH_TRACE,
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════
// Governance v2
// ═══════════════════════════════════════════════════════════

describe("Governance v2", () => {
  describe("governanceValidate", () => {
    it("validates with changeId", async () => {
      mockInvoke.mockResolvedValueOnce(MOCK_GOVERNANCE_REPORT);
      const result = await governanceValidate("change-1");
      expect(result).toEqual(MOCK_GOVERNANCE_REPORT);
      expect(mockInvoke).toHaveBeenCalledWith("governance_validate", {
        args: { change_id: "change-1" },
      });
    });

    it("validates without changeId", async () => {
      mockInvoke.mockResolvedValueOnce(MOCK_GOVERNANCE_REPORT);
      await governanceValidate();
      expect(mockInvoke).toHaveBeenCalledWith("governance_validate", {
        args: { change_id: null },
      });
    });
  });

  describe("governanceEmitTelemetry", () => {
    it("emits telemetry event", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      const event = {
        ts_ms: Date.now(),
        project: "test",
        module: "test",
        feature: "test",
        code: "test",
        severity: "info",
      };
      await governanceEmitTelemetry(event);
      expect(mockInvoke).toHaveBeenCalledWith("governance_emit_telemetry", {
        event,
      });
    });
  });

  describe("governanceLatest", () => {
    it("returns governance snapshot with changeId", async () => {
      mockInvoke.mockResolvedValueOnce(MOCK_GOVERNANCE_SNAPSHOT);
      const result = await governanceLatest("change-1");
      expect(result).toEqual(MOCK_GOVERNANCE_SNAPSHOT);
      expect(mockInvoke).toHaveBeenCalledWith("governance_latest", {
        args: { change_id: "change-1" },
      });
    });

    it("returns null when no snapshot", async () => {
      mockInvoke.mockResolvedValueOnce(null);
      const result = await governanceLatest();
      expect(result).toBeNull();
      expect(mockInvoke).toHaveBeenCalledWith("governance_latest", {
        args: { change_id: null },
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════
// Route Feedback
// ═══════════════════════════════════════════════════════════

describe("Route Feedback", () => {
  describe("saveRouteFeedback", () => {
    it("saves route feedback with override", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await saveRouteFeedback({
        trace_id: "trace-1",
        decision_intent: "dispatch",
        user_action: "accepted",
        override_intent: "defer",
      });
      expect(mockInvoke).toHaveBeenCalledWith("save_route_feedback", {
        args: {
          trace_id: "trace-1",
          decision_intent: "dispatch",
          user_action: "accepted",
          override_intent: "defer",
        },
      });
    });

    it("saves route feedback without override", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await saveRouteFeedback({
        trace_id: "trace-1",
        decision_intent: "dispatch",
        user_action: "accepted",
      });
      expect(mockInvoke).toHaveBeenCalledWith("save_route_feedback", {
        args: {
          trace_id: "trace-1",
          decision_intent: "dispatch",
          user_action: "accepted",
          override_intent: null,
        },
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════
// Browser Detection
// ═══════════════════════════════════════════════════════════

describe("Browser Detection", () => {
  describe("detectBrowsers", () => {
    it("returns browser detection result", async () => {
      mockInvoke.mockResolvedValueOnce(MOCK_BROWSER_RESULT);
      const result = await detectBrowsers();
      expect(result).toEqual(MOCK_BROWSER_RESULT);
      expect(mockInvoke).toHaveBeenCalledWith("detect_browsers", undefined);
    });
  });
});

// ═══════════════════════════════════════════════════════════
// Vault Stats & Cleanup
// ═══════════════════════════════════════════════════════════

describe("Vault Stats & Cleanup", () => {
  describe("getVaultStats", () => {
    it("returns vault stats", async () => {
      mockInvoke.mockResolvedValueOnce(MOCK_VAULT_STATS);
      const result = await getVaultStats();
      expect(result).toEqual(MOCK_VAULT_STATS);
      expect(mockInvoke).toHaveBeenCalledWith("get_vault_stats", undefined);
    });
  });

  describe("cleanupVault", () => {
    it("returns deleted count", async () => {
      mockInvoke.mockResolvedValueOnce(5);
      const result = await cleanupVault(30);
      expect(result).toBe(5);
      expect(mockInvoke).toHaveBeenCalledWith("cleanup_vault", {
        olderThanDays: 30,
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════
// Scheduler v1
// ═══════════════════════════════════════════════════════════

describe("Scheduler v1", () => {
  describe("listSchedules", () => {
    it("returns schedule list", async () => {
      mockInvoke.mockResolvedValueOnce([MOCK_SCHEDULE]);
      const result = await listSchedules();
      expect(result).toEqual([MOCK_SCHEDULE]);
      expect(mockInvoke).toHaveBeenCalledWith("list_schedules", undefined);
    });
  });

  describe("saveSchedule", () => {
    it("saves schedule", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await saveSchedule(MOCK_SCHEDULE);
      expect(mockInvoke).toHaveBeenCalledWith("save_schedule", {
        schedule: MOCK_SCHEDULE,
      });
    });
  });

  describe("deleteSchedule", () => {
    it("deletes schedule by id", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await deleteSchedule("sched-1");
      expect(mockInvoke).toHaveBeenCalledWith("delete_schedule", {
        scheduleId: "sched-1",
      });
    });
  });

  describe("triggerScheduledWorkflow", () => {
    it("triggers workflow by schedule id", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await triggerScheduledWorkflow("sched-1");
      expect(mockInvoke).toHaveBeenCalledWith("trigger_scheduled_workflow", {
        scheduleId: "sched-1",
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════
// News / Report v1
// ═══════════════════════════════════════════════════════════

describe("News / Report v1", () => {
  describe("listNewsSources", () => {
    it("returns news source list", async () => {
      mockInvoke.mockResolvedValueOnce([MOCK_NEWS_SOURCE]);
      const result = await listNewsSources();
      expect(result).toEqual([MOCK_NEWS_SOURCE]);
      expect(mockInvoke).toHaveBeenCalledWith("list_news_sources", undefined);
    });
  });

  describe("saveNewsSource", () => {
    it("saves news source", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await saveNewsSource(MOCK_NEWS_SOURCE);
      expect(mockInvoke).toHaveBeenCalledWith("save_news_source", {
        source: MOCK_NEWS_SOURCE,
      });
    });
  });

  describe("deleteNewsSource", () => {
    it("deletes news source by id", async () => {
      mockInvoke.mockResolvedValueOnce(undefined);
      await deleteNewsSource("source-1");
      expect(mockInvoke).toHaveBeenCalledWith("delete_news_source", {
        sourceId: "source-1",
      });
    });
  });

  describe("fetchNewsFromSource", () => {
    it("returns news item list", async () => {
      mockInvoke.mockResolvedValueOnce([MOCK_NEWS_ITEM]);
      const result = await fetchNewsFromSource("source-1");
      expect(result).toEqual([MOCK_NEWS_ITEM]);
      expect(mockInvoke).toHaveBeenCalledWith("fetch_news_from_source", {
        sourceId: "source-1",
      });
    });
  });

  describe("generateNewsReport", () => {
    it("generates report with all args", async () => {
      mockInvoke.mockResolvedValueOnce(MOCK_REPORT_DOCUMENT);
      const result = await generateNewsReport({
        title: "Test Report",
        sourceIds: ["source-1"],
        sinceTs: Date.now() - 86400000,
        untilTs: Date.now(),
      });
      expect(result).toEqual(MOCK_REPORT_DOCUMENT);
      expect(mockInvoke).toHaveBeenCalledWith("generate_news_report", {
        args: {
          title: "Test Report",
          source_ids: ["source-1"],
          since_ts: Date.now() - 86400000,
          until_ts: Date.now(),
        },
      });
    });

    it("generates report without optional timestamps", async () => {
      mockInvoke.mockResolvedValueOnce(MOCK_REPORT_DOCUMENT);
      await generateNewsReport({
        title: "Test Report",
        sourceIds: ["source-1"],
      });
      expect(mockInvoke).toHaveBeenCalledWith("generate_news_report", {
        args: {
          title: "Test Report",
          source_ids: ["source-1"],
          since_ts: null,
          until_ts: null,
        },
      });
    });
  });
});

// ═══════════════════════════════════════════════════════════
// Notification
// ═══════════════════════════════════════════════════════════

describe("Notification", () => {
  describe("notify", () => {
    it("sends notification via Tauri notification plugin", async () => {
      const { sendNotification } = await import("@tauri-apps/plugin-notification");
      const mockSend = vi.mocked(sendNotification);
      mockSend.mockResolvedValueOnce(undefined);
      await notify("Test Title", "Test Body");
      expect(mockSend).toHaveBeenCalledWith({
        title: "Test Title",
        body: "Test Body",
      });
    });

    it("handles notification failure gracefully", async () => {
      const { sendNotification } = await import("@tauri-apps/plugin-notification");
      const mockSend = vi.mocked(sendNotification);
      mockSend.mockRejectedValueOnce(new Error("Notification failed"));
      await expect(notify("Test", "Body")).resolves.not.toThrow();
    });
  });
});

// ═══════════════════════════════════════════════════════════
// Error Normalization
// ═══════════════════════════════════════════════════════════

describe("Error Normalization", () => {
  it("normalizes well-formed ApiError from Tauri", async () => {
    mockInvoke.mockRejectedValueOnce({
      code: "TEST_CODE",
      message: "Test message",
      trace_id: "trace-123",
      details: "Extra details",
    });
    await expect(clipboardGetText()).rejects.toMatchObject({
      code: "TEST_CODE",
      message: "Test message",
      details: "Extra details",
      trace_id: "trace-123",
    });
  });

  it("wraps unknown errors with UNKNOWN_ERROR", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("Something went wrong"));
    await expect(clipboardGetText()).rejects.toMatchObject({
      code: "UNKNOWN_ERROR",
      message: "Unexpected command error",
    });
  });

  it("handles non-object errors", async () => {
    mockInvoke.mockRejectedValueOnce("string error");
    await expect(clipboardGetText()).rejects.toMatchObject({
      code: "UNKNOWN_ERROR",
      details: "string error",
    });
  });

  it("converts numeric codes to strings", async () => {
    mockInvoke.mockRejectedValueOnce({
      code: 123,
      message: "Error",
      trace_id: "t1",
    });
    await expect(clipboardGetText()).rejects.toMatchObject({
      code: "123",
    });
  });
});
