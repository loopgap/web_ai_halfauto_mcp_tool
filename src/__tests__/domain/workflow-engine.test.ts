// ═══════════════════════════════════════════════════════════
// workflow-engine.ts — DAG 分析 单元测试
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import {
  analyzeDag,
  createWorkflowExecution,
  getReadySteps,
  advanceStep,
  isTimedOut,
  canRetryStep,
  getCompensationPlan,
  markCompensating,
  pauseExecution,
  resumeExecution,
  cancelExecution,
  getExecutionProgress,
  validateWorkflowDag,
  mergeResults,
} from "../../domain/workflow-engine";
import type { Workflow } from "../../types";

function makeWorkflow(steps: Array<{ id: string; depends_on: string[] }>): Workflow {
  return {
    id: "wf-test",
    version: "1.0",
    title: "Test Workflow",
    steps: steps.map((s) => ({
      id: s.id,
      use: s.id,
      depends_on: s.depends_on,
      timeout_ms: 30000,
      emit_events: [],
    })),
    policy: {
      max_parallelism: 3,
      global_timeout_ms: 300000,
      fail_policy: "fail_fast",
      checkpoint_policy: "none",
      resume_policy: "restart",
      merge_strategy: "replace",
    },
  };
}

describe("analyzeDag", () => {
  it("线性 DAG 正确拓扑排序", () => {
    const wf = makeWorkflow([
      { id: "a", depends_on: [] },
      { id: "b", depends_on: ["a"] },
      { id: "c", depends_on: ["b"] },
    ]);
    const result = analyzeDag(wf);
    expect(result.hasCycle).toBe(false);
    expect(result.topoOrder).toEqual(["a", "b", "c"]);
    expect(result.maxDepth).toBe(2);
    expect(result.layers).toEqual([["a"], ["b"], ["c"]]);
  });

  it("并行分支分层正确", () => {
    const wf = makeWorkflow([
      { id: "root", depends_on: [] },
      { id: "left", depends_on: ["root"] },
      { id: "right", depends_on: ["root"] },
      { id: "merge", depends_on: ["left", "right"] },
    ]);
    const result = analyzeDag(wf);
    expect(result.hasCycle).toBe(false);
    expect(result.layers[0]).toEqual(["root"]);
    expect(result.layers[1]).toEqual(expect.arrayContaining(["left", "right"]));
    expect(result.layers[2]).toEqual(["merge"]);
    expect(result.maxDepth).toBe(2);
  });

  it("检测循环依赖", () => {
    const wf = makeWorkflow([
      { id: "a", depends_on: ["c"] },
      { id: "b", depends_on: ["a"] },
      { id: "c", depends_on: ["b"] },
    ]);
    const result = analyzeDag(wf);
    expect(result.hasCycle).toBe(true);
    expect(result.unreachable.length).toBeGreaterThan(0);
  });

  it("空 steps 不崩溃", () => {
    const wf = makeWorkflow([]);
    const result = analyzeDag(wf);
    expect(result.hasCycle).toBe(false);
    expect(result.topoOrder).toEqual([]);
    expect(result.maxDepth).toBe(0);
  });

  it("独立节点各自成层", () => {
    const wf = makeWorkflow([
      { id: "x", depends_on: [] },
      { id: "y", depends_on: [] },
      { id: "z", depends_on: [] },
    ]);
    const result = analyzeDag(wf);
    expect(result.hasCycle).toBe(false);
    expect(result.layers[0]).toEqual(expect.arrayContaining(["x", "y", "z"]));
    expect(result.maxDepth).toBe(0);
  });
});

describe("createWorkflowExecution", () => {
  it("创建执行实例初始状态正确", () => {
    const wf = makeWorkflow([
      { id: "s1", depends_on: [] },
      { id: "s2", depends_on: ["s1"] },
    ]);
    const exec = createWorkflowExecution(wf, "run-001", "semi_auto");

    expect(exec.workflowId).toBe("wf-test");
    expect(exec.runId).toBe("run-001");
    expect(exec.mode).toBe("semi_auto");
    expect(exec.status).toBe("pending");
    expect(exec.steps.size).toBe(2);
    expect(exec.steps.get("s1")!.status).toBe("pending");
    expect(exec.steps.get("s2")!.maxRetries).toBe(3);
    expect(exec.maxParallelism).toBe(3);
    expect(exec.failPolicy).toBe("fail_fast");
  });
});

