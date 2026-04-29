// ═══════════════════════════════════════════════════════════
// §5 Route Feedback Learning — 路由反馈学习与权重调整
// 记录用户接受/拒绝/改选 → 周期性重算规则权重
// ═══════════════════════════════════════════════════════════

import type { RouterRulesConfig } from "../types";
import { getRouteFeedbacks, loadRouterRules, saveRouterRules } from "../api";

// ═══ 反馈记录 ═══

export interface RouteFeedbackRecord {
  traceId: string;
  decisionIntent: string;
  /** "accepted" | "rejected" | "overridden" */
  userAction: string;
  overrideIntent?: string;
  timestamp: number;
}

export interface IntentStats {
  intent: string;
  accepted: number;
  rejected: number;
  overridden: number;
  total: number;
  acceptRate: number;
  /** 被改选为该 intent 的次数 */
  overriddenTo: number;
}

export interface RuleWeightAdjustment {
  intent: string;
  oldBoost: number;
  newBoost: number;
  reason: string;
}

// ═══ 反馈收集与统计 ═══

/**
 * §5 统计各 intent 的接受/拒绝/改选数据
 */
export function computeIntentStats(feedbacks: RouteFeedbackRecord[]): IntentStats[] {
  const map = new Map<string, { accepted: number; rejected: number; overridden: number; overriddenTo: number }>();

  for (const f of feedbacks) {
    let s = map.get(f.decisionIntent);
    if (!s) {
      s = { accepted: 0, rejected: 0, overridden: 0, overriddenTo: 0 };
      map.set(f.decisionIntent, s);
    }

    if (f.userAction === "accepted") s.accepted++;
    else if (f.userAction === "rejected") s.rejected++;
    else if (f.userAction === "overridden") {
      s.overridden++;
      if (f.overrideIntent) {
        let target = map.get(f.overrideIntent);
        if (!target) {
          target = { accepted: 0, rejected: 0, overridden: 0, overriddenTo: 0 };
          map.set(f.overrideIntent, target);
        }
        target.overriddenTo++;
      }
    }
  }

  const stats: IntentStats[] = [];
  for (const [intent, s] of map) {
    const total = s.accepted + s.rejected + s.overridden;
    stats.push({
      intent,
      ...s,
      total,
      acceptRate: total > 0 ? s.accepted / total : 0,
    });
  }

  return stats.sort((a, b) => b.total - a.total);
}

/**
 * §5 计算规则权重调整建议
 * 高误判规则自动降权，高受信规则升权
 */
export function computeWeightAdjustments(
  rules: RouterRulesConfig,
  stats: IntentStats[],
  options: {
    /** 低于此接受率则降权 */
    lowAcceptThreshold?: number;
    /** 高于此接受率则升权 */
    highAcceptThreshold?: number;
    /** 单次最大调整幅度 */
    maxAdjustment?: number;
    /** 至少 N 次反馈才调整 */
    minSamplesForAdjust?: number;
  } = {},
): RuleWeightAdjustment[] {
  const {
    lowAcceptThreshold = 0.5,
    highAcceptThreshold = 0.85,
    maxAdjustment = 0.15,
    minSamplesForAdjust = 5,
  } = options;

  const adjustments: RuleWeightAdjustment[] = [];

  for (const stat of stats) {
    const rule = rules.intents[stat.intent];
    if (!rule) continue;
    if (stat.total < minSamplesForAdjust) continue;

    const oldBoost = rule.confidence_boost || 0;
    let delta = 0;
    let reason = "";

    if (stat.acceptRate < lowAcceptThreshold) {
      // 低接受率: 降权
      delta = -Math.min(maxAdjustment, (lowAcceptThreshold - stat.acceptRate) * maxAdjustment * 2);
      reason = `接受率 ${(stat.acceptRate * 100).toFixed(0)}% 低于阈值 ${lowAcceptThreshold * 100}%，降权`;
    } else if (stat.acceptRate > highAcceptThreshold) {
      // 高接受率: 升权
      delta = Math.min(maxAdjustment, (stat.acceptRate - highAcceptThreshold) * maxAdjustment * 2);
      reason = `接受率 ${(stat.acceptRate * 100).toFixed(0)}% 高于阈值 ${highAcceptThreshold * 100}%，升权`;
    }

    // 被用户频繁改选到此 intent → 给它额外升权
    if (stat.overriddenTo > 0 && stat.overriddenTo >= minSamplesForAdjust) {
      delta += Math.min(maxAdjustment / 2, stat.overriddenTo * 0.01);
      reason += `，被用户主动改选 ${stat.overriddenTo} 次`;
    }

    if (Math.abs(delta) > 0.001) {
      adjustments.push({
        intent: stat.intent,
        oldBoost,
        newBoost: Math.max(-1, Math.min(1, oldBoost + delta)),
        reason,
      });
    }
  }

  return adjustments;
}

