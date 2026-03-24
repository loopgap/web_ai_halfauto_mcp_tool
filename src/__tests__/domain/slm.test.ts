// ═══════════════════════════════════════════════════════════
// slm.ts 单元测试 — 设备选择、CPU-safe 模式、质量门
// ═══════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import {
  defaultSlmConfig,
  defaultRuntimeState,
  selectDevice,
  shouldEnterCpuSafe,
  checkQualityBaseline,
  getSlmSummary,
  recommendedModels,
  type SlmRuntimeState,
  type QualityBaseline,
} from "../../domain/slm";

describe("defaultSlmConfig", () => {
  it("返回合理默认值", () => {
    const config = defaultSlmConfig();
    expect(config.devicePriority).toContain("cpu");
    expect(config.budget.memoryMaxRatio).toBeLessThan(1);
    expect(config.qualityGate.routerAccuracyDropMax).toBeGreaterThan(0);
  });
});

describe("defaultRuntimeState", () => {
  it("所有模型初始未加载", () => {
    const state = defaultRuntimeState();
    for (const model of Object.values(state.models)) {
      expect(model.loaded).toBe(false);
      expect(model.device).toBe("none");
    }
  });

  it("CPU 可用", () => {
    const state = defaultRuntimeState();
    expect(state.deviceCapabilities.hasCpu).toBe(true);
  });
});

describe("selectDevice", () => {
  it("CPU-safe 模式下总是返回 cpu", () => {
    const config = defaultSlmConfig();
    const runtime: SlmRuntimeState = { ...defaultRuntimeState(), cpuSafeMode: true };
    expect(selectDevice(config, runtime, "router_slm")).toBe("cpu");
  });

  it("无 GPU 时回退到 cpu", () => {
    const config = defaultSlmConfig();
    const runtime = defaultRuntimeState();
    // devicePriority 是 ["igpu", "cpu"], 但 hasGpu = false
    expect(selectDevice(config, runtime, "router_slm")).toBe("cpu");
  });

  it("GPU 可用且利用率低时选择 igpu", () => {
    const config = defaultSlmConfig();
    const runtime: SlmRuntimeState = {
      ...defaultRuntimeState(),
      deviceCapabilities: { ...defaultRuntimeState().deviceCapabilities, hasGpu: true, gpuMemoryMb: 4096 },
      resourceSnapshot: { ...defaultRuntimeState().resourceSnapshot, gpuUtil: 0.1 },
    };
    expect(selectDevice(config, runtime, "router_slm")).toBe("igpu");
  });

  it("GPU 利用率超峰值时回退 cpu", () => {
    const config = defaultSlmConfig();
    const runtime: SlmRuntimeState = {
      ...defaultRuntimeState(),
      deviceCapabilities: { ...defaultRuntimeState().deviceCapabilities, hasGpu: true },
      resourceSnapshot: { ...defaultRuntimeState().resourceSnapshot, gpuUtil: 0.95 },
    };
    expect(selectDevice(config, runtime, "router_slm")).toBe("cpu");
  });
});

describe("shouldEnterCpuSafe", () => {
  it("正常状态不进入 CPU-safe", () => {
    const config = defaultSlmConfig();
    const runtime = defaultRuntimeState();
    expect(shouldEnterCpuSafe(config, runtime).enter).toBe(false);
  });

  it("内存超预算触发 CPU-safe", () => {
    const config = defaultSlmConfig();
    const runtime: SlmRuntimeState = {
      ...defaultRuntimeState(),
      resourceSnapshot: {
        ...defaultRuntimeState().resourceSnapshot,
        memoryUsedMb: 6000,
        memoryTotalMb: 8000,
      },
    };
    const result = shouldEnterCpuSafe(config, runtime);
    expect(result.enter).toBe(true);
    expect(result.reason).toContain("内存占用");
  });

  it("GPU 利用率超峰值触发 CPU-safe", () => {
    const config = defaultSlmConfig();
    const runtime: SlmRuntimeState = {
      ...defaultRuntimeState(),
      resourceSnapshot: { ...defaultRuntimeState().resourceSnapshot, gpuUtil: 0.95 },
    };
    const result = shouldEnterCpuSafe(config, runtime);
    expect(result.enter).toBe(true);
    expect(result.reason).toContain("GPU");
  });
});

describe("checkQualityBaseline", () => {
  const goodBaseline: QualityBaseline = {
    cpuRouterAccuracy: 0.95,
    cpuGatePassRate: 0.98,
    cpuErrorAttribution: 1.0,
    currentRouterAccuracy: 0.94,
    currentGatePassRate: 0.975,
    currentErrorAttribution: 1.0,
    routerDelta: 0.01,
    gateDelta: 0.005,
    attrDelta: 0,
  };

  it("合格基线通过", () => {
    const config = defaultSlmConfig();
    expect(checkQualityBaseline(config, goodBaseline).passed).toBe(true);
  });

  it("路由准确率下降过大时失败", () => {
    const config = defaultSlmConfig();
    const baseline: QualityBaseline = { ...goodBaseline, routerDelta: 0.05 };
    const result = checkQualityBaseline(config, baseline);
    expect(result.passed).toBe(false);
    expect(result.issues[0]).toContain("路由准确率");
  });
});

describe("getSlmSummary", () => {
  it("默认状态返回零值", () => {
    const runtime = defaultRuntimeState();
    const summary = getSlmSummary(runtime);
    expect(summary.totalLoaded).toBe(0);
    expect(summary.totalInferences).toBe(0);
    expect(summary.cpuSafeMode).toBe(false);
    expect(summary.activeDevices).toEqual([]);
  });

  it("有加载模型时正确统计", () => {
    const runtime: SlmRuntimeState = {
      ...defaultRuntimeState(),
      models: {
        ...defaultRuntimeState().models,
        router_slm: {
          ...defaultRuntimeState().models.router_slm,
          loaded: true,
          device: "cpu",
          inferenceCount: 50,
          lastInferenceMs: 100,
        },
      },
    };
    const summary = getSlmSummary(runtime);
    expect(summary.totalLoaded).toBe(1);
    expect(summary.totalInferences).toBe(50);
    expect(summary.avgLatencyMs).toBe(100);
    expect(summary.activeDevices).toContain("cpu");
  });
});

describe("recommendedModels", () => {
  it("包含所有角色", () => {
    const models = recommendedModels();
    expect(models.router_slm).toBeDefined();
    expect(models.qa_slm).toBeDefined();
    expect(models.planner_slm).toBeDefined();
    expect(models.coder_slm).toBeDefined();
  });
});
