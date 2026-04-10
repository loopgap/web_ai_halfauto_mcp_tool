// ═══════════════════════════════════════════════════════════
// §7 Workflow DAG Execution Engine — DAG 拓扑排序 + 并行调度
// §39 三条执行主流程: 手动推进 / 半自动 / 自动触发
// §68 幂等与重放 + §69 超时重试熔断
// ═══════════════════════════════════════════════════════════

import type {
  Workflow,
  WorkflowStep,
  StepStatus,
} from "../types";

// ───────── §2.2 AOP Telemetry ─────────

export interface WorkflowTelemetryEvent {
  workflowId: string;
  runId: string;
  stepId?: string;
  type: "workflow_start" | "workflow_end" | "step_start" | "step_end" | "step_retry" | "step_fail";
  timestamp: number;
  durationMs?: number;
  status?: string;
  error?: string;
}

export type WorkflowTelemetryHook = (event: WorkflowTelemetryEvent) => void;

let workflowTelemetryHook: WorkflowTelemetryHook | null = null;

/**
 * §2.2 AOP: 注册全局遥测 Hook
 */
export function setWorkflowTelemetryHook(hook: WorkflowTelemetryHook | null) {
  workflowTelemetryHook = hook;
}

function emitWorkflowTelemetry(event: WorkflowTelemetryEvent) {
  if (workflowTelemetryHook) {
    workflowTelemetryHook(event);
  }
}

// ═══ DAG 分析工具 ═══

export interface DagNode {
  stepId: string;
  step: WorkflowStep;
  /** 入边: 这些 step 完成后此节点才可开始 */
  dependencies: string[];
  /** 出边: 此 step 完成后可推进的后继 */
  successors: string[];
  /** 拓扑层级 (0=根节点) */
  level: number;
}

export interface DagAnalysis {
  nodes: Map<string, DagNode>;
  /** 拓扑排序序列 */
  topoOrder: string[];
  /** 是否有环 */
  hasCycle: boolean;
  /** 每层可并行的节点列表 */
  layers: string[][];
  /** 不可达节点 */
  unreachable: string[];
  /** 最大深度 */
  maxDepth: number;
}

/**
 * §7 对 workflow steps 做 DAG 分析
 * 返回拓扑排序、环检测、层级划分
 */
export function analyzeDag(workflow: Workflow): DagAnalysis {
  const nodes = new Map<string, DagNode>();
  const steps = workflow.steps;

  // build nodes
  for (const step of steps) {
    const sid = step.id ?? step.use;
    nodes.set(sid, {
      stepId: sid,
      step,
      dependencies: [...step.depends_on],
      successors: [],
      level: 0,
    });
  }

  // build successor edges
  for (const node of nodes.values()) {
    for (const dep of node.dependencies) {
      const parent = nodes.get(dep);
      if (parent) {
        parent.successors.push(node.stepId);
      }
    }
  }

  // Kahn's algorithm for topological sort + cycle detection
  const inDegree = new Map<string, number>();
  for (const [id, node] of nodes) {
    inDegree.set(id, node.dependencies.filter((d) => nodes.has(d)).length);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const topoOrder: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    topoOrder.push(current);
    const node = nodes.get(current)!;
    for (const succ of node.successors) {
      const newDeg = (inDegree.get(succ) ?? 1) - 1;
      inDegree.set(succ, newDeg);
      if (newDeg === 0) queue.push(succ);
    }
  }

  const hasCycle = topoOrder.length !== nodes.size;
  const unreachable: string[] = [];
  for (const id of nodes.keys()) {
    if (!topoOrder.includes(id)) unreachable.push(id);
  }

  // Compute levels (longest path from root)
  const levels = new Map<string, number>();
  for (const id of topoOrder) {
    const node = nodes.get(id)!;
    let maxParentLevel = -1;
    for (const dep of node.dependencies) {
      maxParentLevel = Math.max(maxParentLevel, levels.get(dep) ?? -1);
    }
    const level = maxParentLevel + 1;
    levels.set(id, level);
    node.level = level;
  }

  // Build layer groups
  const layerMap = new Map<number, string[]>();
  for (const [id, level] of levels) {
    const arr = layerMap.get(level) ?? [];
    arr.push(id);
    layerMap.set(level, arr);
  }
  const maxDepth = Math.max(...Array.from(layerMap.keys()), 0);
  const layers: string[][] = [];
  for (let i = 0; i <= maxDepth; i++) {
    layers.push(layerMap.get(i) ?? []);
  }

  return { nodes, topoOrder, hasCycle, layers, unreachable, maxDepth };
}

