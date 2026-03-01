// ═══════════════════════════════════════════════════════════
// §3 Virtual Scrolling Hook — 大列表虚拟滚动
// 前端性能标准: 大列表必须虚拟滚动
// ═══════════════════════════════════════════════════════════

import { useState, useRef, useCallback, useMemo } from "react";

export interface VirtualScrollOptions {
  /** 列表总项数 */
  itemCount: number;
  /** 单项高度 px */
  itemHeight: number;
  /** 容器高度 px */
  containerHeight: number;
  /** 缓冲区额外渲染行数 (上下各) */
  overscan?: number;
}

export interface VirtualScrollResult {
  /** 当前可见范围内要渲染的项索引 */
  visibleRange: { start: number; end: number };
  /** 容器总高度 (用于滚动条) */
  totalHeight: number;
  /** 已见区域顶部偏移 (用于 transform) */
  offsetTop: number;
  /** 绑定到容器的 ref */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /** 滚动事件处理 */
  onScroll: (e: React.UIEvent<HTMLDivElement>) => void;
  /** 滚动到指定索引 */
  scrollToIndex: (index: number) => void;
}

/**
 * §3 虚拟滚动 Hook — 只渲染可见行
 *
 * @example
 * ```tsx
 * const { visibleRange, totalHeight, offsetTop, containerRef, onScroll } = useVirtualScroll({
 *   itemCount: runs.length,
 *   itemHeight: 64,
 *   containerHeight: 600,
 * });
 *
 * <div ref={containerRef} onScroll={onScroll} style={{ height: 600, overflow: 'auto' }}>
 *   <div style={{ height: totalHeight, position: 'relative' }}>
 *     <div style={{ transform: `translateY(${offsetTop}px)` }}>
 *       {runs.slice(visibleRange.start, visibleRange.end).map(run => <RunItem key={run.id} />)}
 *     </div>
 *   </div>
 * </div>
 * ```
 */
export function useVirtualScroll(options: VirtualScrollOptions): VirtualScrollResult {
  const { itemCount, itemHeight, containerHeight, overscan = 5 } = options;
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const totalHeight = itemCount * itemHeight;

  const visibleRange = useMemo(() => {
    const start = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const visibleCount = Math.ceil(containerHeight / itemHeight);
    const end = Math.min(itemCount, start + visibleCount + overscan * 2);
    return { start, end };
  }, [scrollTop, itemHeight, containerHeight, itemCount, overscan]);

  const offsetTop = visibleRange.start * itemHeight;

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  }, []);

  const scrollToIndex = useCallback(
    (index: number) => {
      const el = containerRef.current;
      if (el) {
        el.scrollTop = index * itemHeight;
      }
    },
    [itemHeight],
  );

  return {
    visibleRange,
    totalHeight,
    offsetTop,
    containerRef,
    onScroll,
    scrollToIndex,
  };
}
