// ═══════════════════════════════════════════════════════════
// §4 Local SLM Management Framework — 本地小模型管理框架
// 调度策略 / 资源监控 / 加载策略 / 质量门 / 降级
// ═══════════════════════════════════════════════════════════

// ═══ 模型定义 ═══

export type SlmRole = "router_slm" | "planner_slm" | "qa_slm" | "coder_slm";
export type DevicePriority = "igpu" | "npu" | "cpu";
export type LoadTier = "hot" | "warm" | "cold";
export type QuantLevel = "INT4" | "INT8" | "FP16";

export interface SlmModel {
  id: string;
  role: SlmRole;
  version: string;
  /** 参数量描述 (如 "1.5B", "3B", "7B") */
  paramSize: string;
  quant: QuantLevel;
  checksum?: string;
  /** 模型文件路径 */
  path?: string;
}

export interface SlmConfig {
  /** 当前执行优先级 */
  devicePriority: DevicePriority[];
  /** 模型加载策略 */
  loadTiers: Record<SlmRole, LoadTier>;
  /** 资源预算 */
  budget: ResourceBudget;
  /** 质量门限 */
  qualityGate: QualityThresholds;
}

export interface ResourceBudget {
  /** NPU 目标利用率 (0-1) */
  npuTargetUtil: number;
  /** NPU 峰值利用率 (0-1) */
  npuPeakUtil: number;
  /** GPU 目标利用率 (0-1) */
  gpuTargetUtil: number;
  /** GPU 峰值利用率 (0-1) */
  gpuPeakUtil: number;
  /** 系统内存占用上限 (0-1) */
  memoryMaxRatio: number;
  /** 路由推理 P95 目标 ms */
  routerP95Ms: number;
}

export interface QualityThresholds {
  /** 路由 Top1 准确率相对 CPU 基线下降上限 (0-1) */
  routerAccuracyDropMax: number;
  /** 质量门禁通过率下降上限 (0-1) */
  gatePassRateDropMax: number;
  /** 错误归因准确率不可下降 */
  errorAttributionDropMax: number;
}

// ═══ 运行时状态 ═══

export interface SlmRuntimeState {
  /** 各角色当前加载状态 */
  models: Record<SlmRole, ModelStatus>;
  /** 设备能力探测结果 */
  deviceCapabilities: DeviceCapabilities;
  /** 资源占用快照 */
  resourceSnapshot: ResourceSnapshot;
  /** 是否在 CPU-safe 模式 */
  cpuSafeMode: boolean;
  /** 质量基线数据 */
  qualityBaseline: QualityBaseline | null;
}

export interface ModelStatus {
  role: SlmRole;
  model?: SlmModel;
  loaded: boolean;
  device: DevicePriority | "none";
  loadTier: LoadTier;
  lastInferenceMs?: number;
  inferenceCount: number;
  errorCount: number;
}

export interface DeviceCapabilities {
  hasNpu: boolean;
  npuDriverVersion?: string;
  npuMemoryMb?: number;
  npuOperatorSupport: boolean;
  hasGpu: boolean;
  gpuName?: string;
  gpuMemoryMb?: number;
  hasCpu: boolean;
  cpuCores: number;
}

export interface ResourceSnapshot {
  npuUtil: number;
  gpuUtil: number;
  cpuUtil: number;
  memoryUsedMb: number;
  memoryTotalMb: number;
  hotModelCount: number;
  warmModelCount: number;
}

export interface QualityBaseline {
  cpuRouterAccuracy: number;
  cpuGatePassRate: number;
  cpuErrorAttribution: number;
  currentRouterAccuracy: number;
  currentGatePassRate: number;
  currentErrorAttribution: number;
  /** 相对偏差 */
  routerDelta: number;
  gateDelta: number;
  attrDelta: number;
}

// ═══ 默认配置 ═══

export function defaultSlmConfig(): SlmConfig {
  return {
    devicePriority: ["igpu", "cpu"],
    loadTiers: {
      router_slm: "hot",
      qa_slm: "warm",
      planner_slm: "cold",
      coder_slm: "cold",
    },
    budget: {
      npuTargetUtil: 0.4,
      npuPeakUtil: 0.8,
      gpuTargetUtil: 0.5,
      gpuPeakUtil: 0.9,
      memoryMaxRatio: 0.35,
      routerP95Ms: 600,
    },
    qualityGate: {
      routerAccuracyDropMax: 0.015,
      gatePassRateDropMax: 0.01,
      errorAttributionDropMax: 0,
    },
  };
}

export function defaultRuntimeState(): SlmRuntimeState {
  const mkModelStatus = (role: SlmRole, tier: LoadTier): ModelStatus => ({
    role,
    loaded: false,
    device: "none",
    loadTier: tier,
    inferenceCount: 0,
    errorCount: 0,
  });
  return {
    models: {
      router_slm: mkModelStatus("router_slm", "hot"),
      qa_slm: mkModelStatus("qa_slm", "warm"),
      planner_slm: mkModelStatus("planner_slm", "cold"),
      coder_slm: mkModelStatus("coder_slm", "cold"),
    },
    deviceCapabilities: {
      hasNpu: false,
      npuOperatorSupport: false,
      hasGpu: false,
      hasCpu: true,
      cpuCores: navigator.hardwareConcurrency ?? 4,
    },
    resourceSnapshot: {
      npuUtil: 0,
      gpuUtil: 0,
      cpuUtil: 0,
      memoryUsedMb: 0,
      memoryTotalMb: 0,
      hotModelCount: 0,
      warmModelCount: 0,
    },
    cpuSafeMode: false,
    qualityBaseline: null,
  };
}

