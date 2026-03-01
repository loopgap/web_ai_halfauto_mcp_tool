import { useState, useEffect } from "react";
import { useAppState } from "../store/AppStore";
import { getSelfHealRegistry, governanceEmitTelemetry, governanceLatest, governanceValidate } from "../api";
import { SkeletonList } from "../components/Skeleton";
import type { GovernanceValidationReport, SelfHealAction } from "../types";
import { defaultRuntimeState, getSlmSummary, recommendedModels, type SlmRole } from "../domain/slm";
import { computeIntentStats } from "../domain/feedback-learning";
import FocusRecipeEditor from "../components/FocusRecipeEditor";
import { Settings as SettingsIcon, Route, Cpu, AlertTriangle, ChevronDown, ChevronRight, HeartPulse, BarChart3, Focus } from "lucide-react";

export default function SettingsPage() {
  const { routerRules, errorCatalog, initialized, stateHistory, governanceChanges } = useAppState();
  const [showErrors, setShowErrors] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showSelfHeal, setShowSelfHeal] = useState(false);
  const [showSlm, setShowSlm] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [showFocusRecipe, setShowFocusRecipe] = useState(false);
  const [focusRecipe, setFocusRecipe] = useState<string[]>([]);
  const [selfHealActions, setSelfHealActions] = useState<SelfHealAction[]>([]);
  const [governanceLoading, setGovernanceLoading] = useState(false);
  const [governanceMsg, setGovernanceMsg] = useState("");
  const [latestReport, setLatestReport] = useState<GovernanceValidationReport | null>(null);

  // §4 SLM
  const slmRuntime = defaultRuntimeState();
  const slmSummary = getSlmSummary(slmRuntime);
  const slmModels = recommendedModels();

  // §5 Feedback
  const feedbackStats = computeIntentStats([]);

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
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">设置</h2>
        <p className="text-slate-400 mt-1">系统配置、路由规则、错误码目录</p>
      </div>

      {/* Router Rules */}
      <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
        <h3 className="text-lg font-semibold mb-4">治理闭环（v2）</h3>
        <div className="flex flex-wrap gap-2">
          <button
            className="px-3 py-2 text-sm rounded bg-blue-600 hover:bg-blue-700 disabled:opacity-50"
            onClick={handleGovernanceValidate}
            disabled={governanceLoading}
          >
            运行治理校验
          </button>
          <button
            className="px-3 py-2 text-sm rounded bg-slate-700 hover:bg-slate-600 disabled:opacity-50"
            onClick={handleLoadGovernanceSnapshot}
            disabled={governanceLoading}
          >
            加载治理快照
          </button>
          <button
            className="px-3 py-2 text-sm rounded bg-emerald-700 hover:bg-emerald-600 disabled:opacity-50"
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
        {governanceMsg && <div className="mt-2 text-xs text-blue-300">{governanceMsg}</div>}
      </div>

      {/* Router Rules */}
      <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Route size={20} className="text-green-400" />
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
                className="bg-[#0f172a] rounded-lg p-4 border border-[#334155]"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-blue-300 capitalize">
                    {intent}
                  </span>
                  <div className="flex gap-1">
                    {rule.fanout && (
                      <span className="text-xs px-2 py-0.5 bg-yellow-600/20 text-yellow-300 rounded">
                        Fanout 并行
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 bg-green-600/20 text-green-300 rounded">
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
                          className="px-2 py-0.5 bg-slate-700 rounded text-slate-300"
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
                            className="px-2 py-0.5 bg-slate-700 rounded text-slate-300 font-mono text-[10px]"
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
      <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <SettingsIcon size={20} className="text-slate-400" />
          安全默认值 & 阈值
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between px-4 py-3 bg-[#0f172a] rounded-lg">
            <div>
              <div className="text-sm font-medium">auto_enter</div>
              <div className="text-xs text-slate-500">
                默认关闭，避免误发到 AI 网页端
              </div>
            </div>
            <span className="text-xs px-2 py-1 bg-green-600/20 text-green-300 rounded">
              {routerRules?.defaults?.auto_enter ? "开启" : "关闭"}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 bg-[#0f172a] rounded-lg">
            <div>
              <div className="text-sm font-medium">fanout 并行</div>
              <div className="text-xs text-slate-500">
                默认关闭，需要时手动在 workflow 中开启
              </div>
            </div>
            <span className="text-xs px-2 py-1 bg-green-600/20 text-green-300 rounded">
              {routerRules?.defaults?.fanout ? "开启" : "关闭"}
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 bg-[#0f172a] rounded-lg">
            <div>
              <div className="text-sm font-medium">自动执行阈值</div>
              <div className="text-xs text-slate-500">
                置信度 ≥ 此值时自动选择路由
              </div>
            </div>
            <span className="text-xs px-2 py-1 bg-blue-600/20 text-blue-300 rounded">
              {((routerRules?.defaults?.confidence_auto_threshold ?? 0.8) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 bg-[#0f172a] rounded-lg">
            <div>
              <div className="text-sm font-medium">确认阈值</div>
              <div className="text-xs text-slate-500">
                置信度在 [确认阈值, 自动阈值) 范围内需用户确认
              </div>
            </div>
            <span className="text-xs px-2 py-1 bg-yellow-600/20 text-yellow-300 rounded">
              {((routerRules?.defaults?.confidence_confirm_threshold ?? 0.6) * 100).toFixed(0)}%
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 bg-[#0f172a] rounded-lg">
            <div>
              <div className="text-sm font-medium">DOM 注入</div>
              <div className="text-xs text-slate-500">
                不注入网页、不读 cookie、不做 iframe
              </div>
            </div>
            <span className="text-xs px-2 py-1 bg-red-600/20 text-red-300 rounded">
              禁用
            </span>
          </div>
        </div>
      </div>

      {/* NPU / Meta Router Status */}
      <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Cpu size={20} className="text-orange-400" />
          NPU / 小模型路由状态
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between px-4 py-3 bg-[#0f172a] rounded-lg">
            <div>
              <div className="text-sm font-medium">规则路由 v2</div>
              <div className="text-xs text-slate-500">
                关键词 + 正则 + 置信度打分，零成本
              </div>
            </div>
            <span className="text-xs px-2 py-1 bg-green-600/20 text-green-300 rounded">
              已启用
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 bg-[#0f172a] rounded-lg">
            <div>
              <div className="text-sm font-medium">Router 小模型 (1.5B)</div>
              <div className="text-xs text-slate-500">
                规则不确定时调用，CPU/NPU 推理
              </div>
            </div>
            <span className="text-xs px-2 py-1 bg-yellow-600/20 text-yellow-300 rounded">
              待配置
            </span>
          </div>
          <div className="flex items-center justify-between px-4 py-3 bg-[#0f172a] rounded-lg">
            <div>
              <div className="text-sm font-medium">Coder 小模型 (3B)</div>
              <div className="text-xs text-slate-500">
                按需启用，生成代码时使用
              </div>
            </div>
            <span className="text-xs px-2 py-1 bg-slate-600/20 text-slate-300 rounded">
              未启用
            </span>
          </div>
        </div>
      </div>

      {/* Unified Error Catalog (§9) */}
      <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setShowErrors(!showErrors)}
        >
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <AlertTriangle size={20} className="text-red-400" />
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
                      className="px-3 py-2 bg-[#0f172a] rounded text-xs flex items-start justify-between gap-4"
                    >
                      <div className="flex-1">
                        <span className="font-mono text-red-300">{e.code}</span>
                        <span className="text-slate-400 ml-2">{e.user_message}</span>
                        <div className="text-slate-600 mt-0.5">
                          💡 {e.fix_suggestion}
                        </div>
                      </div>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded whitespace-nowrap ${
                          e.alert_level === "error"
                            ? "bg-red-600/20 text-red-300"
                            : e.alert_level === "warn"
                            ? "bg-yellow-600/20 text-yellow-300"
                            : "bg-blue-600/20 text-blue-300"
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
      <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setShowSelfHeal(!showSelfHeal)}
        >
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <HeartPulse size={20} className="text-pink-400" />
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
                className="px-4 py-3 bg-[#0f172a] rounded-lg border border-[#334155]"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-pink-300 text-sm">
                    {a.strategy_id}
                  </span>
                  <div className="flex gap-2">
                    <span className="text-[10px] px-1.5 py-0.5 bg-purple-600/20 text-purple-300 rounded">
                      {a.action_type}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-600/20 text-slate-300 rounded">
                      max:{a.max_attempts}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-blue-600/20 text-blue-300 rounded">
                      冷却:{a.cooldown_ms}ms
                    </span>
                  </div>
                </div>
                <div className="text-xs text-slate-400">{a.description}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* §4 SLM Configuration Panel */}
      <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setShowSlm(!showSlm)}
        >
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Cpu size={20} className="text-orange-400" />
            SLM 本地模型配置 (§4)
          </h3>
          {showSlm ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
        </button>

        {showSlm && (
          <div className="mt-4 space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="px-4 py-3 bg-[#0f172a] rounded-lg">
                <div className="text-xs text-slate-500">已加载模型</div>
                <div className="text-sm font-medium text-orange-300">{slmSummary.totalLoaded}</div>
              </div>
              <div className="px-4 py-3 bg-[#0f172a] rounded-lg">
                <div className="text-xs text-slate-500">CPU安全模式</div>
                <div className={`text-sm font-medium ${slmSummary.cpuSafeMode ? "text-yellow-300" : "text-green-300"}`}>{slmSummary.cpuSafeMode ? "已启用" : "正常"}</div>
              </div>
              <div className="px-4 py-3 bg-[#0f172a] rounded-lg">
                <div className="text-xs text-slate-500">总推理</div>
                <div className="text-sm font-medium">{slmSummary.totalInferences} 次</div>
              </div>
              <div className="px-4 py-3 bg-[#0f172a] rounded-lg">
                <div className="text-xs text-slate-500">平均延迟</div>
                <div className="text-sm font-medium">{slmSummary.avgLatencyMs.toFixed(0)} ms</div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-medium text-slate-300 mb-2">推荐模型</h4>
              <div className="space-y-1">
                {(Object.entries(slmModels) as [SlmRole, { paramSize: string; quant: string; preferDevice: string }][]).map(([role, m]) => (
                  <div key={role} className="flex items-center justify-between px-3 py-2 bg-[#0f172a] rounded text-xs">
                    <div>
                      <span className="text-blue-300 font-mono">{role}</span>
                      <span className="text-slate-500 ml-2">{m.paramSize}</span>
                    </div>
                    <div className="flex gap-2">
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 rounded">{m.quant}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 rounded">{m.preferDevice}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* §5 Feedback Learning Panel */}
      <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setShowFeedback(!showFeedback)}
        >
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 size={20} className="text-blue-400" />
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
                <div key={s.intent} className="px-4 py-3 bg-[#0f172a] rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-blue-300 font-medium text-sm">{s.intent}</span>
                    <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 rounded">总计: {s.total}</span>
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
      <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setShowFocusRecipe(!showFocusRecipe)}
        >
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Focus size={20} className="text-cyan-400" />
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
      <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <HeartPulse size={18} className="text-pink-400" />
            <span className="text-sm font-semibold">自愈引擎状态</span>
          </div>
          <div className="flex gap-2 text-[10px]">
            <span className="px-2 py-0.5 bg-green-600/20 text-green-300 rounded">策略: {selfHealActions.length}</span>
            <span className="px-2 py-0.5 bg-blue-600/20 text-blue-300 rounded">状态: 就绪</span>
          </div>
        </div>
      </div>

      {/* State Machine History */}
      <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
        <button
          className="w-full flex items-center justify-between"
          onClick={() => setShowHistory(!showHistory)}
        >
          <h3 className="text-lg font-semibold flex items-center gap-2">
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
                className="px-3 py-1.5 bg-[#0f172a] rounded text-xs text-slate-400 flex justify-between"
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
