// ═══════════════════════════════════════════════════════════
// health-check.ts — 运行时健康检查 单元测试
// ═══════════════════════════════════════════════════════════

import { describe, it, expect, vi, beforeEach } from "vitest";
import { runHealthCheck, exportDiagnosticBundle, type HealthReport } from "../../domain/health-check";
import { createSelfHealEngine } from "../../domain/self-heal";

beforeEach(() => {
  localStorage.clear();
});

describe("runHealthCheck", () => {
  it("返回完整的健康报告", async () => {
    const report = await runHealthCheck();
    expect(report.timestamp).toBeGreaterThan(0);
    expect(report.overall).toMatch(/^(pass|warn|fail)$/);
    expect(report.checks.length).toBeGreaterThanOrEqual(5);
    expect(report.environment.domNodes).toBeGreaterThanOrEqual(0);
  });

  it("含自愈引擎时检查正常", async () => {
    const engine = createSelfHealEngine([], []);
    const report = await runHealthCheck(engine);
    const healCheck = report.checks.find((c) => c.name === "自愈引擎");
    expect(healCheck).toBeDefined();
    expect(healCheck!.status).toBe("pass");
  });

  it("localStorage 正常时通过", async () => {
    const report = await runHealthCheck();
    const lsCheck = report.checks.find((c) => c.name === "localStorage");
    expect(lsCheck).toBeDefined();
    expect(lsCheck!.status).toBe("pass");
  });
});

describe("exportDiagnosticBundle", () => {
  it("生成可读的诊断文本", async () => {
    const report = await runHealthCheck();
    const text = exportDiagnosticBundle(report);
    expect(text).toContain("AI Workbench 诊断报告");
    expect(text).toContain("总体状态:");
    expect(text).toContain("检查项");
    expect(text).toContain("最近日志");
  });

  it("包含环境信息", async () => {
    const report = await runHealthCheck();
    const text = exportDiagnosticBundle(report);
    expect(text).toContain("DOM 节点:");
  });
});
