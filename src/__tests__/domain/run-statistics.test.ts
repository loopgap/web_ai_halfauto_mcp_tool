// ═══════════════════════════════════════════════════════════
// run-statistics.ts 单元测试
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { computeRunStats, formatDuration } from "../../domain/run-statistics";
import type { RunRecord } from "../../types";

const NOW = Date.now();
const DAY = 86_400_000;

function makeRun(overrides: Partial<RunRecord> = {}): RunRecord {
  return {
    id: `r-${Math.random().toString(36).slice(2, 8)}`,
    ts_start: NOW - 1000,
    skill_id: "default-skill",
    target_id: "t1",
    provider: "test",
    prompt: "Hello",
    status: "completed",
    trace_id: "tr-1",
    ...overrides,
  };
}

describe("computeRunStats", () => {
  it("空列表返回零值", () => {
    const stats = computeRunStats([]);
    expect(stats.total).toBe(0);
    expect(stats.successRate).toBe(0);
    expect(stats.avgDurationMs).toBe(0);
    expect(stats.weeklyTrend).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });

  it("正确计算成功率", () => {
    const runs = [
      makeRun({ status: "completed" }),
      makeRun({ status: "completed" }),
      makeRun({ status: "error", error_code: "E001" }),
    ];
    const stats = computeRunStats(runs);
    expect(stats.total).toBe(3);
    expect(stats.completed).toBe(2);
    expect(stats.errors).toBe(1);
    expect(stats.successRate).toBeCloseTo(2 / 3, 5);
  });

  it("正确计算平均耗时", () => {
    const runs = [
      makeRun({ ts_start: NOW - 3000, ts_end: NOW - 1000 }), // 2000ms
      makeRun({ ts_start: NOW - 5000, ts_end: NOW - 1000 }), // 4000ms
    ];
    const stats = computeRunStats(runs);
    expect(stats.avgDurationMs).toBe(3000);
  });

  it("bySkill 分组计数", () => {
    const runs = [
      makeRun({ skill_id: "translate" }),
      makeRun({ skill_id: "translate" }),
      makeRun({ skill_id: "summarize" }),
    ];
    const stats = computeRunStats(runs);
    expect(stats.bySkill["translate"]).toBe(2);
    expect(stats.bySkill["summarize"]).toBe(1);
  });

  it("topErrors 按频次排序且最多5个", () => {
    const runs = [
      makeRun({ status: "error", error_code: "E001" }),
      makeRun({ status: "error", error_code: "E001" }),
      makeRun({ status: "error", error_code: "E002" }),
    ];
    const stats = computeRunStats(runs);
    expect(stats.topErrors[0]).toEqual({ code: "E001", count: 2 });
    expect(stats.topErrors[1]).toEqual({ code: "E002", count: 1 });
  });

  it("last24hCount 仅计最近 24h", () => {
    const runs = [
      makeRun({ ts_start: NOW - 1000 }),     // within 24h
      makeRun({ ts_start: NOW - DAY + 10000 }), // within 24h (10s margin)
      makeRun({ ts_start: NOW - DAY * 2 }),   // outside
    ];
    const stats = computeRunStats(runs);
    expect(stats.last24hCount).toBe(2);
  });

  it("weeklyTrend 分桶正确", () => {
    const runs = [
      makeRun({ ts_start: NOW - 100 }),               // today (index 6)
      makeRun({ ts_start: NOW - DAY * 1 - 100 }),     // 1 day ago (index 5)
      makeRun({ ts_start: NOW - DAY * 6 - 100 }),     // 6 days ago (index 0)
    ];
    const stats = computeRunStats(runs);
    expect(stats.weeklyTrend[6]).toBe(1); // today
    expect(stats.weeklyTrend[5]).toBe(1); // yesterday
    expect(stats.weeklyTrend[0]).toBe(1); // 6 days ago
  });
});

describe("formatDuration", () => {
  it("毫秒级", () => {
    expect(formatDuration(500)).toBe("500ms");
  });

  it("秒级", () => {
    expect(formatDuration(2500)).toBe("2.5s");
  });

  it("分钟级", () => {
    expect(formatDuration(125000)).toBe("2m 5s");
  });
});