// ═══ Workflow Execution State ═══

export type FlowMode = "manual" | "semi_auto" | "auto";

export interface WorkflowExecution {
  workflowId: string;
  runId: string;
  mode: FlowMode;
  steps: Map<string, StepExecutionState>;
  status: "pending" | "running" | "paused" | "done" | "failed" | "cancelled";
  currentLayer: number;
  startedAt: number;
  /** §69 全局超时 */
  globalTimeoutMs: number;
  /** §7 最大并行度 */
  maxParallelism: number;
  /** §7 失败策略 */
  failPolicy: "fail_fast" | "fail_at_end" | "continue";
  /** §7 checkpoint */
  checkpointStepId?: string;
}

export interface StepExecutionState {
  stepId: string;
  status: StepStatus;
  attempts: number;
  maxRetries: number;
  lastError?: string;
  /** §68 幂等键 */
  idempotencyKey: string;
  inputArtifacts: string[];
  outputArtifact?: string;
  startedAt?: number;
  completedAt?: number;
}

/**
 * §7 创建工作流执行实例
 */
export function createWorkflowExecution(
  workflow: Workflow,
  runId: string,
  mode: FlowMode = "semi_auto",
): WorkflowExecution {
  const steps = new Map<string, StepExecutionState>();
  for (const step of workflow.steps) {
    const sid = step.id ?? step.use;
    steps.set(sid, {
      stepId: sid,
      status: "pending",
      attempts: 0,
      maxRetries: step.retry_policy?.max_retries ?? 3,
      idempotencyKey: `${runId}:${sid}:0`,
      inputArtifacts: [],
    });
  }

  emitWorkflowTelemetry({
    workflowId: workflow.id,
    runId,
    type: "workflow_start",
    timestamp: Date.now(),
  });

  return {
    workflowId: workflow.id,
    runId,
    mode,
    steps,
    status: "pending",
    currentLayer: 0,
    startedAt: Date.now(),
    globalTimeoutMs: workflow.policy.global_timeout_ms || 300000,
    maxParallelism: workflow.policy.max_parallelism || 3,
    failPolicy: (workflow.policy.fail_policy as WorkflowExecution["failPolicy"]) || "fail_fast",
  };
}

/**
 * §7/§39 获取当前可调度的步骤 (所有依赖已完成 + 并行度限制)
 */
export function getReadySteps(
  execution: WorkflowExecution,
  dag: DagAnalysis,
): string[] {
  const running = Array.from(execution.steps.values()).filter(
    (s) => s.status === "dispatched" || s.status === "awaiting_send" || s.status === "waiting_output",
  );

  if (running.length >= execution.maxParallelism) return [];

  const ready: string[] = [];
  for (const [stepId, state] of execution.steps) {
    if (state.status !== "pending") continue;
    const node = dag.nodes.get(stepId);
    if (!node) continue;

    // all dependencies must be captured/done
    const depsOk = node.dependencies.every((dep) => {
      const depState = execution.steps.get(dep);
      return depState?.status === "captured";
    });

    if (depsOk) ready.push(stepId);
  }

  // respect parallelism limit
  const available = execution.maxParallelism - running.length;
  return ready.slice(0, available);
}

/**
 * §37 推进步骤状态
 */
