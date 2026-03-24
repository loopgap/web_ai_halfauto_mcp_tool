import { useState, useEffect, useRef, useMemo } from "react";
import { useAppState } from "../store/AppStore";
import { getSelfHealRegistry, governanceEmitTelemetry, governanceLatest, governanceValidate } from "../api";
import { getVaultStats, cleanupVault } from "../api";
import type { VaultStats } from "../api";
import { SkeletonList } from "../components/Skeleton";
import type { GovernanceValidationReport, SelfHealAction } from "../types";
import { defaultRuntimeState, getSlmSummary, recommendedModels, type SlmRole } from "../domain/slm";
import { computeIntentStats } from "../domain/feedback-learning";
import { exportConfigBundle, serializeBundle, downloadAsFile, validateConfigBundle, readFileAsText, exportRunsToMarkdown } from "../domain/config-export";
import FocusRecipeEditor from "../components/FocusRecipeEditor";
import { Settings as SettingsIcon, Route, Cpu, AlertTriangle, ChevronDown, ChevronRight, HeartPulse, BarChart3, Focus, Download, Upload, FileText, Database, Trash2, Stethoscope, ClipboardCopy } from "lucide-react";
import { runHealthCheck, exportDiagnosticBundle, type HealthReport } from "../domain/health-check";

