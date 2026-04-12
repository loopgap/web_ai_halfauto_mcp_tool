// ═══════════════════════════════════════════════════════════
// §70 Structured Logging — 结构化日志 + trace_id 贯穿
// 所有模块统一入口，支持本地持久化 + 后端传输
// ═══════════════════════════════════════════════════════════

export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  ts_ms: number;
  level: LogLevel;
  module: string;
  message: string;
  trace_id: string;
  context?: Record<string, unknown>;
}

const LOG_BUFFER_KEY = "ai-workbench:log-buffer";
const MAX_BUFFER_SIZE = 200;

/** 日志级别优先级 */
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

let currentMinLevel: LogLevel = "info";

/** 设置最低日志级别 */
export function setLogLevel(level: LogLevel): void {
  currentMinLevel = level;
}

/** 生成 trace ID */
export function generateTraceId(): string {
  return `t${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function sanitizeForLog(text: string): string {
  return text
    .replace(/(?:password|token|secret|api[_-]?key)\s*[:=]\s*\S+/gi, "[REDACTED]")
    .replace(/[A-Za-z0-9+/]{32,}/g, "[REDACTED_BASE64]");
}

function sanitizeContext(ctx: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!ctx) return undefined;
  const sanitized: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(ctx)) {
    if (typeof v === "string") {
      sanitized[k] = sanitizeForLog(v);
    } else if (typeof v === "object" && v !== null) {
      sanitized[k] = sanitizeContext(v as Record<string, unknown>);
    } else {
      sanitized[k] = v;
    }
  }
  return sanitized;
}

/** 写入日志 (内部) */
function writeLog(entry: LogEntry): void {
  if (LEVEL_PRIORITY[entry.level] < LEVEL_PRIORITY[currentMinLevel]) return;

  const sanitizedEntry: LogEntry = {
    ...entry,
    message: sanitizeForLog(entry.message),
    context: sanitizeContext(entry.context),
  };

  // 控制台输出 (dev 模式)
  const prefix = `[${sanitizedEntry.module}]`;
  switch (sanitizedEntry.level) {
    case "debug": console.debug(prefix, sanitizedEntry.message, sanitizedEntry.context ?? ""); break;
    case "info":  console.info(prefix, sanitizedEntry.message, sanitizedEntry.context ?? "");  break;
    case "warn":  console.warn(prefix, sanitizedEntry.message, sanitizedEntry.context ?? "");  break;
    case "error": console.error(prefix, sanitizedEntry.message, sanitizedEntry.context ?? ""); break;
  }

  // 本地缓冲持久化 (ring buffer)
  try {
    const raw = localStorage.getItem(LOG_BUFFER_KEY);
    const buffer: LogEntry[] = raw ? JSON.parse(raw) : [];
    buffer.push(sanitizedEntry);
    if (buffer.length > MAX_BUFFER_SIZE) {
      buffer.splice(0, buffer.length - MAX_BUFFER_SIZE);
    }
    localStorage.setItem(LOG_BUFFER_KEY, JSON.stringify(buffer));
  } catch {
    // localStorage 不可用时静默降级
  }
}

/** 创建模块作用域的 logger */
export function createLogger(module: string) {
  const log = (level: LogLevel, message: string, context?: Record<string, unknown>, traceId?: string) => {
    writeLog({
      ts_ms: Date.now(),
      level,
      module,
      message,
      trace_id: traceId ?? generateTraceId(),
      context,
    });
  };

  return {
    debug: (msg: string, ctx?: Record<string, unknown>, traceId?: string) => log("debug", msg, ctx, traceId),
    info:  (msg: string, ctx?: Record<string, unknown>, traceId?: string) => log("info", msg, ctx, traceId),
    warn:  (msg: string, ctx?: Record<string, unknown>, traceId?: string) => log("warn", msg, ctx, traceId),
    error: (msg: string, ctx?: Record<string, unknown>, traceId?: string) => log("error", msg, ctx, traceId),
  };
}

/** 读取缓冲日志 */
export function getLogBuffer(): LogEntry[] {
  try {
    const raw = localStorage.getItem(LOG_BUFFER_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** 清空日志缓冲 */
export function clearLogBuffer(): void {
  try { localStorage.removeItem(LOG_BUFFER_KEY); } catch { /* noop */ }
}

/** 导出日志为文本 */
export function exportLogs(entries: LogEntry[]): string {
  return entries
    .map((e) => `[${new Date(e.ts_ms).toISOString()}] [${e.level.toUpperCase().padEnd(5)}] [${e.module}] ${e.message}${e.context ? " " + JSON.stringify(e.context) : ""}`)
    .join("\n");
}
