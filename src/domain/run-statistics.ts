// ═══════════════════════════════════════════════════════════
// run-statistics.ts — Run 统计分析
// Provides aggregated stats for runs, trends, and error analysis
// ═══════════════════════════════════════════════════════════

import type { RunRecord } from "../types";

export interface RunStats {
  total: number;
  completed: number;
  errors: number;
  successRate: number;
  avgDurationMs: number;
  /** 按 skill 分组计数 */
  bySkill: Record<string, number>;
  /** 按状态分组计数 */
  byStatus: Record<string, number>;
  /** 最常见错误码 */
  topErrors: Array<{ code: string; count: number }>;
  /** 最近 24h 运行次数 */
  last24hCount: number;
  /** 最近 7 天趋势 (index 0 = 最旧) */
  weeklyTrend: number[];
  /** 平均输出长度 */
  avgOutputLength: number;
}

export function computeRunStats(runs: RunRecord[]): RunStats {
  const now = Date.now();
  const DAY_MS = 86_400_000;

  const bySkill: Record<string, number> = {};
  const byStatus: Record<string, number> = {};
  const errorCounts: Record<string, number> = {};
  const weeklyBuckets = new Array<number>(7).fill(0);

  let totalDuration = 0;
  let durationCount = 0;
  let totalOutputLen = 0;
  let outputCount = 0;
  let last24hCount = 0;

  for (const run of runs) {
    // status count
    byStatus[run.status] = (byStatus[run.status] ?? 0) + 1;
    // skill count
    bySkill[run.skill_id] = (bySkill[run.skill_id] ?? 0) + 1;
    // error count
    if (run.error_code) {
      errorCounts[run.error_code] = (errorCounts[run.error_code] ?? 0) + 1;
    }
    // duration
    if (run.ts_end && run.ts_start) {
      totalDuration += run.ts_end - run.ts_start;
      durationCount++;
    }
    // output length
    if (run.output) {
      totalOutputLen += run.output.length;
      outputCount++;
    }
    // last 24h
    if (now - run.ts_start < DAY_MS) {
      last24hCount++;
    }
    // weekly trend (last 7 days)
    const daysAgo = Math.floor((now - run.ts_start) / DAY_MS);
    if (daysAgo >= 0 && daysAgo < 7) {
      weeklyBuckets[6 - daysAgo]++;
    }
  }

  const completed = byStatus["completed"] ?? 0;
  // §P2-1 Use Object.entries for safe key-value pairing
  const errors = Object.entries(byStatus).reduce((sum, [k, v]) => {
    return k === "error" || k === "failed" ? sum + v : sum;
  }, 0);

  const topErrors = Object.entries(errorCounts)
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return {
    total: runs.length,
    completed,
    errors,
    successRate: runs.length > 0 ? completed / runs.length : 0,
    avgDurationMs: durationCount > 0 ? Math.round(totalDuration / durationCount) : 0,
    bySkill,
    byStatus,
    topErrors,
    last24hCount,
    weeklyTrend: weeklyBuckets,
    avgOutputLength: outputCount > 0 ? Math.round(totalOutputLen / outputCount) : 0,
  };
}

/** 格式化持续时间 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.floor(ms / 60_000)}m ${Math.round((ms % 60_000) / 1000)}s`;
}
