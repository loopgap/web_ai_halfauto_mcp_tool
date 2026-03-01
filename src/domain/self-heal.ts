// ═══════════════════════════════════════════════════════════
// §8 Self-Heal Auto-Trigger Engine — 自动修复引擎
// 识别错误码 → 匹配修复策略 → 执行修复 → 健康复测 → 恢复/升级
// §67 功能补偿矩阵 + §69 熔断
// ═══════════════════════════════════════════════════════════

import type { SelfHealAction, ErrorDefinition } from "../types";

// ═══ Self-Heal State ═══

export interface HealAttempt {
  errorCode: string;
  strategyId: string;
  attempt: number;
  maxAttempts: number;
  status: "pending" | "executing" | "success" | "failed" | "escalated";
  startedAt: number;
  completedAt?: number;
  detail?: string;
}

export interface CircuitBreaker {
  errorCode: string;
  /** 窗口期内的失败计数 */
  failCount: number;
  /** 窗口期开始时间 */
  windowStart: number;
  /** 窗口期 ms */
  windowMs: number;
  /** 失败阈值 */
  threshold: number;
  /** 是否已熔断 */
  open: boolean;
  /** 熔断开始时间 */
  openedAt?: number;
  /** 冷却时间 ms */
  cooldownMs: number;
}

export interface SelfHealEngine {
  /** 注册的修复策略映射: errorCode → SelfHealAction[] */
  registry: Map<string, SelfHealAction[]>;
  /** 修复尝试历史 */
  attempts: HealAttempt[];
  /** 熔断器状态 */
  breakers: Map<string, CircuitBreaker>;
  /** 最大历史记录数 */
  maxHistory: number;
}

// ═══ 初始化 ═══

/**
 * 从后端注册表创建自愈引擎
 */
export function createSelfHealEngine(
  actions: SelfHealAction[],
  errorCatalog: ErrorDefinition[],
): SelfHealEngine {
  const registry = new Map<string, SelfHealAction[]>();

  // 从 error catalog 建立 errorCode → auto_fix_strategy 映射
  for (const errDef of errorCatalog) {
    if (errDef.auto_fix_strategy) {
      const matching = actions.filter((a) => a.strategy_id === errDef.auto_fix_strategy);
      if (matching.length > 0) {
        const existing = registry.get(errDef.code) ?? [];
        registry.set(errDef.code, [...existing, ...matching]);
      }
    }
  }

  // 也按 action_type 做反向映射 (TARGET_ 类错误 → target_* 策略)
  for (const action of actions) {
    const prefix = action.action_type.toUpperCase();
    for (const errDef of errorCatalog) {
      if (errDef.code.startsWith(prefix) && !registry.get(errDef.code)?.includes(action)) {
        const existing = registry.get(errDef.code) ?? [];
        registry.set(errDef.code, [...existing, action]);
      }
    }
  }

  return {
    registry,
    attempts: [],
    breakers: new Map(),
    maxHistory: 500,
  };
}

// ═══ 匹配修复策略 ═══

/**
 * §8 根据错误码查找修复策略
 */
export function findHealStrategies(
  engine: SelfHealEngine,
  errorCode: string,
): SelfHealAction[] {
  return engine.registry.get(errorCode) ?? [];
}

// ═══ 熔断器 ═══

/**
 * §69 检查熔断器是否打开
 */
export function isCircuitOpen(engine: SelfHealEngine, errorCode: string): boolean {
  const breaker = engine.breakers.get(errorCode);
  if (!breaker) return false;

  if (breaker.open) {
    // 检查是否冷却完成
    if (breaker.openedAt && Date.now() - breaker.openedAt > breaker.cooldownMs) {
      // 半开: 允许一次尝试
      return false;
    }
    return true;
  }
  return false;
}

/**
 * §69 记录失败到熔断器
 */
export function recordFailure(
  engine: SelfHealEngine,
  errorCode: string,
  windowMs = 60000,
  threshold = 5,
  cooldownMs = 30000,
): SelfHealEngine {
  const now = Date.now();
  let breaker = engine.breakers.get(errorCode);

  if (!breaker) {
    breaker = {
      errorCode,
      failCount: 0,
      windowStart: now,
      windowMs,
      threshold,
      open: false,
      cooldownMs,
    };
  }

  // 检查是否在窗口内
  if (now - breaker.windowStart > breaker.windowMs) {
    // 新窗口
    breaker = { ...breaker, failCount: 1, windowStart: now };
  } else {
    breaker = { ...breaker, failCount: breaker.failCount + 1 };
  }

  // 检查是否触发熔断
  if (breaker.failCount >= breaker.threshold) {
    breaker = { ...breaker, open: true, openedAt: now };
  }

  const newBreakers = new Map(engine.breakers);
  newBreakers.set(errorCode, breaker);
  return { ...engine, breakers: newBreakers };
}