describe("getReadySteps", () => {
  it("根节点立即就绪", () => {
    const wf = makeWorkflow([
      { id: "a", depends_on: [] },
      { id: "b", depends_on: ["a"] },
    ]);
    const exec = createWorkflowExecution(wf, "run-001");
    const dag = analyzeDag(wf);
    const ready = getReadySteps(exec, dag);
    expect(ready).toContain("a");
    expect(ready).not.toContain("b");
  });

  it("依赖完成后后继就绪", () => {
    const wf = makeWorkflow([
      { id: "a", depends_on: [] },
      { id: "b", depends_on: ["a"] },
    ]);
    let exec = createWorkflowExecution(wf, "run-001");
    exec = advanceStep(exec, "a", "dispatched");
    exec = advanceStep(exec, "a", "captured", undefined, "art-1");
    const dag = analyzeDag(wf);
    const ready = getReadySteps(exec, dag);
    expect(ready).toContain("b");
  });
});

describe("advanceStep", () => {
  it("更新步骤状态", () => {
    const wf = makeWorkflow([{ id: "s1", depends_on: [] }]);
    let exec = createWorkflowExecution(wf, "run-001");
    exec = advanceStep(exec, "s1", "dispatched");
    expect(exec.steps.get("s1")!.status).toBe("dispatched");
    expect(exec.steps.get("s1")!.attempts).toBe(1);
    expect(exec.status).toBe("running");
  });

  it("所有 captured → done", () => {
    const wf = makeWorkflow([{ id: "s1", depends_on: [] }]);
    let exec = createWorkflowExecution(wf, "run-001");
    exec = advanceStep(exec, "s1", "captured");
    expect(exec.status).toBe("done");
  });

  it("fail_fast 策略: 一个失败整体失败", () => {
    const wf = makeWorkflow([
      { id: "a", depends_on: [] },
      { id: "b", depends_on: [] },
    ]);
    let exec = createWorkflowExecution(wf, "run-001");
    exec = advanceStep(exec, "a", "failed", "E001");
    expect(exec.status).toBe("failed");
    expect(exec.steps.get("a")!.lastError).toBe("E001");
  });
});

describe("isTimedOut", () => {
  it("未超时返回 false", () => {
    const wf = makeWorkflow([{ id: "s1", depends_on: [] }]);
    const exec = createWorkflowExecution(wf, "run-001");
    expect(isTimedOut(exec)).toBe(false);
  });
});

describe("canRetryStep", () => {
  it("failed 且有剩余次数可重试", () => {
    expect(canRetryStep({ stepId: "s1", status: "failed", attempts: 1, maxRetries: 3, idempotencyKey: "k", inputArtifacts: [] })).toBe(true);
  });

  it("用完次数不可重试", () => {
    expect(canRetryStep({ stepId: "s1", status: "failed", attempts: 3, maxRetries: 3, idempotencyKey: "k", inputArtifacts: [] })).toBe(false);
  });

  it("非 failed 不可重试", () => {
    expect(canRetryStep({ stepId: "s1", status: "pending", attempts: 0, maxRetries: 3, idempotencyKey: "k", inputArtifacts: [] })).toBe(false);
  });
});

describe("getCompensationPlan", () => {
  it("收集已完成步骤的补偿", () => {
    const wf: Workflow = {
      id: "wf-comp",
      version: "1.0",
      title: "Test",
      steps: [
        { id: "s1", use: "s1", depends_on: [], timeout_ms: 30000, emit_events: [], compensation: "undo_s1" },
        { id: "s2", use: "s2", depends_on: ["s1"], timeout_ms: 30000, emit_events: [], compensation: "undo_s2" },
        { id: "s3", use: "s3", depends_on: ["s2"], timeout_ms: 30000, emit_events: [] },
      ],
      policy: { max_parallelism: 3, global_timeout_ms: 300000, fail_policy: "fail_fast", checkpoint_policy: "none", resume_policy: "restart", merge_strategy: "replace" },
    };
    let exec = createWorkflowExecution(wf, "run-001");
    exec = advanceStep(exec, "s1", "captured", undefined, "art-1");
    exec = advanceStep(exec, "s2", "captured", undefined, "art-2");
    exec = advanceStep(exec, "s3", "failed", "E001");

    const plan = getCompensationPlan(exec, wf, "s3");
    expect(plan.stepsToCompensate).toContain("s1");
    expect(plan.stepsToCompensate).toContain("s2");
    expect(plan.compensations).toHaveLength(2);
  });
});