export function advanceStep(
  execution: WorkflowExecution,
  stepId: string,
  newStatus: StepStatus,
  errorCode?: string,
  outputArtifact?: string,
): WorkflowExecution {
  const step = execution.steps.get(stepId);
  if (!step) return execution;

  const now = Date.now();

  // Telemetry: step lifecycle
  if (newStatus === "dispatched" && step.status === "pending") {
    emitWorkflowTelemetry({
      workflowId: execution.workflowId,
      runId: execution.runId,
      stepId,
      type: "step_start",
      timestamp: now,
    });
  } else if (newStatus === "captured") {
    emitWorkflowTelemetry({
      workflowId: execution.workflowId,
      runId: execution.runId,
      stepId,
      type: "step_end",
      timestamp: now,
      durationMs: now - (step.startedAt ?? now),
      status: "success",
    });
  } else if (newStatus === "failed") {
    if (step.attempts < step.maxRetries) {
      emitWorkflowTelemetry({
        workflowId: execution.workflowId,
        runId: execution.runId,
        stepId,
        type: "step_retry",
        timestamp: now,
        status: `attempt_${step.attempts}`,
      });
    } else {
      emitWorkflowTelemetry({
        workflowId: execution.workflowId,
        runId: execution.runId,
        stepId,
        type: "step_fail",
        timestamp: now,
        error: errorCode,
      });
    }
  }

  const updated: StepExecutionState = {
    ...step,
    status: newStatus,
    ...(newStatus === "dispatched" ? { startedAt: Date.now(), attempts: step.attempts + 1 } : {}),
    ...(newStatus === "captured" ? { completedAt: Date.now(), outputArtifact } : {}),
    ...(newStatus === "failed" ? { completedAt: Date.now(), lastError: errorCode } : {}),
  };

  // §68 幂等键更新
  if (newStatus === "dispatched") {
    updated.idempotencyKey = `${execution.runId}:${stepId}:${updated.attempts}`;
  }

  const newSteps = new Map(execution.steps);
  newSteps.set(stepId, updated);

  // evaluate overall workflow status
  let status = execution.status;
  const allStates = Array.from(newSteps.values());
  const allDone = allStates.every((s) => s.status === "captured");
  const anyFailed = allStates.some((s) => s.status === "failed");

  if (allDone) {
    status = "done";
    emitWorkflowTelemetry({
      workflowId: execution.workflowId,
      runId: execution.runId,
      type: "workflow_end",
      timestamp: now,
      durationMs: now - execution.startedAt,
      status: "done",
    });
  } else if (anyFailed && execution.failPolicy === "fail_fast") {
    status = "failed";
    emitWorkflowTelemetry({
      workflowId: execution.workflowId,
      runId: execution.runId,
      type: "workflow_end",
      timestamp: now,
      durationMs: now - execution.startedAt,
      status: "failed",
    });
  } else if (execution.status === "pending") {
    status = "running";
  }

  return { ...execution, steps: newSteps, status };
}

/**
 * §69 检查工作流全局超时
 */
export function isTimedOut(execution: WorkflowExecution): boolean {
  return Date.now() - execution.startedAt > execution.globalTimeoutMs;
}

/**
 * §69 检查步骤超时
 */
export function isStepTimedOut(step: StepExecutionState, timeoutMs: number): boolean {
  if (!step.startedAt) return false;
  return Date.now() - step.startedAt > timeoutMs;
}

/**
 * §69 步骤是否可重试
 */
export function canRetryStep(step: StepExecutionState): boolean {
  return step.status === "failed" && step.attempts < step.maxRetries;
}

/**
 * §7 验证 DAG 完整性 (发布约束)
 */
export function validateWorkflowDag(workflow: Workflow): string[] {
  const issues: string[] = [];
  const dag = analyzeDag(workflow);

  if (dag.hasCycle) {
    issues.push("DAG 存在循环依赖");
  }
  if (dag.unreachable.length > 0) {
    issues.push(`不可达节点: ${dag.unreachable.join(", ")}`);
  }
  if (workflow.steps.length === 0) {
    issues.push("Workflow 无任何步骤");
  }

  // 检查 fail path 覆盖
  for (const step of workflow.steps) {
    if (!step.compensation) {
      issues.push(`步骤 "${step.id ?? step.use}" 缺少 compensation (失败补偿)`);
    }
    if (!step.retry_policy) {
      issues.push(`步骤 "${step.id ?? step.use}" 缺少 retry_policy`);
    }
  }

  return issues;
}

/**
 * §7 汇聚策略
 */
export type MergeStrategy = "first_success" | "best_score" | "majority_vote" | "human_select";

