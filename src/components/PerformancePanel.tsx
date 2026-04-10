// ═══════════════════════════════════════════════════════════
// PerformancePanel — 性能监控面板组件
// 展示 FPS、内存、DOM 节点等实时指标
// ═══════════════════════════════════════════════════════════

import { memo } from "react";
import { Activity, Cpu, HardDrive, Timer } from "lucide-react";
import type { PerformanceMetrics } from "../hooks/usePerformanceMonitor";

interface PerformancePanelProps {
  metrics: PerformanceMetrics;
}

function fpsColor(fps: number): string {
  if (fps >= 55) return "text-emerald-400";
  if (fps >= 30) return "text-yellow-400";
  return "text-red-400";
}

function memoryColor(usage: number): string {
  if (usage < 0.6) return "text-emerald-400";
  if (usage < 0.8) return "text-yellow-400";
  return "text-red-400";
}

function MetricItem({ icon, label, value, color }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="flex items-center justify-between px-3.5 py-2.5 inner-panel rounded-xl">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-xs text-slate-500">{label}</span>
      </div>
      <span className={`text-sm font-mono font-medium ${color ?? "text-slate-300"}`}>{value}</span>
    </div>
  );
}

function PerformancePanel({ metrics }: PerformancePanelProps) {
  return (
    <div className="glass-card p-5 animate-fade-in-up">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
          <Activity size={16} className="text-cyan-400" />
        </div>
        <div>
          <h4 className="text-sm font-semibold">性能监控</h4>
          <span className="text-[10px] text-slate-600">Real-time Performance</span>
        </div>
      </div>
      <div className="space-y-2">
        <MetricItem
          icon={<Timer size={12} className="text-slate-500" />}
          label="FPS"
          value={`${metrics.fps}`}
          color={fpsColor(metrics.fps)}
        />
        <MetricItem
          icon={<Cpu size={12} className="text-slate-500" />}
          label="JS 堆内存"
          value={metrics.heapUsedMB > 0 ? `${metrics.heapUsedMB} / ${metrics.heapTotalMB} MB` : "N/A"}
          color={memoryColor(metrics.memoryUsage)}
        />
        <MetricItem
          icon={<HardDrive size={12} className="text-slate-500" />}
          label="DOM 节点"
          value={`${metrics.domNodeCount}`}
          color={metrics.domNodeCount > 3000 ? "text-yellow-400" : "text-emerald-400"}
        />
        <MetricItem
          icon={<Activity size={12} className="text-slate-500" />}
          label="长任务"
          value={`${metrics.longTaskCount}`}
          color={metrics.longTaskCount > 10 ? "text-yellow-400" : "text-emerald-400"}
        />
        {metrics.pageLoadTime > 0 && (
          <MetricItem
            icon={<Timer size={12} className="text-slate-500" />}
            label="页面加载"
            value={`${metrics.pageLoadTime} ms`}
            color={metrics.pageLoadTime > 3000 ? "text-red-400" : "text-emerald-400"}
          />
        )}

        {metrics.recentEvents.length > 0 && (
          <div className="mt-4 pt-3 border-t border-white/[0.05] animate-pulse-glow">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold">
                最新流程事件
              </span>
              <span className="text-[9px] text-slate-600 font-mono">
                {new Date(metrics.recentEvents[0].timestamp).toLocaleTimeString()}
              </span>
            </div>
            <div className="text-[11px] text-cyan-300 font-mono truncate bg-cyan-950/20 px-2 py-1.5 rounded-lg border border-cyan-500/20 flex items-center gap-2">
              <div className="w-1 h-1 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)]" />
              <span className="opacity-80">[{metrics.recentEvents[0].type}]</span>
              <span className="flex-1 truncate">
                {metrics.recentEvents[0].stepId || metrics.recentEvents[0].runId.slice(0, 8)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default memo(PerformancePanel);