// ═══ 调度策略 ═══

/**
 * §4 根据当前资源状况决定使用哪个设备加载模型
 */
export function selectDevice(
  config: SlmConfig,
  runtime: SlmRuntimeState,
  _role: SlmRole,
): DevicePriority {
  if (runtime.cpuSafeMode) return "cpu";

  for (const device of config.devicePriority) {
    if (device === "npu") {
      if (!runtime.deviceCapabilities.hasNpu || !runtime.deviceCapabilities.npuOperatorSupport) continue;
      if (runtime.resourceSnapshot.npuUtil > config.budget.npuPeakUtil) continue;
      return "npu";
    }
    if (device === "igpu") {
      if (!runtime.deviceCapabilities.hasGpu) continue;
      if (runtime.resourceSnapshot.gpuUtil > config.budget.gpuPeakUtil) continue;
      return "igpu";
    }
    if (device === "cpu") {
      return "cpu";
    }
  }
  return "cpu";
}

/**
 * §4 检查是否需要进入 CPU-safe 模式
 */
export function shouldEnterCpuSafe(
  config: SlmConfig,
  runtime: SlmRuntimeState,
): { enter: boolean; reason?: string } {
  // NPU 推理失败过多
  const npuModels = Object.values(runtime.models).filter((m) => m.device === "npu");
  const npuErrors = npuModels.reduce((sum, m) => sum + m.errorCount, 0);
  if (npuErrors > 3) {
    return { enter: true, reason: "NPU 推理连续失败超过 3 次" };
  }

  // GPU 资源超预算
  if (runtime.resourceSnapshot.gpuUtil > config.budget.gpuPeakUtil) {
    return { enter: true, reason: "GPU 利用率超过峰值预算" };
  }

  // 内存超预算
  const memRatio = runtime.resourceSnapshot.memoryUsedMb / (runtime.resourceSnapshot.memoryTotalMb || 1);
  if (memRatio > config.budget.memoryMaxRatio) {
    return { enter: true, reason: `内存占用 ${(memRatio * 100).toFixed(0)}% 超过阈值 ${config.budget.memoryMaxRatio * 100}%` };
  }

  return { enter: false };
}

/**
 * §4 检查质量门限 (是否允许 NPU 常驻)
 */
export function checkQualityBaseline(
  config: SlmConfig,
  baseline: QualityBaseline,
): { passed: boolean; issues: string[] } {
  const issues: string[] = [];

  if (baseline.routerDelta > config.qualityGate.routerAccuracyDropMax) {
    issues.push(`路由准确率下降 ${(baseline.routerDelta * 100).toFixed(1)}% 超过阈值 ${config.qualityGate.routerAccuracyDropMax * 100}%`);
  }
  if (baseline.gateDelta > config.qualityGate.gatePassRateDropMax) {
    issues.push(`门禁通过率下降 ${(baseline.gateDelta * 100).toFixed(1)}% 超过阈值 ${config.qualityGate.gatePassRateDropMax * 100}%`);
  }
  if (baseline.attrDelta > config.qualityGate.errorAttributionDropMax) {
    issues.push(`错误归因准确率下降`);
  }

  return { passed: issues.length === 0, issues };
}

/**
 * §4 推荐模型分层配置
 */
export function recommendedModels(): Record<SlmRole, { paramSize: string; quant: QuantLevel; preferDevice: string }> {
  return {
    router_slm: { paramSize: "1.5B", quant: "INT4", preferDevice: "NPU hot" },
    qa_slm: { paramSize: "1.5B~3B", quant: "INT4", preferDevice: "NPU warm" },
    planner_slm: { paramSize: "3B", quant: "INT8", preferDevice: "按需 CPU/GPU" },
    coder_slm: { paramSize: "3B~7B", quant: "INT8", preferDevice: "按需 CPU/GPU" },
  };
}

/**
 * §4 SLM 指标摘要 (用于 Dashboard / Settings)
 */
export function getSlmSummary(runtime: SlmRuntimeState): {
  totalLoaded: number;
  totalInferences: number;
  avgLatencyMs: number;
  cpuSafeMode: boolean;
  activeDevices: string[];
} {
  const models = Object.values(runtime.models);
  const loaded = models.filter((m) => m.loaded);
  const totalInferences = models.reduce((s, m) => s + m.inferenceCount, 0);
  const latencies = models.filter((m) => m.lastInferenceMs != null).map((m) => m.lastInferenceMs!);
  const avgLatencyMs = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  const activeDevices = [...new Set(loaded.map((m) => m.device).filter((d) => d !== "none"))];

  return {
    totalLoaded: loaded.length,
    totalInferences,
    avgLatencyMs,
    cpuSafeMode: runtime.cpuSafeMode,
    activeDevices,
  };
}
