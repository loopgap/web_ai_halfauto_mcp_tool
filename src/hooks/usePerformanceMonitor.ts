// ═══════════════════════════════════════════════════════════
// usePerformanceMonitor — 性能统计 Hook
// 跟踪页面渲染性能、内存用量、长任务
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useRef, useCallback } from "react";

export interface PerformanceMetrics {
  /** 页面加载耗时 (ms) */
  pageLoadTime: number;
  /** JS 堆内存用量 (MB) */
  heapUsedMB: number;
  /** JS 堆内存上限 (MB) */
  heapTotalMB: number;
  /** 内存使用率 (0-1) */
  memoryUsage: number;
  /** 当前 FPS */
  fps: number;
  /** 长任务计数 (>50ms) */
  longTaskCount: number;
  /** DOM 节点数 */
  domNodeCount: number;
  /** 最后更新时间 */
  lastUpdate: number;
}

const INITIAL_METRICS: PerformanceMetrics = {
  pageLoadTime: 0,
  heapUsedMB: 0,
  heapTotalMB: 0,
  memoryUsage: 0,
  fps: 0,
  longTaskCount: 0,
  domNodeCount: 0,
  lastUpdate: 0,
};

/**
 * 性能监控 Hook
 * @param intervalMs 采样间隔 (默认 2000ms)
 * @param enabled 是否启用 (默认 true)
 */
export function usePerformanceMonitor(intervalMs: number = 2000, enabled: boolean = true): PerformanceMetrics {
  const [metrics, setMetrics] = useState<PerformanceMetrics>(INITIAL_METRICS);
  const frameCountRef = useRef(0);
  const lastFrameTimeRef = useRef(performance.now());
  const longTaskCountRef = useRef(0);
  const rafIdRef = useRef(0);

  // FPS 计数回调
  const countFrame = useCallback(() => {
    frameCountRef.current++;
    rafIdRef.current = requestAnimationFrame(countFrame);
  }, []);

  useEffect(() => {
    if (!enabled) return;

    // 启动 FPS 计数
    rafIdRef.current = requestAnimationFrame(countFrame);

    // 长任务观察器
    let longTaskObserver: PerformanceObserver | undefined;
    try {
      longTaskObserver = new PerformanceObserver((list) => {
        longTaskCountRef.current += list.getEntries().length;
      });
      longTaskObserver.observe({ type: "longtask", buffered: true });
    } catch {
      // PerformanceObserver for longtask not supported in all environments
    }

    // 定期采样
    const timer = setInterval(() => {
      const now = performance.now();
      const elapsed = (now - lastFrameTimeRef.current) / 1000;
      const fps = elapsed > 0 ? Math.round(frameCountRef.current / elapsed) : 0;
      frameCountRef.current = 0;
      lastFrameTimeRef.current = now;

      // 内存信息 (仅 Chromium)
      let heapUsedMB = 0;
      let heapTotalMB = 0;
      let memoryUsage = 0;
      const perf = performance as Performance & { memory?: { usedJSHeapSize: number; totalJSHeapSize: number } };
      if (perf.memory) {
        heapUsedMB = Math.round(perf.memory.usedJSHeapSize / 1048576 * 10) / 10;
        heapTotalMB = Math.round(perf.memory.totalJSHeapSize / 1048576 * 10) / 10;
        memoryUsage = heapTotalMB > 0 ? heapUsedMB / heapTotalMB : 0;
      }

      // 页面加载耗时
      const navEntries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
      const pageLoadTime = navEntries.length > 0
        ? Math.round(navEntries[0].loadEventEnd - navEntries[0].startTime)
        : 0;

      setMetrics({
        pageLoadTime,
        heapUsedMB,
        heapTotalMB,
        memoryUsage,
        fps,
        longTaskCount: longTaskCountRef.current,
        domNodeCount: document.querySelectorAll("*").length,
        lastUpdate: Date.now(),
      });
    }, intervalMs);

    return () => {
      clearInterval(timer);
      cancelAnimationFrame(rafIdRef.current);
      longTaskObserver?.disconnect();
    };
  }, [intervalMs, enabled, countFrame]);

  return metrics;
}
