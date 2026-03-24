// ═══════════════════════════════════════════════════════════
// §101 Runtime Health Check — 应用内运行时诊断
// 零依赖、轻量级、可从 UI 或控制台触发
// ═══════════════════════════════════════════════════════════

import { createLogger, getLogBuffer, exportLogs } from "./logging";
import { getHealSummary, type SelfHealEngine } from "./self-heal";

const log = createLogger("health-check");

// ═══ 健康状态模型 ═══

export type CheckStatus = "pass" | "warn" | "fail";

export interface HealthCheckItem {
  name: string;
  status: CheckStatus;
  message: string;
  detail?: string;
  durationMs: number;
}

export interface HealthReport {
  timestamp: number;
  overall: CheckStatus;
  checks: HealthCheckItem[];
  environment: {
    userAgent: string;
    language: string;
    onLine: boolean;
    memoryMB?: number;
    domNodes: number;
  };
}

// ═══ 单项检查函数 ═══

/** localStorage 可用性 */
function checkLocalStorage(): HealthCheckItem {
  const t0 = performance.now();
  try {
    const key = "__hc_probe__";
    localStorage.setItem(key, "1");
    const v = localStorage.getItem(key);
    localStorage.removeItem(key);
    if (v !== "1") throw new Error("读写不一致");
    return { name: "localStorage", status: "pass", message: "读写正常", durationMs: performance.now() - t0 };
  } catch (e) {
    return { name: "localStorage", status: "fail", message: "不可用", detail: String(e), durationMs: performance.now() - t0 };
  }
}

/** 内存使用状态 */
function checkMemory(): HealthCheckItem {
  const t0 = performance.now();
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  if (!mem) {
    return { name: "内存", status: "pass", message: "API 不可用 (非 Chromium)", durationMs: performance.now() - t0 };
  }
  const usedMB = Math.round(mem.usedJSHeapSize / 1048576);
  const limitMB = Math.round(mem.jsHeapSizeLimit / 1048576);
  const pct = Math.round((mem.usedJSHeapSize / mem.jsHeapSizeLimit) * 100);
  if (pct > 85) {
    return { name: "内存", status: "warn", message: `使用率 ${pct}% (${usedMB}/${limitMB} MB)`, durationMs: performance.now() - t0 };
  }
  return { name: "内存", status: "pass", message: `${usedMB} MB (${pct}%)`, durationMs: performance.now() - t0 };
}

/** DOM 节点数量 */
function checkDomComplexity(): HealthCheckItem {
  const t0 = performance.now();
  const count = document.querySelectorAll("*").length;
  if (count > 5000) {
    return { name: "DOM 节点", status: "warn", message: `${count} 个节点 (偏多，可能影响性能)`, durationMs: performance.now() - t0 };
  }
  return { name: "DOM 节点", status: "pass", message: `${count} 个节点`, durationMs: performance.now() - t0 };
}

/** 后端连通性 (Tauri invoke) */
async function checkBackendConnection(): Promise<HealthCheckItem> {
  const t0 = performance.now();
  try {
    const { invoke } = await import("@tauri-apps/api/core");
    // 使用最轻量的命令探测后端
    await invoke("health_check");
    return { name: "后端连接", status: "pass", message: `正常 (${Math.round(performance.now() - t0)}ms)`, durationMs: performance.now() - t0 };
  } catch (e) {
    const msg = String(e);
    // 仅前端模式下 invoke 会抛出 mock 错误
    if (msg.includes("not mocked") || msg.includes("__TAURI__")) {
      return { name: "后端连接", status: "warn", message: "仅前端模式 (无 Tauri 后端)", durationMs: performance.now() - t0 };
    }
    return { name: "后端连接", status: "fail", message: "后端不可达", detail: msg, durationMs: performance.now() - t0 };
  }
}

