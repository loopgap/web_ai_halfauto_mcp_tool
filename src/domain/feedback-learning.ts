// ═══════════════════════════════════════════════════════════
// §5 Route Feedback Learning — 路由反馈学习与权重调整
// 记录用户接受/拒绝/改选 → 周期性重算规则权重
// ═══════════════════════════════════════════════════════════

import type { RouterRulesConfig } from "../types";

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
