// ═══════════════════════════════════════════════════════════
// Skeleton Loading — route.md §50 显示异常防护
// Skeleton 优先于闪烁加载文本
// ═══════════════════════════════════════════════════════════

interface SkeletonProps {
  /** 行数 */
  lines?: number;
  /** 是否显示卡片容器 */
  card?: boolean;
  /** 自定义类名 */
  className?: string;
}

function SkeletonLine({ width }: { width: string }) {
  return (
    <div
      className="h-4 rounded-lg bg-white/[0.04] animate-pulse"
      style={{ width }}
    />
  );
}

export function SkeletonCard({ lines = 3 }: { lines?: number }) {
  const widths = ["75%", "100%", "60%", "90%", "45%"];
  return (
    <div className="glass-card-static p-5 space-y-3">
      <div className="h-5 w-1/3 rounded-lg bg-white/[0.06] animate-pulse" />
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonLine key={i} width={widths[i % widths.length]} />
      ))}
    </div>
  );
}

export function SkeletonList({ count = 4 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <div
          key={i}
          className="glass-card-static p-4 flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-full bg-white/[0.04] animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-2/5 rounded-lg bg-white/[0.06] animate-pulse" />
            <div className="h-3 w-3/5 rounded-lg bg-white/[0.04] animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function Skeleton({ lines = 3, card = true, className = "" }: SkeletonProps) {
  if (card) {
    return (
      <div className={className}>
        <SkeletonCard lines={lines} />
      </div>
    );
  }

  const widths = ["75%", "100%", "60%", "90%", "45%"];
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: lines }, (_, i) => (
        <SkeletonLine key={i} width={widths[i % widths.length]} />
      ))}
    </div>
  );
}

// §50 EmptyState: 统一使用 ../components/EmptyState.tsx，此处不再重复导出
