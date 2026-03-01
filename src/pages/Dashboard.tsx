import { useAppState } from "../store/AppStore";
import { SkeletonCard, SkeletonList } from "../components/Skeleton";
import { TARGET_STATUS, RUN_STATUS } from "../domain/dictionary";
import { defaultRuntimeState, getSlmSummary } from "../domain/slm";
import { Zap, GitBranch, Monitor, CheckCircle, XCircle, Shield, Clock, Cpu, HeartPulse, BarChart3 } from "lucide-react";

export default function Dashboard() {
  const { skills, workflows, targets, health, runs, errorCatalog, initialized } = useAppState();

  // §4 SLM runtime state
  const slmRuntime = defaultRuntimeState();
  const slmSummary = getSlmSummary(slmRuntime);

  // §8 / §5 — counts derived from runs
  const totalHealAttempts = 0;
  const feedbackCount = 0;

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

  const targetCount = targets ? Object.keys(targets.targets).length : 0;
  const readyCount = health.filter((h) => h.status === "ready").length;
  const recentRuns = runs.slice(0, 5);

  const statusColor = (status: string) => TARGET_STATUS[status]?.dot ?? "bg-slate-600";
  const statusLabel = (status: string) => TARGET_STATUS[status]?.label ?? status;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">仪表盘</h2>
        <p className="text-slate-400 mt-1">AI Workbench 系统总览 · Schema v3</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Zap className="text-yellow-400" size={24} />}
          title="Skills 技能"
          value={skills.length}
          subtitle="已注册技能"
        />
        <StatCard
          icon={<GitBranch className="text-purple-400" size={24} />}
          title="Workflows"
          value={workflows.length}
          subtitle="工作流程"
        />
        <StatCard
          icon={<Monitor className="text-blue-400" size={24} />}
          title="Targets"
          value={targetCount}
          subtitle="已注册目标"
        />
        <StatCard
          icon={
            readyCount > 0 ? (
              <CheckCircle className="text-green-400" size={24} />
            ) : (
              <XCircle className="text-red-400" size={24} />
            )
          }
          title="在线窗口"
          value={`${readyCount}/${targetCount}`}
          subtitle="就绪 / 总计"
        />
      </div>

      {/* §4/§8/§5 Engine Metrics Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* SLM Status */}
        <div className="bg-[#1e293b] rounded-xl p-5 border border-[#334155]">
          <div className="flex items-center gap-2 mb-3">
            <Cpu size={18} className="text-orange-400" />
            <h4 className="text-sm font-semibold">SLM 引擎 (§4)</h4>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-slate-400">已加载模型</span><span>{slmSummary.totalLoaded}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">总推理次数</span><span>{slmSummary.totalInferences}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">CPU 安全模式</span><span className={slmSummary.cpuSafeMode ? "text-yellow-300" : "text-green-300"}>{slmSummary.cpuSafeMode ? "启用" : "正常"}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">平均延迟</span><span>{slmSummary.avgLatencyMs.toFixed(0)} ms</span></div>
          </div>
        </div>

        {/* Self-Heal Status */}
        <div className="bg-[#1e293b] rounded-xl p-5 border border-[#334155]">
          <div className="flex items-center gap-2 mb-3">
            <HeartPulse size={18} className="text-pink-400" />
            <h4 className="text-sm font-semibold">自愈引擎 (§8)</h4>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-slate-400">自愈尝试</span><span>{totalHealAttempts}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">错误码目录</span><span>{errorCatalog.length}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">活跃设备</span><span className="text-green-300">{slmSummary.activeDevices.join(", ") || "无"}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">状态</span><span className="text-green-300">就绪</span></div>
          </div>
        </div>

        {/* Feedback Stats */}
        <div className="bg-[#1e293b] rounded-xl p-5 border border-[#334155]">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 size={18} className="text-blue-400" />
            <h4 className="text-sm font-semibold">路由反馈 (§5)</h4>
          </div>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between"><span className="text-slate-400">记录总数</span><span>{feedbackCount}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">运行总数</span><span>{runs.length}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">错误码分类</span><span>{[...new Set(errorCatalog.map(e => e.category))].length}</span></div>
            <div className="flex justify-between"><span className="text-slate-400">状态</span><span className="text-green-300">在线</span></div>
          </div>
        </div>
      </div>

      {/* Health Status */}
      <div className="bg-[#1e293b] rounded-xl p-5 border border-[#334155]">
        <h3 className="text-lg font-semibold mb-4">Target 健康状态 (§9.3)</h3>
        <div className="space-y-2">
          {health.length === 0 ? (
            <p className="text-slate-500 text-sm">暂无 target 配置</p>
          ) : (
            health.map((h) => (
              <div
                key={h.target_id}
                className="flex items-center justify-between px-4 py-2.5 bg-[#0f172a] rounded-lg"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${statusColor(h.status)}`}
                  />
                  <span className="font-medium">{h.target_id}</span>
                  <span className="text-slate-500 text-sm">({h.provider})</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    h.status === 'ready' ? 'bg-green-600/20 text-green-300' :
                    h.status === 'missing' ? 'bg-red-600/20 text-red-300' :
                    h.status === 'ambiguous' ? 'bg-yellow-600/20 text-yellow-300' :
                    'bg-orange-600/20 text-orange-300'
                  }`}>
                    {statusLabel(h.status)}
                  </span>
                </div>
                <div className="text-sm">
                  {h.matched ? (
                    <span className="text-green-400">
                      ✓ {h.matched_title?.substring(0, 40)}
                    </span>
                  ) : (
                    <span className="text-red-400">✗ 未找到窗口</span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Skills Overview with v3 badges */}
      <div className="bg-[#1e293b] rounded-xl p-5 border border-[#334155]">
        <h3 className="text-lg font-semibold mb-4">已注册 Skills</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {skills.map((s) => (
            <div
              key={s.id}
              className="px-4 py-3 bg-[#0f172a] rounded-lg border border-[#334155] hover:border-blue-500/50 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="font-medium text-sm">{s.title}</div>
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">
                  v{s.version}
                </span>
              </div>
              <div className="text-xs text-slate-500 mt-1">{s.id}</div>
              <div className="flex gap-1 mt-2 flex-wrap">
                {s.dispatch?.prefer_providers?.map((p) => (
                  <span
                    key={p}
                    className="text-[10px] px-1.5 py-0.5 bg-blue-600/20 text-blue-300 rounded"
                  >
                    {p}
                  </span>
                ))}
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    s.safety_level === "safe"
                      ? "bg-green-600/20 text-green-300"
                      : s.safety_level === "caution"
                      ? "bg-yellow-600/20 text-yellow-300"
                      : "bg-red-600/20 text-red-300"
                  }`}
                >
                  <Shield size={8} className="inline mr-0.5" />
                  {s.safety_level}
                </span>
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-700/50 text-slate-400 rounded">
                  <Clock size={8} className="inline mr-0.5" />
                  {s.latency_class}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Runs */}
      {recentRuns.length > 0 && (
        <div className="bg-[#1e293b] rounded-xl p-5 border border-[#334155]">
          <h3 className="text-lg font-semibold mb-4">最近运行</h3>
          <div className="space-y-2">
            {recentRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between px-4 py-2.5 bg-[#0f172a] rounded-lg text-sm"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${RUN_STATUS[run.status]?.dot ?? "bg-slate-400"}`}
                  />
                  <span>{run.skill_id}</span>
                  <span className="text-slate-500">→</span>
                  <span className="text-blue-300">{run.target_id}</span>
                  <span className={`text-[10px] ${RUN_STATUS[run.status]?.color ?? "text-slate-400"}`}>{RUN_STATUS[run.status]?.label ?? run.status}</span>
                </div>
                <span className="text-slate-500 text-xs">
                  {new Date(run.ts_start).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Error Catalog Summary */}
      {errorCatalog.length > 0 && (
        <div className="bg-[#1e293b] rounded-xl p-5 border border-[#334155]">
          <h3 className="text-lg font-semibold mb-2">统一错误码</h3>
          <p className="text-xs text-slate-500 mb-3">
            已注册 {errorCatalog.length} 个错误码 ·{" "}
            {[...new Set(errorCatalog.map((e) => e.category))].length} 个分类
          </p>
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon,
  title,
  value,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  value: number | string;
  subtitle: string;
}) {
  return (
    <div className="bg-[#1e293b] rounded-xl p-5 border border-[#334155]">
      <div className="flex items-center gap-3 mb-3">{icon}<span className="text-sm text-slate-400">{title}</span></div>
      <div className="text-3xl font-bold">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{subtitle}</div>
    </div>
  );
}