export function mergeResults(
  strategy: MergeStrategy,
  results: Array<{ stepId: string; output: string; score?: number }>,
): { selected: string; reason: string } {
  if (results.length === 0) return { selected: "", reason: "无可用结果" };

  switch (strategy) {
    case "first_success":
      return { selected: results[0].output, reason: `使用首个成功结果 (step: ${results[0].stepId})` };
    case "best_score": {
      const sorted = [...results].sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      return { selected: sorted[0].output, reason: `最高评分 (step: ${sorted[0].stepId}, score: ${sorted[0].score})` };
    }
    case "majority_vote": {
      const counts = new Map<string, number>();
      for (const r of results) {
        counts.set(r.output, (counts.get(r.output) ?? 0) + 1);
      }
      let maxCount = 0;
      let winner = results[0].output;
      for (const [output, count] of counts) {
        if (count > maxCount) { maxCount = count; winner = output; }
      }
      return { selected: winner, reason: `多数投票 (票数: ${maxCount}/${results.length})` };
    }
    case "human_select":
    default:
      return { selected: results[0].output, reason: "等待用户手动选择" };
  }
}

/**
 * §67 执行补偿事务 — 当步骤失败时，按逆序执行已完成步骤的 compensation
 * 返回需要补偿的步骤 ID 列表和补偿结果
 */
export function getCompensationPlan(
  execution: WorkflowExecution,
  workflow: Workflow,
  failedStepId: string,
): { stepsToCompensate: string[]; compensations: Array<{ stepId: string; compensation: string }> } {
  const dag = analyzeDag(workflow);
  const stepsToCompensate: string[] = [];
  const compensations: Array<{ stepId: string; compensation: string }> = [];

  // 收集已完成（captured）且是 failedStep 的前驱的步骤
  // 按拓扑逆序排列以确保先补偿后执行的步骤
  const topoReversed = [...dag.topoOrder].reverse();

  for (const stepId of topoReversed) {
    if (stepId === failedStepId) continue;
    const state = execution.steps.get(stepId);
    if (!state || state.status !== "captured") continue;

    const stepDef = workflow.steps.find((s) => (s.id ?? s.use) === stepId);
    if (stepDef?.compensation) {
      stepsToCompensate.push(stepId);
      compensations.push({ stepId, compensation: stepDef.compensation });
    }
  }

  return { stepsToCompensate, compensations };
}

/**
 * §67 标记步骤进入补偿状态
 */
export function markCompensating(
  execution: WorkflowExecution,
  stepIds: string[],
): WorkflowExecution {
  const newSteps = new Map(execution.steps);
  for (const id of stepIds) {
    const step = newSteps.get(id);
    if (step) {
      newSteps.set(id, { ...step, status: "failed" as StepStatus, lastError: "compensation_triggered" });
    }
  }
  return { ...execution, steps: newSteps, status: "failed" };
}

/**
 * §39 暂停工作流执行
 */
export function pauseExecution(execution: WorkflowExecution): WorkflowExecution {
  if (execution.status !== "running") return execution;
  return { ...execution, status: "paused" };
}

/**
 * §39 恢复工作流执行
 */
export function resumeExecution(execution: WorkflowExecution): WorkflowExecution {
  if (execution.status !== "paused") return execution;
  return { ...execution, status: "running" };
}

/**
 * §39 取消工作流执行
 */
export function cancelExecution(execution: WorkflowExecution): WorkflowExecution {
  return { ...execution, status: "cancelled" };
}

/**
 * §32 生成工作流执行回放数据
 */
export function generateReplayData(
  execution: WorkflowExecution,
): { steps: StepExecutionState[]; totalDuration: number; status: string } {
  const steps = Array.from(execution.steps.values());
  const endTimes = steps.map((s) => s.completedAt ?? 0);
  const totalDuration = Math.max(...endTimes, 0) - execution.startedAt;
  return { steps, totalDuration, status: execution.status };
}

/**
 * §7 工作流执行进度摘要
 */
export function getExecutionProgress(execution: WorkflowExecution): {
  total: number;
  completed: number;
  failed: number;
  running: number;
  pending: number;
  percent: number;
} {
  const steps = Array.from(execution.steps.values());
  const total = steps.length;
  const completed = steps.filter((s) => s.status === "captured").length;
  const failed = steps.filter((s) => s.status === "failed").length;
  const running = steps.filter((s) => s.status === "dispatched" || s.status === "awaiting_send" || s.status === "waiting_output").length;
  const pending = steps.filter((s) => s.status === "pending").length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  return { total, completed, failed, running, pending, percent };
}