export default function SettingsPage() {
  const { routerRules, errorCatalog, initialized, stateHistory, governanceChanges, skills, workflows, targets, runs } = useAppState();
  const [showErrors, setShowErrors] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSelfHeal, setShowSelfHeal] = useState(false);
  const [showSlm, setShowSlm] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showFocusRecipe, setShowFocusRecipe] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [focusRecipe, setFocusRecipe] = useState<string[]>([]);
  const [selfHealActions, setSelfHealActions] = useState<SelfHealAction[]>([]);
  const [governanceLoading, setGovernanceLoading] = useState(false);
  const [governanceMsg, setGovernanceMsg] = useState("");
  const [latestReport, setLatestReport] = useState<GovernanceValidationReport | null>(null);
  const [importMsg, setImportMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [vaultStats, setVaultStats] = useState<VaultStats | null>(null);
  const [vaultLoading, setVaultLoading] = useState(false);
  const [vaultMsg, setVaultMsg] = useState("");
  const [showVault, setShowVault] = useState(false);
  const [showDiag, setShowDiag] = useState(false);
  const [diagReport, setDiagReport] = useState<HealthReport | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagCopied, setDiagCopied] = useState(false);

  // §4 SLM — 缓存计算结果
  const slmRuntime = useMemo(() => defaultRuntimeState(), []);
  const slmSummary = useMemo(() => getSlmSummary(slmRuntime), [slmRuntime]);
  const slmModels = useMemo(() => recommendedModels(), []);

  // §5 Feedback — 缓存统计
  const feedbackStats = useMemo(() => computeIntentStats([]), []);

  useEffect(() => {
    getSelfHealRegistry().then(setSelfHealActions).catch((e) => console.error('[SettingsPage] getSelfHealRegistry failed:', e));
  }, []);

  const latestChangeId = governanceChanges[0]?.change_id;

  async function handleGovernanceValidate() {
    setGovernanceLoading(true);
    setGovernanceMsg("");
    try {
      const report = await governanceValidate(latestChangeId);
      setLatestReport(report);
      setGovernanceMsg(`治理校验完成: ${report.change_id} / ${report.decision} / score=${report.score_total}`);
    } catch (e) {
      setGovernanceMsg(`治理校验失败: ${(e as Error).message}`);
    } finally {
      setGovernanceLoading(false);
    }
  }

  async function handleEmitTelemetry() {
    setGovernanceLoading(true);
    setGovernanceMsg("");
    try {
      await governanceEmitTelemetry({
        ts_ms: Date.now(),
        project: "ai-workbench",
        module: "settings",
        feature: "governance",
        code: "MANUAL_TELEMETRY_PING",
        severity: "info",
        change_id: latestChangeId,
        detail: "manual telemetry ping from Settings page",
      });
      setGovernanceMsg("遥测事件已写入审计日志");
    } catch (e) {
      setGovernanceMsg(`遥测写入失败: ${(e as Error).message}`);
    } finally {
      setGovernanceLoading(false);
    }
  }

  async function handleLoadGovernanceSnapshot() {
    setGovernanceLoading(true);
    setGovernanceMsg("");
    try {
      const snapshot = await governanceLatest(latestChangeId);
      if (!snapshot) {
        setGovernanceMsg("当前没有可用的治理快照");
      } else {
        setGovernanceMsg(`已加载治理快照: ${snapshot.change.change_id} / ${snapshot.decision.decision}`);
      }
    } catch (e) {
      setGovernanceMsg(`读取治理快照失败: ${(e as Error).message}`);
    } finally {
      setGovernanceLoading(false);
    }
  }

  function handleExportConfig() {
    const bundle = exportConfigBundle(targets, skills, workflows, routerRules);
    const json = serializeBundle(bundle);
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    downloadAsFile(json, `ai-workbench-config-${ts}.json`);
    setImportMsg("配置已导出");
  }

  function handleExportRuns() {
    const md = exportRunsToMarkdown(runs);
    const ts = new Date().toISOString().replace(/[:.]/g, "-");
    downloadAsFile(md, `ai-workbench-runs-${ts}.md`, "text/markdown");
    setImportMsg(`已导出 ${runs.length} 条 Run 记录`);
  }

  async function handleImportConfig(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      const data = JSON.parse(text) as unknown;
      const { valid, errors } = validateConfigBundle(data);
      if (!valid) {
        setImportMsg(`❌ 导入失败: ${errors.join(", ")}`);
      } else {
        setImportMsg("✅ 文件格式验证通过。请在 Targets / Skills / Workflows 页面应用导入配置（当前为只读预览）。");
      }
    } catch (err) {
      setImportMsg(`❌ 解析失败: ${(err as Error).message}`);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  async function handleRunDiagnostics() {
    setDiagLoading(true);
    try {
      const report = await runHealthCheck();
      setDiagReport(report);
    } catch {
      // health check itself should not fail
    } finally {
      setDiagLoading(false);
    }
  }

  function handleCopyDiagBundle() {
    if (!diagReport) return;
    const text = exportDiagnosticBundle(diagReport);
    navigator.clipboard.writeText(text).then(() => {
      setDiagCopied(true);
      setTimeout(() => setDiagCopied(false), 2000);
    });
  }

  async function handleLoadVaultStats() {
    setVaultLoading(true);
    setVaultMsg("");
    try {
      const stats = await getVaultStats();
      setVaultStats(stats);
    } catch (e) {
      setVaultMsg(`获取统计失败: ${(e as Error).message}`);
    } finally {
      setVaultLoading(false);
    }
  }

  async function handleCleanupVault(days: number) {
    setVaultLoading(true);
    setVaultMsg("");
    try {
      const deleted = await cleanupVault(days);
      setVaultMsg(`已清理 ${deleted} 条超过 ${days} 天的记录`);
      await handleLoadVaultStats();
    } catch (e) {
      setVaultMsg(`清理失败: ${(e as Error).message}`);
    } finally {
      setVaultLoading(false);
    }
  }

  if (!initialized) {
    return <div className="p-6"><SkeletonList count={4} /></div>;
  }

  // Group error catalog by category
  const errorsByCategory: Record<string, typeof errorCatalog> = {};
  for (const e of errorCatalog) {
    if (!errorsByCategory[e.category]) errorsByCategory[e.category] = [];
    errorsByCategory[e.category].push(e);
  }

  return (
    <div className="p-8 space-y-6">
      <div className="animate-fade-in-up">
        <h2 className="text-2xl font-bold text-gradient">Settings</h2>
        <p className="text-slate-500 text-sm mt-1">系统配置、路由规则、错误码目录</p>
      </div>

      {/* Router Rules */}
      <div className="glass-card-static p-5">
        <h3 className="text-lg font-semibold mb-4">治理闭环（v2）</h3>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn-primary disabled:opacity-50"
            onClick={handleGovernanceValidate}
            disabled={governanceLoading}
          >
            运行治理校验
          </button>
          <button
            className="btn-secondary disabled:opacity-50"
            onClick={handleLoadGovernanceSnapshot}
            disabled={governanceLoading}
          >
            加载治理快照
          </button>
          <button
            className="px-4 py-2 text-sm rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-medium transition-all shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            onClick={handleEmitTelemetry}
            disabled={governanceLoading}
          >
            发送遥测事件
          </button>
        </div>
        <div className="mt-3 text-xs text-slate-400">
          最新 change_id: {latestChangeId ?? "N/A"}
        </div>
        {latestReport && (
          <div className="mt-2 text-xs text-slate-300">
            decision={latestReport.decision}, score={latestReport.score_total}, passed={latestReport.passed ? "yes" : "no"}
          </div>
        )}
        {governanceMsg && <div className="mt-2 text-xs text-indigo-300">{governanceMsg}</div>}
      </div>

      {/* Router Rules */}
      <div className="glass-card-static p-5">
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <Route size={16} className="text-emerald-400" />
          </div>
          Meta Router 路由规则 v2
        </h3>
        <p className="text-sm text-slate-400 mb-4">
          基于关键词 + 正则模式 + 置信度评分自动选择模型/Provider
        </p>

        {routerRules && (
          <div className="space-y-3">
            {Object.entries(routerRules.intents).map(([intent, rule]) => (
              <div
                key={intent}
                className="inner-panel rounded-xl p-4"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-indigo-300 capitalize">
                    {intent}
                  </span>
                  <div className="flex gap-1">
                    {rule.fanout && (
                      <span className="badge badge-yellow text-[10px]">Fanout 并行</span>
                    )}
                    <span className="badge badge-green text-[10px]">
                      +{(rule.confidence_boost * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
                <div className="text-xs text-slate-400 space-y-2">
                  <div>
                    <span className="text-slate-500">关键词: </span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {rule.keywords.map((k) => (
                        <span
                          key={k}
                          className="badge badge-slate text-[10px]"
                        >
                          {k}
                        </span>
                      ))}
                    </div>
                  </div>
                  {rule.patterns.length > 0 && (
                    <div>
                      <span className="text-slate-500">正则: </span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {rule.patterns.map((p) => (
                          <span
                            key={p}
                            className="badge badge-purple text-[10px] font-mono"
                          >
                            {p}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <span className="text-slate-500">优先 Provider: </span>
                    {rule.dispatch_prefer.join(" → ")}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confidence Thresholds */}
      <div className="glass-card-static p-5">
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-500/15 flex items-center justify-center">
            <SettingsIcon size={16} className="text-slate-400" />
          </div>
          安全默认值 & 阈值
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between px-4 py-3.5 inner-panel rounded-xl">
            <div>
              <div className="text-sm font-medium">auto_enter</div>
              <div className="text-xs text-slate-600">
                默认关闭，避免误发到 AI 网页端
              </div>
            </div>
            <span className="badge badge-green text-[10px]">
              {routerRules?.defaults?.auto_enter ? "开启" : "关闭"}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5 inner-panel rounded-xl">
            <div>
              <div className="text-sm font-medium">fanout 并行</div>
              <div className="text-xs text-slate-600">
                默认关闭，需要时手动在 workflow 中开启
              </div>
            </div>
            <span className="badge badge-green text-[10px]">
              {routerRules?.defaults?.fanout ? "开启" : "关闭"}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5 inner-panel rounded-xl">
            <div>
              <div className="text-sm font-medium">自动执行阈值</div>
              <div className="text-xs text-slate-600">
                置信度 ≥ 此值时自动选择路由
              </div>
            </div>
            <span className="badge badge-indigo text-[10px]">
              {((routerRules?.defaults?.confidence_auto_threshold ?? 0.8) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5 inner-panel rounded-xl">
            <div>
              <div className="text-sm font-medium">确认阈值</div>
              <div className="text-xs text-slate-600">
                置信度在 [确认阈值, 自动阈值) 范围内需用户确认
              </div>
            </div>
            <span className="badge badge-yellow text-[10px]">
              {((routerRules?.defaults?.confidence_confirm_threshold ?? 0.6) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5 inner-panel rounded-xl">
            <div>
              <div className="text-sm font-medium">DOM 注入</div>
              <div className="text-xs text-slate-600">
                不注入网页、不读 cookie、不做 iframe
              </div>
            </div>
            <span className="badge badge-red text-[10px]">
              禁用
            </span>
          </div>
        </div>
      </div>

      {/* NPU / Meta Router Status */}
      <div className="glass-card-static p-5">
        <h3 className="text-base font-semibold mb-4 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
            <Cpu size={16} className="text-orange-400" />
          </div>
          NPU / 小模型路由状态
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between px-4 py-3.5 inner-panel rounded-xl">
            <div>
              <div className="text-sm font-medium">规则路由 v2</div>
              <div className="text-xs text-slate-600">
                关键词 + 正则 + 置信度打分，零成本
              </div>
            </div>
            <span className="badge badge-green text-[10px]">
              已启用
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5 inner-panel rounded-xl">
            <div>
              <div className="text-sm font-medium">Router 小模型 (1.5B)</div>
              <div className="text-xs text-slate-600">
                规则不确定时调用，CPU/NPU 推理
              </div>
            </div>
            <span className="badge badge-yellow text-[10px]">
              待配置
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3.5 inner-panel rounded-xl">
            <div>
              <div className="text-sm font-medium">Coder 小模型 (3B)</div>
              <div className="text-xs text-slate-600">
                按需启用，生成代码时使用
              </div>
            </div>
            <span className="badge badge-slate text-[10px]">
              未启用
            </span>
          </div>
        </div>
      </div>

      {/* Unified Error Catalog (§9) */}
      <div className="glass-card-static p-5">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setShowErrors(!showErrors)}
        >
          <h3 className="text-base font-semibold flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-red-500/15 flex items-center justify-center">
              <AlertTriangle size={16} className="text-red-400" />
            </div>
            统一错误码目录 ({errorCatalog.length} 条)
          </h3>
          {showErrors ? (
            <ChevronDown size={18} className="text-slate-400" />
          ) : (
            <ChevronRight size={18} className="text-slate-400" />
          )}
        </button>

        {showErrors && (
          <div className="mt-4 space-y-4">
            {Object.entries(errorsByCategory).map(([cat, errors]) => (
              <div key={cat}>
                <h4 className="text-sm font-semibold text-slate-300 mb-2 uppercase">
                  {cat}
                </h4>
                <div className="space-y-1">
                  {errors.map((e) => (
                    <div
                      key={e.code}
                      className="px-3.5 py-2.5 inner-panel rounded-xl text-xs flex items-start justify-between gap-4"
                    >
                      <div className="flex-1">
                        <span className="font-mono text-red-300">{e.code}</span>
                        <span className="text-slate-400 ml-2">{e.user_message}</span>
                        <div className="text-slate-600 mt-0.5">
                          💡 {e.fix_suggestion}
                        </div>
                      </div>
                      <span
                        className={`badge text-[10px] ${
                          e.alert_level === "error" ? "badge-red"
                          : e.alert_level === "warn" ? "badge-yellow" : "badge-indigo"
                        }`}
                      >
                        {e.alert_level}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Self-Heal Registry (§8) */}
      <div className="glass-card-static p-5">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setShowSelfHeal(!showSelfHeal)}
        >
          <h3 className="text-base font-semibold flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-pink-500/15 flex items-center justify-center">
              <HeartPulse size={16} className="text-pink-400" />
            </div>
            自愈策略注册表 ({selfHealActions.length} 条)
          </h3>
          {showSelfHeal ? (
            <ChevronDown size={18} className="text-slate-400" />
          ) : (
            <ChevronRight size={18} className="text-slate-400" />
          )}
        </button>

        {showSelfHeal && selfHealActions.length > 0 && (
          <div className="mt-4 space-y-2">
            {selfHealActions.map((a) => (
              <div
                key={a.strategy_id}
                className="px-4 py-3.5 inner-panel rounded-xl"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-pink-300 text-sm">
                    {a.strategy_id}
                  </span>
                  <div className="flex gap-2">
                    <span className="badge badge-purple text-[10px]">{a.action_type}</span>
                    <span className="badge badge-slate text-[10px]">max:{a.max_attempts}</span>
                    <span className="badge badge-indigo text-[10px]">cooldown:{a.cooldown_ms}ms</span>
                  </div>
                </div>
                <div className="text-xs text-slate-400">{a.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* §4 SLM Configuration Panel */}
      <div className="glass-card-static p-5">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setShowSlm(!showSlm)}
        >
          <h3 className="text-base font-semibold flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
              <Cpu size={16} className="text-orange-400" />
            </div>
            SLM 本地模型配置 (§4)
          </h3>
          {showSlm ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
        </button>

        {showSlm && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="px-4 py-3.5 inner-panel rounded-xl">
                <div className="text-xs text-slate-500">已加载模型</div>
                <div className="text-sm font-medium text-orange-300">{slmSummary.totalLoaded}</div>
              </div>
              <div className="px-4 py-3.5 inner-panel rounded-xl">
                <div className="text-xs text-slate-500">CPU安全模式</div>
                <div className={`text-sm font-medium ${slmSummary.cpuSafeMode ? "text-yellow-300" : "text-green-300"}`}>{slmSummary.cpuSafeMode ? "已启用" : "正常"}</div>
              </div>
              <div className="px-4 py-3.5 inner-panel rounded-xl">
                <div className="text-xs text-slate-500">总推理</div>
                <div className="text-sm font-medium">{slmSummary.totalInferences} 次</div>
              </div>
              <div className="px-4 py-3.5 inner-panel rounded-xl">
                <div className="text-xs text-slate-500">平均延迟</div>
                <div className="text-sm font-medium">{slmSummary.avgLatencyMs.toFixed(0)} ms</div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-2">推荐模型</h4>
              <div className="space-y-1">
                {(Object.entries(slmModels) as [SlmRole, { paramSize: string; quant: string; preferDevice: string }][]).map(([role, m]) => (
                  <div key={role} className="flex items-center justify-between px-3.5 py-2.5 inner-panel rounded-xl text-xs">
                    <div>
                      <span className="text-indigo-300 font-mono">{role}</span>
                      <span className="text-slate-500 ml-2">{m.paramSize}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="badge badge-slate text-[10px]">{m.quant}</span>
                      <span className="badge badge-orange text-[10px]">{m.preferDevice}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* §5 Feedback Learning Panel */}
      <div className="glass-card-static p-5">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setShowFeedback(!showFeedback)}
        >
          <h3 className="text-base font-semibold flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
              <BarChart3 size={16} className="text-blue-400" />
            </div>
            路由反馈学习 (§5)
          </h3>
          {showFeedback ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
        </button>

        {showFeedback && (
          <div className="mt-4 space-y-3">
            {feedbackStats.length === 0 ? (
              <p className="text-sm text-slate-500">暂无反馈数据。当用户纠正路由选择后，反馈记录将自动收集并进行自适应权重调整。</p>
            ) : (
              feedbackStats.map((s) => (
                <div key={s.intent} className="px-4 py-3.5 inner-panel rounded-xl">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-indigo-300 font-medium text-sm">{s.intent}</span>
                    <span className="badge badge-slate text-[10px]">总计: {s.total}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    接受: {s.accepted} · 拒绝: {s.rejected} · 改选: {s.overridden} · 接受率: {(s.acceptRate * 100).toFixed(1)}%
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* §9.7 Focus Recipe Editor */}
      <div className="glass-card-static p-5">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setShowFocusRecipe(!showFocusRecipe)}
        >
          <h3 className="text-base font-semibold flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/15 flex items-center justify-center">
              <Focus size={16} className="text-cyan-400" />
            </div>
            Focus Recipe 编辑器 (§9.7)
          </h3>
          {showFocusRecipe ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
        </button>

        {showFocusRecipe && (
          <div className="mt-4">
            <FocusRecipeEditor recipe={focusRecipe} onChange={setFocusRecipe} onTest={(recipe) => console.log("[FocusRecipe] test:", recipe)} />
          </div>
        )}
      </div>

      {/* §8 Self-Heal Engine Panel */}
      <div className="glass-card-static p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-pink-500/15 flex items-center justify-center">
              <HeartPulse size={16} className="text-pink-400" />
            </div>
            <span className="text-sm font-semibold">自愈引擎状态</span>
          </div>
          <div className="flex gap-2 text-[10px]">
            <span className="badge badge-green">策略: {selfHealActions.length}</span>
            <span className="badge badge-blue">状态: 就绪</span>
          </div>
        </div>
      </div>

      {/* 配置导出/导入 */}
      <div className="glass-card-static p-5">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setShowExport(!showExport)}
        >
          <h3 className="text-base font-semibold flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-teal-500/15 flex items-center justify-center">
              <Download size={16} className="text-teal-400" />
            </div>
            配置备份 & 导出
          </h3>
          {showExport ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
        </button>
        {showExport && (
          <div className="mt-4 space-y-3">
            <p className="text-xs text-slate-500">将当前 targets、skills、workflows、router_rules 导出为 JSON，或将 Run 记录导出为 Markdown。</p>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary text-sm" onClick={handleExportConfig}>
                <Download size={14} className="inline mr-1" />
                导出配置 JSON
              </button>
              <button className="btn-secondary text-sm" onClick={handleExportRuns}>
                <FileText size={14} className="inline mr-1" />
                导出 Runs Markdown ({runs.length})
              </button>
              <label className="px-4 py-2 text-sm rounded-lg bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium transition-all cursor-pointer flex items-center gap-1.5">
                <Upload size={14} />
                导入配置
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  className="hidden"
                  onChange={handleImportConfig}
                />
              </label>
            </div>
            {importMsg && (
              <div className={`text-xs p-2.5 rounded-lg ${importMsg.startsWith("❌") ? "bg-red-500/10 text-red-300" : "bg-teal-500/10 text-teal-300"}`}>
                {importMsg}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Vault 存储管理 */}
      <div className="glass-card-static p-5">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => { setShowVault(!showVault); if (!showVault && !vaultStats) handleLoadVaultStats(); }}
        >
          <h3 className="text-base font-semibold flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-500/15 flex items-center justify-center">
              <Database size={16} className="text-slate-400" />
            </div>
            Vault 存储管理
          </h3>
          {showVault ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
        </button>
        {showVault && (
          <div className="mt-4 space-y-3">
            {vaultStats && (
              <div className="grid grid-cols-2 gap-3">
                <div className="px-4 py-3 inner-panel rounded-xl">
                  <div className="text-xs text-slate-500">总存储</div>
                  <div className="text-sm font-medium">{vaultStats.total_kb} KB</div>
                </div>
                <div className="px-4 py-3 inner-panel rounded-xl">
                  <div className="text-xs text-slate-500">文件数</div>
                  <div className="text-sm font-medium">{vaultStats.file_count}</div>
                </div>
              </div>
            )}
            {vaultStats && Object.keys(vaultStats.by_subdir).length > 0 && (
              <div className="space-y-1">
                {Object.entries(vaultStats.by_subdir).map(([dir, bytes]) => (
                  <div key={dir} className="flex justify-between px-3.5 py-2 inner-panel rounded-xl text-xs">
                    <span className="text-slate-400">{dir}/</span>
                    <span className="text-slate-300">{Math.round((bytes as number) / 1024)} KB</span>
                  </div>
                ))}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button className="btn-secondary text-sm" onClick={handleLoadVaultStats} disabled={vaultLoading}>
                刷新统计
              </button>
              <button
                className="px-4 py-2 text-sm rounded-lg bg-amber-600/80 hover:bg-amber-500 text-white font-medium transition-all disabled:opacity-50"
                onClick={() => handleCleanupVault(30)}
                disabled={vaultLoading}
              >
                <Trash2 size={14} className="inline mr-1" />
                清理 30 天前记录
              </button>
              <button
                className="px-4 py-2 text-sm rounded-lg bg-red-600/80 hover:bg-red-500 text-white font-medium transition-all disabled:opacity-50"
                onClick={() => handleCleanupVault(7)}
                disabled={vaultLoading}
              >
                清理 7 天前记录
              </button>
            </div>
            {vaultMsg && (
              <div className="text-xs p-2.5 rounded-lg bg-slate-500/10 text-slate-300">{vaultMsg}</div>
            )}
          </div>
        )}
      </div>

      {/* §101 Health Check & Diagnostics */}
      <div className="glass-card-static p-5">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => { setShowDiag(!showDiag); if (!showDiag && !diagReport) handleRunDiagnostics(); }}
        >
          <h3 className="text-base font-semibold flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Stethoscope size={16} className="text-emerald-400" />
            </div>
            运行时诊断
          </h3>
          <div className="flex items-center gap-2">
            {diagReport && (
              <span className={`badge text-[10px] ${
                diagReport.overall === "pass" ? "badge-green" : diagReport.overall === "warn" ? "badge-yellow" : "badge-red"
              }`}>
                {diagReport.overall === "pass" ? "健康" : diagReport.overall === "warn" ? "警告" : "异常"}
              </span>
            )}
            {showDiag ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
          </div>
        </button>
        {showDiag && (
          <div className="mt-4 space-y-3">
            {diagLoading && <p className="text-xs text-slate-500 animate-pulse">正在运行诊断检查...</p>}
            {diagReport && (
              <>
                <div className="space-y-1.5">
                  {diagReport.checks.map((c) => (
                    <div key={c.name} className="flex items-center justify-between px-3.5 py-2.5 inner-panel rounded-xl text-xs">
                      <div className="flex items-center gap-2">
                        <span>{c.status === "pass" ? "✅" : c.status === "warn" ? "⚠️" : "❌"}</span>
                        <span className="text-slate-300">{c.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400">{c.message}</span>
                        <span className="text-slate-600">{Math.round(c.durationMs)}ms</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="text-xs text-slate-500">
                  DOM {diagReport.environment.domNodes} 节点 · {diagReport.environment.onLine ? "在线" : "离线"} · {diagReport.environment.memoryMB ?? "N/A"} MB 内存
                </div>
                <div className="flex gap-2">
                  <button className="btn-secondary text-sm" onClick={handleRunDiagnostics} disabled={diagLoading}>重新检查</button>
                  <button className="btn-secondary text-sm flex items-center gap-1" onClick={handleCopyDiagBundle}>
                    <ClipboardCopy size={12} />
                    {diagCopied ? "已复制!" : "复制诊断报告"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* State Machine History */}
      <div className="glass-card-static p-5">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setShowHistory(!showHistory)}
        >
          <h3 className="text-base font-semibold flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-slate-500/15 flex items-center justify-center">
              <ChevronRight size={16} className="text-slate-400" />
            </div>
            状态转换历史 ({stateHistory.length})
          </h3>
          {showHistory ? (
            <ChevronDown size={18} className="text-slate-400" />
          ) : (
            <ChevronRight size={18} className="text-slate-400" />
          )}
        </button>

        {showHistory && stateHistory.length > 0 && (
          <div className="mt-4 space-y-1 max-h-[300px] overflow-auto">
            {[...stateHistory].reverse().map((t, i) => (
              <div
                key={i}
                className="px-3.5 py-2 inner-panel rounded-xl text-xs text-slate-400 flex justify-between"
              >
                <span>
                  <span className="text-blue-300">{t.action}</span>:{" "}
                  <span className="text-slate-500">{t.from}</span> →{" "}
                  <span className="text-slate-300">{t.to}</span>
                </span>
                <span className="text-slate-600">
                  {new Date(t.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