/**
 * §69 重置熔断器 (修复成功后)
 */
export function resetBreaker(engine: SelfHealEngine, errorCode: string): SelfHealEngine {
  const newBreakers = new Map(engine.breakers);
  newBreakers.delete(errorCode);
  return { ...engine, breakers: newBreakers };
}

// ═══ 执行修复 ═══

/**
 * §8 开始修复尝试
 */
export function startHealAttempt(
  engine: SelfHealEngine,
  errorCode: string,
  strategy: SelfHealAction,
): { engine: SelfHealEngine; attempt: HealAttempt } {
  const attempt: HealAttempt = {
    errorCode,
    strategyId: strategy.strategy_id,
    attempt: engine.attempts.filter((a) => a.errorCode === errorCode && a.strategyId === strategy.strategy_id).length + 1,
    maxAttempts: strategy.max_attempts,
    status: "executing",
    startedAt: Date.now(),
  };

  const attempts = [...engine.attempts, attempt].slice(-engine.maxHistory);
  return { engine: { ...engine, attempts }, attempt };
}

/**
 * §8 完成修复尝试
 */
export function completeHealAttempt(
  engine: SelfHealEngine,
  attempt: HealAttempt,
  success: boolean,
  detail?: string,
): SelfHealEngine {
  const updatedAttempt: HealAttempt = {
    ...attempt,
    status: success ? "success" : (attempt.attempt >= attempt.maxAttempts ? "escalated" : "failed"),
    completedAt: Date.now(),
    detail,
  };

  const attempts = engine.attempts.map((a) =>
    a.errorCode === attempt.errorCode &&
    a.strategyId === attempt.strategyId &&
    a.startedAt === attempt.startedAt
      ? updatedAttempt
      : a,
  );

  let updatedEngine = { ...engine, attempts };

  if (success) {
    updatedEngine = resetBreaker(updatedEngine, attempt.errorCode);
  } else {
    updatedEngine = recordFailure(updatedEngine, attempt.errorCode);
  }

  return updatedEngine;
}

// ═══ §67 补偿矩阵 ═══

export type CompensationPhase =
  | "preflight"
  | "dispatch_stage"
  | "dispatch_confirm"
  | "capture"
  | "archive"
  | "governance"
  | "telemetry";

export interface CompensationRule {
  phase: CompensationPhase;
  actions: string[];
  /** 连续失败终止阈值 */
  maxConsecutiveFailures: number;
}

/**
 * §67 获取阶段补偿规则
 */
export function getCompensationRules(phase: CompensationPhase): CompensationRule {
  const rules: Record<CompensationPhase, CompensationRule> = {
    preflight: {
      phase: "preflight",
      actions: ["重新检测窗口", "切换推荐浏览器", "进入绑定向导"],
      maxConsecutiveFailures: 3,
    },
    dispatch_stage: {
      phase: "dispatch_stage",
      actions: ["退避重试", "重新激活窗口", "重跑 Focus Recipe", "切换候选窗口"],
      maxConsecutiveFailures: 5,
    },
    dispatch_confirm: {
      phase: "dispatch_confirm",
      actions: ["保持 Staged 状态", "允许手动发送", "回填状态"],
      maxConsecutiveFailures: 3,
    },
    capture: {
      phase: "capture",
      actions: ["提示重新复制", "自动识别最近 Run", "手动绑定 Step"],
      maxConsecutiveFailures: 3,
    },
    archive: {
      phase: "archive",
      actions: ["写入临时缓冲队列", "后台重放落盘"],
      maxConsecutiveFailures: 5,
    },
    governance: {
      phase: "governance",
      actions: ["降级为 GoWithRisk", "要求人工审批"],
      maxConsecutiveFailures: 2,
    },
    telemetry: {
      phase: "telemetry",
      actions: ["本地队列缓存", "延迟重传"],
      maxConsecutiveFailures: 10,
    },
  };
  return rules[phase];
}

/**
 * §8 查询修复摘要
 */
export function getHealSummary(engine: SelfHealEngine): {
  totalAttempts: number;
  successRate: number;
  openBreakers: string[];
  recentFailures: HealAttempt[];
} {
  const completed = engine.attempts.filter((a) => a.status !== "executing");
  const successes = completed.filter((a) => a.status === "success");
  const recentFailures = engine.attempts.filter((a) => a.status === "failed" || a.status === "escalated").slice(-10);
  const openBreakers = Array.from(engine.breakers.entries())
    .filter(([, b]) => b.open)
    .map(([code]) => code);

  return {
    totalAttempts: completed.length,
    successRate: completed.length > 0 ? successes.length / completed.length : 0,
    openBreakers,
    recentFailures,
  };
}