/**
 * §5 应用权重调整到规则配置 (不可变更新)
 */
export function applyWeightAdjustments(
  rules: RouterRulesConfig,
  adjustments: RuleWeightAdjustment[],
): RouterRulesConfig {
  const newIntents = { ...rules.intents };
  for (const adj of adjustments) {
    if (newIntents[adj.intent]) {
      newIntents[adj.intent] = {
        ...newIntents[adj.intent],
        confidence_boost: adj.newBoost,
      };
    }
  }
  return { ...rules, intents: newIntents };
}

/**
 * §5 高误判规则检测 (进入审查队列)
 */
export function findHighMisjudgmentRules(
  stats: IntentStats[],
  threshold = 0.4,
  minSamples = 5,
): string[] {
  return stats
    .filter((s) => s.total >= minSamples && s.acceptRate < threshold)
    .map((s) => s.intent);
}

// ═══ 权重计算触发机制 (§5) ═══

export interface TriggerResult {
  triggered: boolean;
  feedbackCount: number;
  threshold: number;
  stats: IntentStats[];
  adjustments: RuleWeightAdjustment[];
  highMisjudgmentIntents: string[];
}

export interface TriggerOptions {
  /** 触发权重计算的反馈数量阈值，默认 10 */
  threshold?: number;
  /** 传递给 computeWeightAdjustments 的选项 */
  adjustOptions?: {
    lowAcceptThreshold?: number;
    highAcceptThreshold?: number;
    maxAdjustment?: number;
    minSamplesForAdjust?: number;
  };
}

/**
 * §5 触发权重重新计算
 *
 * 当反馈数据累积到指定阈值时:
 * 1. 获取所有反馈记录
 * 2. 计算各 intent 的接受/拒绝/改选统计
 * 3. 计算权重调整建议
 * 4. 返回调整结果（不自动应用）
 *
 * @param options.triggerThreshold 反馈数量阈值，默认 10
 * @param options.adjustOptions 传递给 computeWeightAdjustments 的选项
 * @returns 触发结果，包含是否触发、统计数据和调整建议
 */
export async function triggerWeightRecalculation(
  options: TriggerOptions = {},
): Promise<TriggerResult> {
  const {
    threshold = 10,
    adjustOptions = {},
  } = options;

  // 获取反馈数据
  const feedbacks = await getRouteFeedbacks();
  const feedbackCount = feedbacks.length;

  // 检查是否达到触发阈值
  if (feedbackCount < threshold) {
    return {
      triggered: false,
      feedbackCount,
      threshold,
      stats: [],
      adjustments: [],
      highMisjudgmentIntents: [],
    };
  }

  // 计算统计数据
  const stats = computeIntentStats(feedbacks);

  // 获取当前路由规则
  const rules = await loadRouterRules();

  // 计算权重调整建议
  const adjustments = computeWeightAdjustments(rules, stats, adjustOptions);

  // 检测高误判规则
  const highMisjudgmentIntents = findHighMisjudgmentRules(stats);

  return {
    triggered: true,
    feedbackCount,
    threshold,
    stats,
    adjustments,
    highMisjudgmentIntents,
  };
}

// ═══ 权重调整应用与调度 (§5) ═══

export interface ApplyResult {
  success: boolean;
  appliedCount: number;
  adjustments: RuleWeightAdjustment[];
  newRules?: RouterRulesConfig;
}

/**
 * §5 将权重调整应用到调度器
 *
 * 1. 调用 applyWeightAdjustments 应用权重变更
 * 2. 保存更新后的规则配置
 *
 * 注意：权重渐变已由 computeWeightAdjustments 保证（每次不超过 maxAdjustment）
 *
 * @param adjustments 权重调整建议
 * @returns 应用结果
 */
