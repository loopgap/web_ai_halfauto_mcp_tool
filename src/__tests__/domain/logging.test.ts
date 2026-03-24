// ═══════════════════════════════════════════════════════════
// logging.ts 单元测试 — 结构化日志
// ═══════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from "vitest";
import {
  createLogger,
  generateTraceId,
  exportLogs,
  setLogLevel,
  type LogEntry,
} from "../../domain/logging";

describe("generateTraceId", () => {
  it("格式正确", () => {
    const id = generateTraceId();
    expect(id).toMatch(/^t\d+-[a-z0-9]+$/);
  });

  it("每次调用不同", () => {
    const a = generateTraceId();
    const b = generateTraceId();
    expect(a).not.toBe(b);
  });
});

describe("createLogger", () => {
  it("创建模块 logger", () => {
    const logger = createLogger("test-module");
    expect(logger).toBeDefined();
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
  });

  it("调用不报错", () => {
    const logger = createLogger("test");
    expect(() => logger.info("test message")).not.toThrow();
    expect(() => logger.warn("warning", { key: "value" })).not.toThrow();
    expect(() => logger.error("error", undefined, "trace-123")).not.toThrow();
  });
});

describe("exportLogs", () => {
  it("格式化日志条目", () => {
    const entries: LogEntry[] = [
      { ts_ms: 1700000000000, level: "info", module: "test", message: "Hello", trace_id: "t1" },
      { ts_ms: 1700000001000, level: "error", module: "api", message: "Failed", trace_id: "t2", context: { code: 500 } },
    ];
    const output = exportLogs(entries);
    expect(output).toContain("[INFO ]");
    expect(output).toContain("[ERROR]");
    expect(output).toContain("[test]");
    expect(output).toContain("[api]");
    expect(output).toContain("Hello");
    expect(output).toContain("Failed");
    expect(output).toContain('"code":500');
  });

  it("空列表返回空字符串", () => {
    expect(exportLogs([])).toBe("");
  });
});

describe("setLogLevel", () => {
  beforeEach(() => {
    setLogLevel("info");
  });

  it("设置不报错", () => {
    expect(() => setLogLevel("debug")).not.toThrow();
    expect(() => setLogLevel("error")).not.toThrow();
  });
});
