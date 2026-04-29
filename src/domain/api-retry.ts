// ═══════════════════════════════════════════════════════════
// API Retry/Backoff — 瞬态故障自动重试 + 指数退避
// 封装 invokeSafe，对可重试错误自动指数退避
// ═══════════════════════════════════════════════════════════

import { invoke } from "@tauri-apps/api/core";
import type { ApiError } from "../types";
import { normalizeError } from "./errors";

// ── 可重试错误码 (瞬态/竞争条件) ──
const RETRYABLE_CODES = new Set([
  "CLIPBOARD_BUSY",
  "CLIPBOARD_OPEN_FAILED",
  "CLIPBOARD_SET_FAILED",
  "ACTIVATE_FAILED",
  "WINDOW_NOT_FOREGROUND",
  "TIMEOUT",
  "IO_ERROR",
]);

export interface RetryOptions {
  /** 最大重试次数 (默认 3) */
  maxRetries?: number;
  /** 初始退避毫秒 (默认 300) */
  baseDelayMs?: number;
  /** 退避上限毫秒 (默认 5000) */
  maxDelayMs?: number;
  /** 整体超时毫秒 (默认 30000, 0=无限) */
  timeoutMs?: number;
  /** 自定义判断是否可重试 */
  isRetryable?: (error: ApiError) => boolean;
  /** 重试回调 (用于 UI 通知) */
  onRetry?: (attempt: number, error: ApiError, nextDelayMs: number) => void;
}

/**
 * 带指数退避的安全 Tauri IPC 调用。
 * 对 RETRYABLE_CODES 内的错误自动重试。
 */
export async function invokeWithRetry<T>(
  cmd: string,
  args?: Record<string, unknown>,
  options: RetryOptions = {},
): Promise<T> {
  const {
    maxRetries = 3,
    baseDelayMs = 300,
    maxDelayMs = 5000,
    timeoutMs = 30000,
    isRetryable,
    onRetry,
  } = options;

  const startTime = Date.now();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await invoke<T>(cmd, args);
    } catch (raw) {
      const error = normalizeError(raw);

      // 判断是否可重试
      const retryable = isRetryable
        ? isRetryable(error)
        : RETRYABLE_CODES.has(error.code);

      if (!retryable || attempt >= maxRetries) {
        throw error;
      }

      // 计算退避时间 (带 jitter)
      const exponential = baseDelayMs * Math.pow(2, attempt);
      const jitter = Math.random() * baseDelayMs * 0.5;
      const delay = Math.min(exponential + jitter, maxDelayMs);

      // 超时检查
      if (timeoutMs > 0 && Date.now() - startTime + delay > timeoutMs) {
        throw error;
      }

      onRetry?.(attempt + 1, error, delay);

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // TypeScript 类型安全 (不应到达)
  throw new Error("invokeWithRetry: unreachable");
}

/**
 * 包装常用操作 — 剪贴板操作（高频重试场景）
 */
export async function clipboardGetTextRetry(maxRetries = 3): Promise<string> {
  return invokeWithRetry<string>("os_clipboard_get_text", undefined, {
    maxRetries,
    baseDelayMs: 150,
    maxDelayMs: 2000,
  });
}

export async function clipboardSetTextRetry(text: string, maxRetries = 3): Promise<void> {
  return invokeWithRetry<void>("os_clipboard_set_text", { text }, {
    maxRetries,
    baseDelayMs: 150,
    maxDelayMs: 2000,
  });
}
