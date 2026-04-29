// ═══════════════════════════════════════════════════════════
// 统一错误处理 — 所有 API 错误规范化接口与函数
// ═══════════════════════════════════════════════════════════

import type { ApiError } from "../types";

/**
 * 将任意错误标准化为 ApiError 结构
 * 用于 Tauri IPC invoke 调用异常捕获后的格式化
 */
export function normalizeError(error: unknown): ApiError {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    "message" in error &&
    "trace_id" in error
  ) {
    const e = error as Record<string, unknown>;
    return {
      code: String(e.code),
      message: String(e.message),
      details: e.details ? String(e.details) : undefined,
      trace_id: String(e.trace_id),
    };
  }

  return {
    code: "UNKNOWN_ERROR",
    message: "Unexpected command error",
    details: String(error),
    trace_id: "n/a",
  };
}