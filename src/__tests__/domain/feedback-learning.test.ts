// ═══════════════════════════════════════════════════════════
// feedback-learning.ts 单元测试 — 路由反馈统计与权重调整
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import {
  computeIntentStats,
  computeWeightAdjustments,
  applyWeightAdjustments,
  findHighMisjudgmentRules,
  type RouteFeedbackRecord,
} from "../../domain/feedback-learning";
import type { RouterRulesConfig } from "../../types";

function makeFeedback(intent: string, action: string, overrideIntent?: string): RouteFeedbackRecord {
  return {
    traceId: `tr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    decisionIntent: intent,
    userAction: action,
    overrideIntent,
    timestamp: Date.now(),
  };
}

const MOCK_RULES: RouterRulesConfig = {
  intents: {
    translate: { keywords: ["翻译"], patterns: [], dispatch_prefer: ["gpt"], fanout: false, confidence_boost: 0.1 },
    summarize: { keywords: ["总结"], patterns: [], dispatch_prefer: ["gpt"], fanout: false, confidence_boost: 0 },
    code: { keywords: ["代码"], patterns: [], dispatch_prefer: ["gpt"], fanout: false, confidence_boost: 0.2 },
  },
};

describe("computeIntentStats", () => {
  it("空反馈返回空统计", () => {
    expect(computeIntentStats([])).toEqual([]);
  });

  it("正确统计 accepted/rejected/overridden", () => {
    const feedbacks = [
      makeFeedback("translate", "accepted"),
      makeFeedback("translate", "accepted"),
      makeFeedback("translate", "rejected"),
      makeFeedback("translate", "overridden", "code"),
    ];
    const stats = computeIntentStats(feedbacks);
    const translateStat = stats.find((s) => s.intent === "translate")!;
    expect(translateStat.accepted).toBe(2);
    expect(translateStat.rejected).toBe(1);
    expect(translateStat.overridden).toBe(1);
    expect(translateStat.total).toBe(4);
    expect(translateStat.acceptRate).toBeCloseTo(0.5);
  });

  it("overriddenTo 正确计数", () => {
    const feedbacks = [
      makeFeedback("translate", "overridden", "code"),
      makeFeedback("summarize", "overridden", "code"),
    ];
    const stats = computeIntentStats(feedbacks);
    const codeStat = stats.find((s) => s.intent === "code")!;
    expect(codeStat.overriddenTo).toBe(2);
  });

  it("按总量降序排列", () => {
    const feedbacks = [
      ...Array(5).fill(null).map(() => makeFeedback("code", "accepted")),
      ...Array(3).fill(null).map(() => makeFeedback("translate", "accepted")),
      makeFeedback("summarize", "accepted"),
    ];
    const stats = computeIntentStats(feedbacks);
    expect(stats[0].intent).toBe("code");
    expect(stats[1].intent).toBe("translate");
    expect(stats[2].intent).toBe("summarize");
  });
});

describe("computeWeightAdjustments", () => {
  it("样本不足时不调整", () => {
    const feedbacks = [
      makeFeedback("translate", "rejected"),
      makeFeedback("translate", "rejected"),
    ];
    const stats = computeIntentStats(feedbacks);
    const adjustments = computeWeightAdjustments(MOCK_RULES, stats, { minSamplesForAdjust: 5 });
    expect(adjustments).toEqual([]);
  });

  it("低接受率降权", () => {
    const feedbacks = [
      ...Array(4).fill(null).map(() => makeFeedback("translate", "rejected")),
      makeFeedback("translate", "accepted"),
    ];
    const stats = computeIntentStats(feedbacks);
    const adjustments = computeWeightAdjustments(MOCK_RULES, stats, { minSamplesForAdjust: 5 });
    const adj = adjustments.find((a) => a.intent === "translate");
    expect(adj).toBeDefined();
    expect(adj!.newBoost).toBeLessThan(adj!.oldBoost);
    expect(adj!.reason).toContain("降权");
  });

  it("高接受率升权", () => {
    const feedbacks = Array(10).fill(null).map(() => makeFeedback("summarize", "accepted"));
    const stats = computeIntentStats(feedbacks);
    const adjustments = computeWeightAdjustments(MOCK_RULES, stats, { minSamplesForAdjust: 5 });
    const adj = adjustments.find((a) => a.intent === "summarize");
    expect(adj).toBeDefined();
    expect(adj!.newBoost).toBeGreaterThan(adj!.oldBoost);
    expect(adj!.reason).toContain("升权");
  });

  it("频繁被改选到的 intent 额外升权", () => {
    const feedbacks = [
      ...Array(5).fill(null).map(() => makeFeedback("translate", "overridden", "code")),
      ...Array(5).fill(null).map(() => makeFeedback("code", "accepted")),
    ];
    const stats = computeIntentStats(feedbacks);
    const adjustments = computeWeightAdjustments(MOCK_RULES, stats, { minSamplesForAdjust: 5 });
    const codeAdj = adjustments.find((a) => a.intent === "code");
    expect(codeAdj).toBeDefined();
    expect(codeAdj!.reason).toContain("改选");
  });
});

describe("applyWeightAdjustments", () => {
  it("正确更新规则权重", () => {
    const adjustments = [
      { intent: "translate", oldBoost: 0.1, newBoost: 0.05, reason: "test" },
    ];
    const updated = applyWeightAdjustments(MOCK_RULES, adjustments);
    expect(updated.intents.translate.confidence_boost).toBe(0.05);
    // 其他 intent 不受影响
    expect(updated.intents.summarize.confidence_boost).toBe(0);
  });

  it("不可变更新", () => {
    const adjustments = [
      { intent: "translate", oldBoost: 0.1, newBoost: 0.2, reason: "test" },
    ];
    const updated = applyWeightAdjustments(MOCK_RULES, adjustments);
    expect(updated).not.toBe(MOCK_RULES);
    expect(MOCK_RULES.intents.translate.confidence_boost).toBe(0.1);
  });
});

describe("findHighMisjudgmentRules", () => {
  it("筛选低接受率规则", () => {
    const feedbacks = [
      ...Array(4).fill(null).map(() => makeFeedback("translate", "rejected")),
      makeFeedback("translate", "accepted"),
      ...Array(10).fill(null).map(() => makeFeedback("code", "accepted")),
    ];
    const stats = computeIntentStats(feedbacks);
    const misjudged = findHighMisjudgmentRules(stats, 0.4, 5);
    expect(misjudged).toContain("translate");
    expect(misjudged).not.toContain("code");
  });

  it("样本不足的不纳入", () => {
    const feedbacks = [
      makeFeedback("translate", "rejected"),
      makeFeedback("translate", "rejected"),
    ];
    const stats = computeIntentStats(feedbacks);
    expect(findHighMisjudgmentRules(stats, 0.4, 5)).toEqual([]);
  });
});