/** 日志系统健康 */
function checkLogSystem(): HealthCheckItem {
  const t0 = performance.now();
  const buffer = getLogBuffer();
  const recentErrors = buffer.filter((e) => e.level === "error" && Date.now() - e.ts_ms < 300000);
  if (recentErrors.length > 10) {
    return { name: "日志系统", status: "warn", message: `5 分钟内 ${recentErrors.length} 条错误日志`, detail: recentErrors.slice(-3).map((e) => e.message).join("; "), durationMs: performance.now() - t0 };
  }
  return { name: "日志系统", status: "pass", message: `缓冲 ${buffer.length} 条，近期错误 ${recentErrors.length} 条`, durationMs: performance.now() - t0 };
}

/** 自愈引擎状态 */
function checkSelfHealEngine(engine?: SelfHealEngine): HealthCheckItem {
  const t0 = performance.now();
  if (!engine) {
    return { name: "自愈引擎", status: "pass", message: "未初始化 (首次启动)", durationMs: performance.now() - t0 };
  }
  const summary = getHealSummary(engine);
  if (summary.openBreakers.length > 0) {
    return { name: "自愈引擎", status: "warn", message: `${summary.openBreakers.length} 个熔断器打开`, detail: summary.openBreakers.join(", "), durationMs: performance.now() - t0 };
  }
  return { name: "自愈引擎", status: "pass", message: `成功率 ${Math.round(summary.successRate * 100)}%, ${summary.totalAttempts} 次尝试`, durationMs: performance.now() - t0 };
}

// ═══ 主诊断入口 ═══

/**
 * 运行完整的运行时健康检查
 * @param selfHealEngine 可选的自愈引擎实例
 * @returns 健康报告
 */
export async function runHealthCheck(selfHealEngine?: SelfHealEngine): Promise<HealthReport> {
  log.info("health_check_start");

  const checks: HealthCheckItem[] = [
    checkLocalStorage(),
    checkMemory(),
    checkDomComplexity(),
    checkLogSystem(),
    checkSelfHealEngine(selfHealEngine),
  ];

  // 后端检查是异步的
  checks.push(await checkBackendConnection());

  const overall: CheckStatus = checks.some((c) => c.status === "fail")
    ? "fail"
    : checks.some((c) => c.status === "warn")
      ? "warn"
      : "pass";

  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;

  const report: HealthReport = {
    timestamp: Date.now(),
    overall,
    checks,
    environment: {
      userAgent: navigator.userAgent,
      language: navigator.language,
      onLine: navigator.onLine,
      memoryMB: mem ? Math.round(mem.usedJSHeapSize / 1048576) : undefined,
      domNodes: document.querySelectorAll("*").length,
    },
  };

  log.info("health_check_complete", { overall, checkCount: checks.length });
  return report;
}

/**
 * 导出完整诊断包 (日志 + 健康报告) 为文本
 */
export function exportDiagnosticBundle(report: HealthReport): string {
  const lines: string[] = [
    "═══════════════════════════════════════",
    "  AI Workbench 诊断报告",
    `  ${new Date(report.timestamp).toISOString()}`,
    "═══════════════════════════════════════",
    "",
    `总体状态: ${report.overall.toUpperCase()}`,
    "",
    "── 环境 ──",
    `浏览器: ${report.environment.userAgent}`,
    `语言: ${report.environment.language}`,
    `网络: ${report.environment.onLine ? "在线" : "离线"}`,
    `内存: ${report.environment.memoryMB ?? "N/A"} MB`,
    `DOM 节点: ${report.environment.domNodes}`,
    "",
    "── 检查项 ──",
  ];

  for (const c of report.checks) {
    const icon = c.status === "pass" ? "✅" : c.status === "warn" ? "⚠️" : "❌";
    lines.push(`${icon} ${c.name}: ${c.message} (${Math.round(c.durationMs)}ms)`);
    if (c.detail) lines.push(`   详情: ${c.detail}`);
  }

  lines.push("");
  lines.push("── 最近日志 ──");
  const logs = getLogBuffer().slice(-50);
  lines.push(exportLogs(logs));

  return lines.join("\n");
}