describe("pauseExecution / resumeExecution / cancelExecution", () => {
  it("markCompensating 标记步骤为补偿状态", () => {
    const wf = makeWorkflow([
      { id: "a", depends_on: [] },
      { id: "b", depends_on: [] },
    ]);
    let exec = createWorkflowExecution(wf, "run-001");
    exec = advanceStep(exec, "a", "captured");
    exec = markCompensating(exec, ["a"]);
    expect(exec.steps.get("a")!.status).toBe("failed");
    expect(exec.steps.get("a")!.lastError).toBe("compensation_triggered");
    expect(exec.status).toBe("failed");
  });

  it("暂停/恢复工作流", () => {
    const wf = makeWorkflow([{ id: "s1", depends_on: [] }]);
    let exec = createWorkflowExecution(wf, "run-001");
    exec = advanceStep(exec, "s1", "dispatched");
    expect(exec.status).toBe("running");
    exec = pauseExecution(exec);
    expect(exec.status).toBe("paused");
    exec = resumeExecution(exec);
    expect(exec.status).toBe("running");
  });

  it("取消工作流", () => {
    const wf = makeWorkflow([{ id: "s1", depends_on: [] }]);
    let exec = createWorkflowExecution(wf, "run-001");
    exec = cancelExecution(exec);
    expect(exec.status).toBe("cancelled");
  });
});

describe("getExecutionProgress", () => {
  it("正确计算进度", () => {
    const wf = makeWorkflow([
      { id: "a", depends_on: [] },
      { id: "b", depends_on: [] },
      { id: "c", depends_on: [] },
    ]);
    let exec = createWorkflowExecution(wf, "run-001");
    exec = advanceStep(exec, "a", "captured");
    exec = advanceStep(exec, "b", "dispatched");
    const progress = getExecutionProgress(exec);
    expect(progress.total).toBe(3);
    expect(progress.completed).toBe(1);
    expect(progress.running).toBe(1);
    expect(progress.pending).toBe(1);
    expect(progress.percent).toBe(33);
  });
});

describe("validateWorkflowDag", () => {
  it("有效 workflow 无问题 (除缺少 compensation)", () => {
    const wf: Workflow = {
      id: "wf-v",
      version: "1.0",
      title: "Test",
      steps: [
        { id: "s1", use: "s1", depends_on: [], timeout_ms: 30000, emit_events: [], compensation: "c1", retry_policy: { max_retries: 3, delay_ms: 1000, backoff: "exponential" } },
      ],
      policy: { max_parallelism: 3, global_timeout_ms: 300000, fail_policy: "fail_fast", checkpoint_policy: "none", resume_policy: "restart", merge_strategy: "replace" },
    };
    const issues = validateWorkflowDag(wf);
    expect(issues).toEqual([]);
  });

  it("循环依赖报告问题", () => {
    const wf = makeWorkflow([
      { id: "a", depends_on: ["b"] },
      { id: "b", depends_on: ["a"] },
    ]);
    const issues = validateWorkflowDag(wf);
    expect(issues.some((i) => i.includes("循环依赖"))).toBe(true);
  });
});

describe("mergeResults", () => {
  const results = [
    { stepId: "s1", output: "A", score: 0.8 },
    { stepId: "s2", output: "B", score: 0.95 },
    { stepId: "s3", output: "A", score: 0.7 },
  ];

  it("first_success 返回第一个", () => {
    const r = mergeResults("first_success", results);
    expect(r.selected).toBe("A");
  });

  it("best_score 返回最高分", () => {
    const r = mergeResults("best_score", results);
    expect(r.selected).toBe("B");
  });

  it("majority_vote 返回多数", () => {
    const r = mergeResults("majority_vote", results);
    expect(r.selected).toBe("A"); // A appears twice
  });

  it("空结果不崩溃", () => {
    const r = mergeResults("first_success", []);
    expect(r.selected).toBe("");
  });
});
