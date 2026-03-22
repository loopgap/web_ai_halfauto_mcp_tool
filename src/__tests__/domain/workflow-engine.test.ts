// ═══════════════════════════════════════════════════════════
// workflow-engine.ts — DAG 分析 单元测试
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import { analyzeDag, createWorkflowExecution } from "../../domain/workflow-engine";
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
