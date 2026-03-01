// ═══════════════════════════════════════════════════════════
// §71 Button Debounce & Idempotent Click Protection
// ═══════════════════════════════════════════════════════════

import { useCallback, useRef, useState } from "react";

/**
 * §71 防抖点击 hook: 防止关键按钮被重复点击
 * @param fn 异步操作函数
 * @param delayMs 防抖间隔（默认 300ms）
 */
export function useDebouncedAction<T extends unknown[]>(
  fn: (...args: T) => Promise<void>,
  delayMs = 300,
): [(...args: T) => Promise<void>, boolean] {
  const [loading, setLoading] = useState(false);
  const lastCallRef = useRef(0);

  const debouncedFn = useCallback(
    async (...args: T) => {
      const now = Date.now();
      if (now - lastCallRef.current < delayMs) return;
      if (loading) return;

      lastCallRef.current = now;
      setLoading(true);
      try {
        await fn(...args);
      } finally {
        setLoading(false);
      }
    },
    [fn, delayMs, loading],
  );

  return [debouncedFn, loading];
}
