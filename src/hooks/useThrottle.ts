// ═══════════════════════════════════════════════════════════
// useThrottle — 节流 Hook
// 限制高频事件（如滚动、resize）的处理频率
// ═══════════════════════════════════════════════════════════

import { useRef, useCallback, useEffect } from "react";

/**
 * 创建节流函数
 * @param fn 目标函数
 * @param delayMs 节流间隔 (ms)
 */
export function useThrottle<T extends (...args: unknown[]) => void>(
  fn: T,
  delayMs: number = 100
): T {
  const lastCallRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fnRef = useRef<T>(fn);
  fnRef.current = fn;

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return useCallback((...args: Parameters<T>) => {
    const now = Date.now();
    const remaining = delayMs - (now - lastCallRef.current);
    if (remaining <= 0) {
      lastCallRef.current = now;
      fnRef.current(...args);
    } else {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        lastCallRef.current = Date.now();
        fnRef.current(...args);
      }, remaining);
    }
  }, [delayMs]) as T;
}
