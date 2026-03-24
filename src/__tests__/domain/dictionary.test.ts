// ═══════════════════════════════════════════════════════════
// dictionary.ts 单元测试 — 状态文案字典完整性
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import {
  PAGE_STATE_LABELS,
  RUN_STATUS,
  TARGET_STATUS,
  STEP_STATUS,
  DISPATCH_STAGES,
  getDispatchStageIndex,
  AUTOMATION_LEVELS,
  BROWSER_LABELS,
} from "../../domain/dictionary";

describe("PAGE_STATE_LABELS", () => {
  it("覆盖所有页面状态", () => {
    const requiredStates = ["idle", "loading", "ready", "editing", "saving", "validating", "dispatching", "waiting_capture", "archived", "error"];
    for (const state of requiredStates) {
      expect(PAGE_STATE_LABELS[state]).toBeDefined();
      expect(PAGE_STATE_LABELS[state].length).toBeGreaterThan(0);
    }
  });
});

describe("RUN_STATUS", () => {
  it("覆盖所有 run 状态", () => {
    const requiredStatuses = ["created", "dispatched", "waiting_output", "waiting_capture", "captured", "done", "failed", "compensating", "closed", "cancelled"];
    for (const status of requiredStatuses) {
      expect(RUN_STATUS[status]).toBeDefined();
      expect(RUN_STATUS[status].label).toBeTruthy();
      expect(RUN_STATUS[status].color).toBeTruthy();
      expect(RUN_STATUS[status].dot).toBeTruthy();
    }
  });
});

describe("TARGET_STATUS", () => {
  it("覆盖所有 target 状态", () => {
    const requiredStatuses = ["ready", "missing", "ambiguous", "needs_rebind", "inactive"];
    for (const status of requiredStatuses) {
      expect(TARGET_STATUS[status]).toBeDefined();
    }
  });
});

describe("STEP_STATUS", () => {
  it("覆盖所有步骤状态", () => {
    const requiredStatuses = ["pending", "dispatched", "awaiting_send", "waiting_output", "captured", "failed"];
    for (const status of requiredStatuses) {
      expect(STEP_STATUS[status]).toBeDefined();
    }
  });
});

describe("DISPATCH_STAGES", () => {
  it("包含完整调度阶段", () => {
    expect(DISPATCH_STAGES.length).toBe(6);
    expect(DISPATCH_STAGES[0].key).toBe("preflight");
    expect(DISPATCH_STAGES[5].key).toBe("archive");
  });
});

describe("getDispatchStageIndex", () => {
  it("validating → 0 (preflight)", () => {
    expect(getDispatchStageIndex("validating")).toBe(0);
  });

  it("dispatching → 2 (stage)", () => {
    expect(getDispatchStageIndex("dispatching")).toBe(2);
  });

  it("waiting_capture → 4 (capture)", () => {
    expect(getDispatchStageIndex("waiting_capture")).toBe(4);
  });

  it("archived → 5 (archive)", () => {
    expect(getDispatchStageIndex("archived")).toBe(5);
  });

  it("idle → -1 (未开始)", () => {
    expect(getDispatchStageIndex("idle")).toBe(-1);
  });
});

describe("AUTOMATION_LEVELS", () => {
  it("包含 auto/assist/confirm", () => {
    expect(AUTOMATION_LEVELS.auto).toBeDefined();
    expect(AUTOMATION_LEVELS.assist).toBeDefined();
    expect(AUTOMATION_LEVELS.confirm).toBeDefined();
  });
});

describe("BROWSER_LABELS", () => {
  it("覆盖所有浏览器 ID", () => {
    const requiredBrowsers = ["firefox", "chrome", "edge", "brave", "opera", "vivaldi", "arc", "other"];
    for (const browser of requiredBrowsers) {
      expect(BROWSER_LABELS[browser]).toBeDefined();
      expect(BROWSER_LABELS[browser].label).toBeTruthy();
      expect(BROWSER_LABELS[browser].icon).toBeTruthy();
    }
  });
});