export async function applyWeightAdjustmentsToScheduler(
  adjustments: RuleWeightAdjustment[],
): Promise<ApplyResult> {
  if (adjustments.length === 0) {
    return {
      success: true,
      appliedCount: 0,
      adjustments: [],
    };
  }

  try {
    // 获取当前规则
    const currentRules = await loadRouterRules();

    // 应用权重调整
    const newRules = applyWeightAdjustments(currentRules, adjustments);

    // 保存更新后的规则
    await saveRouterRules(newRules);

    return {
      success: true,
      appliedCount: adjustments.length,
      adjustments,
      newRules,
    };
  } catch (error) {
    return {
      success: false,
      appliedCount: 0,
      adjustments,
    };
  }
}

// localStorage keys for scheduling state
const LAST_WEIGHT_RECALC_KEY = "feedback_last_weight_recalc";
const WEIGHT_RECALC_INTERVAL_KEY = "feedback_weight_recalc_interval_days";

export interface ScheduleOptions {
  /** 执行间隔天数，默认 1 天 */
  intervalDays?: number;
  /** 是否在启动时立即执行一次 */
  runOnStartup?: boolean;
  /** 权重重新计算的阈值，默认 10 */
  threshold?: number;
}

/**
 * §5 设置定期权重重新计算调度
 *
 * 使用 setInterval 定期检查并触发权重重新计算。
 * 使用 localStorage 记录上次执行时间，避免重复执行。
 *
 * @param options.intervalDays 执行间隔天数，默认 1
 * @param options.runOnStartup 是否在启动时立即执行，默认 false
 * @returns 调度取消函数，调用后停止调度
 */
export function scheduleWeightRecalculation(
  options: ScheduleOptions = {},
): () => void {
  const {
    intervalDays = 1,
    runOnStartup = false,
  } = options;

  const intervalMs = intervalDays * 24 * 60 * 60 * 1000;

  // 保存间隔配置
  localStorage.setItem(WEIGHT_RECALC_INTERVAL_KEY, String(intervalDays));

  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  let isCancelled = false;
  let isRunning = false;  // §E1 互斥标志，防止并发执行

  const runRecalculation = async () => {
    if (isCancelled || isRunning) return;  // §E1 互斥保护
    isRunning = true;

    try {
      // 检查是否应该执行
      const lastRun = localStorage.getItem(LAST_WEIGHT_RECALC_KEY);
      const now = Date.now();

      if (lastRun) {
        const elapsed = now - parseInt(lastRun, 10);
        if (elapsed < intervalMs) {
          // 未到执行时间，调度下次检查
          scheduleNext(intervalMs - elapsed);
          isRunning = false;
          return;
        }
      }

      // 触发权重重新计算 - §E1 使用 options.threshold
      const result = await triggerWeightRecalculation({
        threshold: options.threshold ?? 10,
        adjustOptions: {
          minSamplesForAdjust: 5,
          maxAdjustment: 0.15,
        },
      });

      if (result.triggered && result.adjustments.length > 0) {
        // 应用权重调整
        await applyWeightAdjustmentsToScheduler(result.adjustments);
      }

      // 记录本次执行时间
      localStorage.setItem(LAST_WEIGHT_RECALC_KEY, String(now));
    } catch (error) {
      console.warn("[scheduleWeightRecalculation] 执行失败:", error);
    }

    isRunning = false;

    if (!isCancelled) {
      // 调度下次执行
      scheduleNext(intervalMs);
    }
  };

  const scheduleNext = (delay: number) => {
    if (isCancelled) return;
    // §E1 清理现有timeout，防止资源泄漏
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(runRecalculation, delay);
  };

  // §G3.4 修复: runOnStartup=false时只调度不立即执行
  if (runOnStartup) {
    runRecalculation();
  } else {
    // 无论是否从未执行，都只调度不立即执行
    scheduleNext(intervalMs);
  }

  // 返回取消函数
  return () => {
    isCancelled = true;
    if (timeoutId !== null) {
      clearTimeout(timeoutId);
    }
  };
}
