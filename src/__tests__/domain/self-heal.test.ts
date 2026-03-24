// ═══════════════════════════════════════════════════════════
// self-heal.ts 单元测试 — 熔断器、修复策略、补偿矩阵
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import {
  createSelfHealEngine,
  findHealStrategies,
  isCircuitOpen,
  recordFailure,
  resetBreaker,
  startHealAttempt,
  completeHealAttempt,
  getCompensationRules,
  getHealSummary,
} from "../../domain/self-heal";
import type { SelfHealAction, ErrorDefinition } from "../../types";

const MOCK_ACTIONS: SelfHealAction[] = [
  { strategy_id: "retry_clipboard", description: "重试剪贴板", action_type: "CLIPBOARD", max_attempts: 3, cooldown_ms: 1000 },
  { strategy_id: "rebind_target", description: "重绑目标", action_type: "TARGET", max_attempts: 2, cooldown_ms: 5000 },
];

const MOCK_CATALOG: ErrorDefinition[] = [
  { code: "CLIPBOARD_BUSY", category: "OS", user_message: "剪贴板忙", fix_suggestion: "关闭其他应用", alert_level: "warn", auto_fix_strategy: "retry_clipboard" },
  { code: "TARGET_NOT_FOUND", category: "TARGET", user_message: "目标未找到", fix_suggestion: "检查窗口", alert_level: "error", auto_fix_strategy: "rebind_target" },
];

describe("createSelfHealEngine", () => {
  it("正确建立 errorCode → strategy 映射", () => {
    const engine = createSelfHealEngine(MOCK_ACTIONS, MOCK_CATALOG);
    expect(engine.registry.get("CLIPBOARD_BUSY")).toHaveLength(1);
    expect(engine.registry.get("CLIPBOARD_BUSY")![0].strategy_id).toBe("retry_clipboard");
  });

  it("初始状态干净", () => {
    const engine = createSelfHealEngine(MOCK_ACTIONS, MOCK_CATALOG);
    expect(engine.attempts).toEqual([]);
    expect(engine.breakers.size).toBe(0);
    expect(engine.maxHistory).toBe(500);
  });
});

describe("findHealStrategies", () => {
  it("已知错误码返回策略", () => {
    const engine = createSelfHealEngine(MOCK_ACTIONS, MOCK_CATALOG);
    const strategies = findHealStrategies(engine, "CLIPBOARD_BUSY");
    expect(strategies.length).toBeGreaterThan(0);
  });

  it("未知错误码返回空数组", () => {
    const engine = createSelfHealEngine(MOCK_ACTIONS, MOCK_CATALOG);
    expect(findHealStrategies(engine, "UNKNOWN")).toEqual([]);
  });
});

describe("熔断器", () => {
  it("初始状态熔断器未打开", () => {
    const engine = createSelfHealEngine(MOCK_ACTIONS, MOCK_CATALOG);
    expect(isCircuitOpen(engine, "CLIPBOARD_BUSY")).toBe(false);
  });

  it("累计失败触发熔断", () => {
    let engine = createSelfHealEngine(MOCK_ACTIONS, MOCK_CATALOG);
    for (let i = 0; i < 5; i++) {
      engine = recordFailure(engine, "CLIPBOARD_BUSY", 60000, 5, 30000);
    }
    expect(isCircuitOpen(engine, "CLIPBOARD_BUSY")).toBe(true);
  });

  it("重置熔断器", () => {
    let engine = createSelfHealEngine(MOCK_ACTIONS, MOCK_CATALOG);
    for (let i = 0; i < 5; i++) {
      engine = recordFailure(engine, "CLIPBOARD_BUSY", 60000, 5, 30000);
    }
    expect(isCircuitOpen(engine, "CLIPBOARD_BUSY")).toBe(true);
    engine = resetBreaker(engine, "CLIPBOARD_BUSY");
    expect(isCircuitOpen(engine, "CLIPBOARD_BUSY")).toBe(false);
  });
});

describe("修复尝试", () => {
  it("startHealAttempt 创建执行中的尝试", () => {
    const engine = createSelfHealEngine(MOCK_ACTIONS, MOCK_CATALOG);
    const result = startHealAttempt(engine, "CLIPBOARD_BUSY", MOCK_ACTIONS[0]);
    expect(result.attempt.status).toBe("executing");
    expect(result.attempt.attempt).toBe(1);
    expect(result.engine.attempts).toHaveLength(1);
  });

  it("completeHealAttempt 成功重置熔断器", () => {
    let engine = createSelfHealEngine(MOCK_ACTIONS, MOCK_CATALOG);
    // 先触发熔断
    for (let i = 0; i < 5; i++) {
      engine = recordFailure(engine, "CLIPBOARD_BUSY", 60000, 5, 30000);
    }
    const { engine: e2, attempt } = startHealAttempt(engine, "CLIPBOARD_BUSY", MOCK_ACTIONS[0]);
    const e3 = completeHealAttempt(e2, attempt, true, "修复成功");
    expect(isCircuitOpen(e3, "CLIPBOARD_BUSY")).toBe(false);
  });

  it("completeHealAttempt 失败记录到熔断器", () => {
    const engine = createSelfHealEngine(MOCK_ACTIONS, MOCK_CATALOG);
    const { engine: e2, attempt } = startHealAttempt(engine, "CLIPBOARD_BUSY", MOCK_ACTIONS[0]);
    const e3 = completeHealAttempt(e2, attempt, false, "仍然失败");
    expect(e3.breakers.has("CLIPBOARD_BUSY")).toBe(true);
  });

  it("超过 maxAttempts 后状态为 escalated", () => {
    const engine = createSelfHealEngine(MOCK_ACTIONS, MOCK_CATALOG);
    const action = { ...MOCK_ACTIONS[0], max_attempts: 1 };
    const { engine: e2, attempt } = startHealAttempt(engine, "CLIPBOARD_BUSY", action);
    const a = { ...attempt, attempt: 1 };
    const e3 = completeHealAttempt(e2, a, false);
    const failedAttempt = e3.attempts.find((a) => a.strategyId === "retry_clipboard" && a.status !== "executing");
    expect(failedAttempt?.status).toBe("escalated");
  });
});

describe("补偿矩阵", () => {
  it("每个阶段都有补偿规则", () => {
    const phases = ["preflight", "dispatch_stage", "dispatch_confirm", "capture", "archive", "governance", "telemetry"] as const;
    for (const phase of phases) {
      const rule = getCompensationRules(phase);
      expect(rule.phase).toBe(phase);
      expect(rule.actions.length).toBeGreaterThan(0);
      expect(rule.maxConsecutiveFailures).toBeGreaterThan(0);
    }
  });
});

describe("getHealSummary", () => {
  it("空引擎返回零值摘要", () => {
    const engine = createSelfHealEngine(MOCK_ACTIONS, MOCK_CATALOG);
    const summary = getHealSummary(engine);
    expect(summary.totalAttempts).toBe(0);
    expect(summary.successRate).toBe(0);
    expect(summary.openBreakers).toEqual([]);
    expect(summary.recentFailures).toEqual([]);
  });

  it("有数据时正确汇总", () => {
    let engine = createSelfHealEngine(MOCK_ACTIONS, MOCK_CATALOG);
    const { engine: e2, attempt } = startHealAttempt(engine, "CLIPBOARD_BUSY", MOCK_ACTIONS[0]);
    engine = completeHealAttempt(e2, attempt, true);
    const summary = getHealSummary(engine);
    expect(summary.totalAttempts).toBe(1);
    expect(summary.successRate).toBe(1);
  });
});
