import { useMemo, memo } from "react";
import { useAppState } from "../store/AppStore";
import { SkeletonCard, SkeletonList } from "../components/Skeleton";
import { TARGET_STATUS, RUN_STATUS } from "../domain/dictionary";
import { defaultRuntimeState, getSlmSummary } from "../domain/slm";
import { usePerformanceMonitor } from "../hooks/usePerformanceMonitor";
import PerformancePanel from "../components/PerformancePanel";
import { Zap, GitBranch, Monitor, CheckCircle, XCircle, Shield, Clock, Cpu, HeartPulse, BarChart3, TrendingUp, Activity } from "lucide-react";

export default function Dashboard() {
  const { skills, workflows, targets, health, runs, errorCatalog, initialized } = useAppState();

  // §100 性能优化: 缓存 SLM 计算结果，避免每次渲染重算
  const slmRuntime = useMemo(() => defaultRuntimeState(), []);
  const slmSummary = useMemo(() => getSlmSummary(slmRuntime), [slmRuntime]);
  const totalHealAttempts = 0;
  const feedbackCount = 0;
  const perfMetrics = usePerformanceMonitor(3000);

  if (!initialized) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }, (_, i) => <SkeletonCard key={i} lines={2} />)}
        </div>
        <SkeletonList count={3} />
      </div>
    );
  }

  const targetCount = useMemo(() => targets ? Object.keys(targets.targets).length : 0, [targets]);
  const readyCount = useMemo(() => health.filter((h) => h.status === "ready").length, [health]);
  const recentRuns = useMemo(() => runs.slice(0, 5), [runs]);
  const errorCategories = useMemo(() => [...new Set(errorCatalog.map(e => e.category))], [errorCatalog]);

  const statusColor = (status: string) => TARGET_STATUS[status]?.dot ?? "bg-slate-600";
  const statusLabel = (status: string) => TARGET_STATUS[status]?.label ?? status;

  return (
    <div className="p-8 space-y-8">
      {/* Page Header */}
      <div className="animate-fade-in-up">
        <h2 className="text-2xl font-bold text-gradient">Dashboard</h2>
        <p className="text-slate-500 text-sm mt-1">AI Workbench 系统总览</p>
      </div>

      {/* Stats Cards — gradient accents */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        <GradientStatCard
          icon={<Zap size={20} />}
          title="Skills"
          value={skills.length}
          subtitle="已注册技能"
          gradient="from-amber-500/20 to-orange-500/10"
          iconColor="text-amber-400"
          borderColor="border-amber-500/20"
          delay={0}
        />
        <GradientStatCard
          icon={<GitBranch size={20} />}
          title="Workflows"
          value={workflows.length}
          subtitle="工作流程"
          gradient="from-purple-500/20 to-violet-500/10"
          iconColor="text-purple-400"
          borderColor="border-purple-500/20"
          delay={1}
        />
        <GradientStatCard
          icon={<Monitor size={20} />}
          title="Targets"
          value={targetCount}
          subtitle="已注册目标"
          gradient="from-blue-500/20 to-indigo-500/10"
          iconColor="text-blue-400"
          borderColor="border-blue-500/20"
          delay={2}
        />
        <GradientStatCard
          icon={readyCount > 0 ? <CheckCircle size={20} /> : <XCircle size={20} />}
          title="在线窗口"
          value={`${readyCount}/${targetCount}`}
          subtitle="就绪 / 总计"
          gradient={readyCount > 0 ? "from-emerald-500/20 to-green-500/10" : "from-red-500/20 to-rose-500/10"}
          iconColor={readyCount > 0 ? "text-emerald-400" : "text-red-400"}
          borderColor={readyCount > 0 ? "border-emerald-500/20" : "border-red-500/20"}
          delay={3}
        />
      </div>

      {/* Engine Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* SLM Status */}
        <div className="glass-card p-5 animate-fade-in-up delay-150">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
              <Cpu size={16} className="text-orange-400" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">SLM 引擎</h4>
              <span className="text-[10px] text-slate-600">Local Inference</span>
            </div>
          </div>
          <div className="space-y-3">
            <MetricRow label="已加载模型" value={slmSummary.totalLoaded} />
            <MetricRow label="总推理次数" value={slmSummary.totalInferences} />
            <MetricRow label="CPU 安全模式" value={slmSummary.cpuSafeMode ? "启用" : "正常"} color={slmSummary.cpuSafeMode ? "text-yellow-400" : "text-emerald-400"} />
            <MetricRow label="平均延迟" value={`${slmSummary.avgLatencyMs.toFixed(0)} ms`} />
          </div>
        </div>

        {/* Self-Heal Status */}
        <div className="glass-card p-5 animate-fade-in-up delay-200">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-pink-500/15 flex items-center justify-center">
              <HeartPulse size={16} className="text-pink-400" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">自愈引擎</h4>
              <span className="text-[10px] text-slate-600">Self-Heal</span>
            </div>
          </div>
          <div className="space-y-3">
            <MetricRow label="自愈尝试" value={totalHealAttempts} />
            <MetricRow label="错误码目录" value={errorCatalog.length} />
            <MetricRow label="活跃设备" value={slmSummary.activeDevices.join(", ") || "无"} color="text-emerald-400" />
            <MetricRow label="状态" value="就绪" color="text-emerald-400" />
          </div>
        </div>

        {/* Feedback Stats */}
        <div className="glass-card p-5 animate-fade-in-up delay-300">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-8 h-8 rounded-lg bg-indigo-500/15 flex items-center justify-center">
              <BarChart3 size={16} className="text-indigo-400" />
            </div>
            <div>
              <h4 className="text-sm font-semibold">路由反馈</h4>
              <span className="text-[10px] text-slate-600">Feedback Loop</span>
            </div>
          </div>
          <div className="space-y-3">
            <MetricRow label="记录总数" value={feedbackCount} />
            <MetricRow label="运行总数" value={runs.length} />
            <MetricRow label="错误码分类" value={errorCategories.length} />
            <MetricRow label="状态" value="在线" color="text-emerald-400" />
          </div>
        </div>

        {/* Performance Monitor */}
        <PerformancePanel metrics={perfMetrics} />
      </div>

      {/* Health Status */}
      <div className="glass-card-static p-6 animate-fade-in-up">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <Activity size={16} className="text-emerald-400" />
          </div>
          <h3 className="text-base font-semibold">Target 健康状态</h3>
          <span className="badge badge-slate text-[10px]">{health.length} targets</span>
        </div>
        <div className="space-y-2">
          {health.length === 0 ? (
            <p className="text-slate-600 text-sm py-4 text-center">暂无 target 配置</p>
          ) : (
            health.map((h) => (
              <div
                key={h.target_id}
                className="flex items-center justify-between px-4 py-3 inner-panel rounded-xl transition-all hover:bg-white/[0.02]"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${statusColor(h.status)} ${h.status === 'ready' ? 'shadow-sm shadow-emerald-400/40' : ''}`} />
                  <span className="font-medium text-sm">{h.target_id}</span>
                  <span className="text-slate-600 text-xs">({h.provider})</span>
                  <span className={`badge text-[10px] ${
                    h.status === 'ready' ? 'badge-green' :
                    h.status === 'missing' ? 'badge-red' :
                    h.status === 'ambiguous' ? 'badge-yellow' : 'badge-orange'
                  }`}>
                    {statusLabel(h.status)}
                  </span>
                </div>
                <div className="text-xs">
                  {h.matched ? (
                    <span className="text-emerald-400">
                      <CheckCircle size={12} className="inline mr-1" />
                      {h.matched_title?.substring(0, 40)}
                    </span>
                  ) : (
                    <span className="text-red-400">
                      <XCircle size={12} className="inline mr-1" />
                      未找到窗口
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Skills Overview */}
      <div className="glass-card-static p-6 animate-fade-in-up">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center">
            <Zap size={16} className="text-amber-400" />
          </div>
          <h3 className="text-base font-semibold">已注册 Skills</h3>
          <span className="badge badge-slate text-[10px]">{skills.length} skills</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {skills.map((s) => (
            <div
              key={s.id}
              className="px-4 py-3.5 inner-panel rounded-xl transition-all hover:bg-white/[0.02] hover:border-indigo-500/20 group"
            >
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm group-hover:text-indigo-300 transition-colors">{s.title}</div>
                <span className="badge badge-slate text-[10px]">v{s.version}</span>
              </div>
              <div className="text-xs text-slate-600 mt-1 font-mono">{s.id}</div>
              <div className="flex gap-1.5 mt-2.5 flex-wrap">
                {s.dispatch?.prefer_providers?.map((p) => (
                  <span key={p} className="badge badge-blue text-[10px]">{p}</span>
                ))}
                <span className={`badge text-[10px] ${
                  s.safety_level === "safe" ? "badge-green"
                  : s.safety_level === "caution" ? "badge-yellow" : "badge-red"
                }`}>
                  <Shield size={8} /> {s.safety_level}
                </span>
                <span className="badge badge-slate text-[10px]">
                  <Clock size={8} /> {s.latency_class}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Runs */}
      {recentRuns.length > 0 && (
        <div className="glass-card-static p-6 animate-fade-in-up">
          <div className="flex items-center gap-2.5 mb-5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <TrendingUp size={16} className="text-blue-400" />
            </div>
            <h3 className="text-base font-semibold">最近运行</h3>
          </div>
          <div className="space-y-2">
            {recentRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between px-4 py-3 inner-panel rounded-xl text-sm"
              >
                <div className="flex items-center gap-3">
                  <div className={`w-2 h-2 rounded-full ${RUN_STATUS[run.status]?.dot ?? "bg-slate-400"}`} />
                  <span className="text-slate-200">{run.skill_id}</span>
                  <span className="text-slate-600">-&gt;</span>
                  <span className="text-indigo-300">{run.target_id}</span>
                  <span className={`badge text-[10px] ${
                    run.status === "completed" ? "badge-green" :
                    run.status === "error" ? "badge-red" : "badge-slate"
                  }`}>{RUN_STATUS[run.status]?.label ?? run.status}</span>
                </div>
                <span className="text-slate-600 text-xs font-mono">
                  {new Date(run.ts_start).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Catalog Summary */}
      {errorCatalog.length > 0 && (
        <div className="glass-card-static p-6 animate-fade-in-up">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
              <XCircle size={16} className="text-red-400" />
            </div>
            <div>
              <h3 className="text-base font-semibold">统一错误码</h3>
              <p className="text-xs text-slate-600">
                {errorCatalog.length} 个错误码 · {errorCategories.length} 个分类
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Gradient Stat Card (memo) ─── */
const GradientStatCard = memo(function GradientStatCard({
  icon, title, value, subtitle, gradient, iconColor, borderColor, delay,
}: {
  icon: React.ReactNode;
  title: string;
  value: number | string;
  subtitle: string;
  gradient: string;
  iconColor: string;
  borderColor: string;
  delay: number;
}) {
  return (
    <div className={`relative overflow-hidden rounded-2xl border ${borderColor} bg-gradient-to-br ${gradient} p-5 backdrop-blur-sm transition-all hover:scale-[1.02] hover:shadow-lg animate-fade-in-up`}
         style={{ animationDelay: `${delay * 80}ms` }}>
      <div className="absolute inset-0 bg-[#080d1a]/40" />
      <div className="relative">
        <div className="flex items-center gap-2.5 mb-3">
          <div className={`w-9 h-9 rounded-xl bg-white/[0.06] flex items-center justify-center ${iconColor}`}>
            {icon}
          </div>
          <span className="text-xs font-medium text-slate-400">{title}</span>
        </div>
        <div className="text-3xl font-bold tracking-tight">{value}</div>
        <div className="text-[11px] text-slate-500 mt-1">{subtitle}</div>
      </div>
    </div>
  );
});

/* ─── Metric Row (memo) ─── */
const MetricRow = memo(function MetricRow({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="flex justify-between items-center text-xs py-1">
      <span className="text-slate-500">{label}</span>
      <span className={color || "text-slate-300"}>{value}</span>
    </div>
  );
});
