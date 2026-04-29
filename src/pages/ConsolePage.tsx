import { useState, useCallback, useMemo, useEffect } from "react";
import { useAppDispatch, useAppStore } from '../store/AppStore';
import {
  executeDispatchFlow,
  captureOutput,
  confirmSend,
  routePromptFlow,
  validateInput,
  lookupError,
  MAX_INPUT_LEN,
} from "../domain/actions";
import type { RouteDecision } from "../types";
import type { DispatchOptions } from "../types";
import StepProgress from "../components/StepProgress";
import RunHistoryList from "../components/RunHistoryList";
import RouteDecisionComponent from "../components/RouteDecision";
import EmptyState from "../components/EmptyState";
import SkillSelector from "../components/SkillSelector";
import ErrorRecoveryPanel from "../components/ErrorRecoveryPanel";
import DispatchOptionsComponent from "../components/DispatchOptions";
import { useToast } from "../components/Toast";
import { useDebouncedAction } from "../hooks/useDebounce";
import {
  Play,
  Copy,
  CheckCircle,
  Loader2,
  ShieldAlert,
  Info,
  Send,
  AlertTriangle,
  Globe,
} from "lucide-react";

export default function ConsolePage() {
  const skills = useAppStore(s => s.skills);
  const targets = useAppStore(s => s.targets);

  // 按最近使用时间降序排列
  const sortedSkills = useMemo(
    () => [...skills].sort((a, b) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0)),
    [skills]
  );

  const sortedTargets = useMemo(() => {
    if (!targets) return null;
    return {
      ...targets,
      targets: Object.fromEntries(
        Object.entries(targets.targets).sort(
          ([, a], [, b]) => (b.lastUsedAt ?? 0) - (a.lastUsedAt ?? 0)
        )
      ),
    };
  }, [targets]);
  const health = useAppStore(s => s.health);
  const runs = useAppStore(s => s.runs);
  const errorCatalog = useAppStore(s => s.errorCatalog);
  const pageStates = useAppStore(s => s.pageStates);
  const dispatch = useAppDispatch();
  const { toast } = useToast();

  const [selectedSkill, setSelectedSkill] = useState<string>("");
  const [selectedTarget, setSelectedTarget] = useState<string>("");
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [output, setOutput] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [routeDecision, setRouteDecision] = useState<RouteDecision | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [inputErrors, setInputErrors] = useState<Record<string, string>>({});
  const [stagedHwnd, setStagedHwnd] = useState<number | null>(null);
  const [stagedTargetName, setStagedTargetName] = useState<string>("");
  const [dispatchOptions, setDispatchOptions] = useState<DispatchOptions>({
    twoPhaseMode: true,
    autoBrowserSelect: true,
    autoInject: true,
    injectionMode: "balanced",
  });
  const [lastErrorCode, setLastErrorCode] = useState<string>("");
  const [browserWarning, setBrowserWarning] = useState<string>("");
  const [isStaging, setIsStaging] = useState(false);

  const pageState = pageStates.console || "idle";
  const currentSkill = useMemo(() => skills.find((s) => s.id === selectedSkill), [skills, selectedSkill]);

  // ─── Skill 变化时重置状态 ───
  const handleSkillChange = useCallback((skillId: string) => {
    setSelectedSkill(skillId);
    setInputValues({});
    setInputErrors({});
    setOutput("");
    setErrorMsg("");
    setLastRunId(null);
    setShowConfirm(false);
    dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "idle" } });
  }, [dispatch]);

  // ─── 渲染 prompt 模板 ───
  const renderedPrompt = useMemo(() => {
    if (!currentSkill) return "";
    let prompt = currentSkill.prompt_template;
    for (const [key, val] of Object.entries(inputValues)) {
      prompt = prompt.replace(new RegExp(`\\{${key}\\}`, "g"), val || `{${key}}`);
    }
    return prompt;
  }, [currentSkill, inputValues]);

  // ─── Auto-route: 当 prompt 变化时做路由推荐 ───
  useEffect(() => {
    if (!renderedPrompt || renderedPrompt.length < 10) {
      setRouteDecision(null);
      return;
    }
    const timer = setTimeout(async () => {
      const result = await routePromptFlow(renderedPrompt);
      if (result.success && result.decision) {
        setRouteDecision(result.decision);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [renderedPrompt]);

  // ─── 输入校验 (实时) ───
  const handleInputChange = useCallback(
    (key: string, value: string) => {
      setInputValues((prev) => ({ ...prev, [key]: value }));
      const maxLen = currentSkill?.inputs[key]?.max_length;
      const err = validateInput(key, value, maxLen);
      setInputErrors((prev) => {
        const next = { ...prev };
        if (err) {
          const remaining = (maxLen ?? MAX_INPUT_LEN) - value.length;
          next[key] = `参数 '${key}' 太长：还剩 ${remaining} 字符可输入`;
        } else {
          delete next[key];
        }
        return next;
      });
    },
    [currentSkill],
  );

  // ─── Dispatch 闭环 (两阶段) ───
  const handleDispatch = useCallback(async () => {
    if (!currentSkill || !targets || !selectedTarget) return;

    // 高危 skill 需确认 (安全标准)
    if (currentSkill.safety_level !== "safe" && !showConfirm) {
      setShowConfirm(true);
      return;
    }
    setShowConfirm(false);

    setErrorMsg("");
    setLastErrorCode("");
    setStagedHwnd(null);
    setStagedTargetName("");
    setBrowserWarning("");
    // Optimistic 状态：立即显示反馈
    setIsStaging(true);
    let result;
    try {
      result = await executeDispatchFlow(
        {
          skill: currentSkill,
          targetId: selectedTarget,
          targets,
          inputValues,
          routeDecision: routeDecision ?? undefined,
          stageOnly: dispatchOptions.twoPhaseMode,
          autoBrowserSelect: dispatchOptions.autoBrowserSelect,
          autoInject: dispatchOptions.autoInject,
          injectionMode: dispatchOptions.injectionMode,
        },
        dispatch,
      );

      if (result.success && result.run) {
        setLastRunId(result.run.id);
        if (result.browserWarning) {
          setBrowserWarning(result.browserWarning);
          toast("warning", "\u68c0\u6d4b\u5230\u672a\u8bc6\u522b\u7684\u6d4f\u89c8\u5668\uff0c\u8bf7\u67e5\u770b\u63d0\u793a");
        }
        if (dispatchOptions.twoPhaseMode && result.stagedHwnd) {
          setStagedHwnd(result.stagedHwnd);
          setStagedTargetName(selectedTarget);
          toast("info", `\u5df2\u7c98\u8d34\u5230 ${selectedTarget}\uff0c\u8bf7\u786e\u8ba4\u540e\u70b9\u51fb Send Now`);
        } else {
          toast("success", "\u6295\u9012\u6210\u529f\uff0c\u7b49\u5f85\u56de\u6536\u8f93\u51fa");
        }
      } else if (result.error) {
        const def = lookupError(errorCatalog, result.error.code);
        setErrorMsg(def ? `${def.user_message}\n\u63d0\u793a: ${def.fix_suggestion}` : result.error.message);
        setLastErrorCode(result.error.code);
        toast("error", `\u6295\u9012\u5931\u8d25: ${result.error.code}`);
      }
    } finally {
      setIsStaging(false);
    }
  }, [currentSkill, targets, selectedTarget, inputValues, routeDecision, showConfirm, dispatchOptions, dispatch, errorCatalog, toast]);

  // ─── 两阶段 Send Now 确认 ───
  const handleConfirmSend = useCallback(async () => {
    if (!stagedHwnd || !lastRunId) return;
    const result = await confirmSend(stagedHwnd, lastRunId, dispatch);
    if (result.success) {
      setStagedHwnd(null);
      setStagedTargetName("");
      toast("success", "\u5df2\u53d1\u9001\uff01\u7b49\u5f85\u76ee\u6807\u7a97\u53e3\u56de\u590d\u540e\u6267\u884c Capture");
    } else if (result.error) {
      setErrorMsg(result.error.message);
      toast("error", `\u53d1\u9001\u5931\u8d25: ${result.error.message}`);
    }
  }, [stagedHwnd, lastRunId, dispatch, toast]);

  // ─── Capture 输出 ───
  const handleCapture = useCallback(async () => {
    if (!lastRunId) return;
    const result = await captureOutput(lastRunId, dispatch, currentSkill?.quality_gates);
    if (result.success && result.text) {
      setOutput(result.text);
      
      // 显示安全/输出警告
      if (result.securityWarnings && result.securityWarnings.length > 0) {
        toast("warning", `安全提示: ${result.securityWarnings[0]}`);
      }

      if (result.qualityResult && !result.qualityResult.passed) {
        toast("warning", `\u8d28\u91cf\u95e8\u672a\u901a\u8fc7: ${result.qualityResult.failures[0]}`);
      } else {
        toast("success", "\u8f93\u51fa\u5df2\u56de\u6536\u5e76\u5f52\u6863");
      }
    } else if (result.error) {
      setErrorMsg(result.error.message);
      toast("error", `\u56de\u6536\u5931\u8d25: ${result.error.message}`);
    }
  }, [lastRunId, dispatch, currentSkill, toast]);

  // debounced wrappers for critical buttons
  const [debouncedDispatch, dispatchLoading] = useDebouncedAction(handleDispatch, 400);
  const [debouncedCapture, captureLoading] = useDebouncedAction(handleCapture, 400);
  const [debouncedConfirmSend, confirmLoading] = useDebouncedAction(handleConfirmSend, 400);

  const hasInputErrors = Object.keys(inputErrors).length > 0;
  const sessionRuns = runs;

  return (
    <div className="p-8 space-y-8">
      <div className="animate-fade-in-up">
        <h2 className="text-2xl font-bold text-gradient">{"\u8fd0\u884c\u63a7\u5236\u53f0"}</h2>
        <p className="text-slate-500 mt-1">
          {"\u9009\u62e9 Skill \u2192 \u586b\u5199\u53c2\u6570 \u2192 \u9009\u62e9 Target \u2192 \u6295\u9012 \u00b7 \u95ed\u73af\u6d41\u7a0b"}
        </p>
      </div>

      {/* 调度阶段进度条 */}
      <StepProgress pageState={pageState} visible={pageState !== "idle" && pageState !== "ready"} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input */}
        <div className="space-y-4">
{/* Skill Select */}
          <SkillSelector
            skills={sortedSkills}
            selectedSkill={selectedSkill}
            onChange={handleSkillChange}
          />

          {/* Inputs with validation */}
          {currentSkill && Object.keys(currentSkill.inputs).length > 0 && (
            <div className="glass-card-static p-4 space-y-3">
              <h3 className="text-sm font-medium text-slate-300">{"\u8f93\u5165\u53c2\u6570"}</h3>
              {Object.entries(currentSkill.inputs).map(([key, input]) => (
                <div key={key}>
                  <label htmlFor={key} className="block text-xs text-slate-400 mb-1">
                    {key} {input.required && <span className="text-red-400">*</span>}
                    {input.description && (
                      <span className="text-slate-600 ml-1">{"\u2014 "}{input.description}</span>
                    )}
                    {input.max_length && (
                      <span className="text-slate-600 ml-1">
                        ({(inputValues[key] || "").length}/{input.max_length})
                      </span>
                    )}
                  </label>
                  <textarea
                    id={key}
                    className={`input-modern resize-y min-h-[60px] ${
                      inputErrors[key] ? "!border-red-500" : ""
                    }`}
                    value={inputValues[key] || ""}
                    onChange={(e) => handleInputChange(key, e.target.value)}
                    placeholder={`\u8f93\u5165 ${key}...`}
                  />
                  {inputErrors[key] && (
                    <p className="text-xs text-red-400 mt-0.5">{inputErrors[key]}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Target Select */}
          <div className="glass-card-static p-4">
            <label htmlFor="target-select" className="block text-sm font-medium text-slate-300 mb-2">
              {"\u9009\u62e9 Target"}
            </label>
            <select
              id="target-select"
              className="select-modern"
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
            >
              <option value="">{"\u002d\u002d \u9009\u62e9\u76ee\u6807\u7a97\u53e3 \u002d\u002d"}</option>
              {sortedTargets &&
                Object.entries(sortedTargets.targets).map(([id, t]) => {
                  const targetHealth = health?.find(h => h.target_id === id);
                  const isReady = targetHealth?.status === "ready";
                  const hasHealthData = !!targetHealth;
                  return (
                    <option key={id} value={id}>
                      {hasHealthData ? (isReady ? "🟢" : "🔴") : "⚪"} {id} ({t.provider})
                    </option>
                  );
                })}
            </select>
          </div>

          {/* Route Decision */}
          {routeDecision && (
            <RouteDecisionComponent decision={routeDecision} />
          )}

          <DispatchOptionsComponent options={dispatchOptions} onChange={setDispatchOptions} />

          {/* Actions */}
          <div className="flex gap-3">
            <button
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={
                !selectedSkill ||
                !selectedTarget ||
                pageState === "dispatching" ||
                hasInputErrors ||
                dispatchLoading
              }
              onClick={debouncedDispatch}
              aria-busy={dispatchLoading}
            >
              {pageState === "dispatching" ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Play size={16} />
              )}
              {isStaging ? "\u6b63\u5728\u7c98\u8d34..." : pageState === "dispatching" ? "\u6295\u9012\u4e2d..." : dispatchOptions.twoPhaseMode ? "Stage \u7c98\u8d34" : "\u6295\u9012 Dispatch"}
            </button>

            {/* Send Now — 两阶段确认 */}
            {stagedHwnd && (
              <button
                className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 rounded-lg text-sm font-medium transition-colors animate-pulse"
                onClick={debouncedConfirmSend}
                disabled={confirmLoading}
                aria-busy={confirmLoading}
              >
                <Send size={16} />
                {"Send Now \u786e\u8ba4\u53d1\u9001"}
              </button>
            )}

            <button
              className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-sm font-medium transition-all disabled:opacity-50 shadow-lg shadow-emerald-600/20"
              disabled={!lastRunId || captureLoading}
              onClick={debouncedCapture}
              aria-busy={captureLoading}
            >
              <Copy size={16} />
              {"Capture \u8f93\u51fa"}
            </button>
          </div>

          {/* 状态锚点 — 两阶段等待确认 */}
          {stagedHwnd && stagedTargetName && (
            <div className="flex items-center gap-3 px-4 py-3 bg-amber-900/30 border border-amber-600 rounded-lg text-sm animate-fade-in">
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-2 text-amber-200 font-medium">
                  <CheckCircle size={16} className="text-green-400" />
                  <span>{"\u5df2\u7c98\u8d34\u5230"} <span className="text-amber-100 font-semibold">{stagedTargetName}</span></span>
                </div>
                <div className="flex items-center gap-2 text-amber-300/70 text-xs pl-6">
                  <Loader2 size={12} className="animate-spin" />
                  {"\u7b49\u5f85\u786e\u8ba4\u53d1\u9001\uff0c\u70b9\u51fb\u4e0a\u65b9\u7684 Send Now \u6309\u94ae"}
                </div>
              </div>
            </div>
          )}

          {/* 高危确认对话框 */}
          {showConfirm && currentSkill && (
            <div className="flex items-start gap-3 px-4 py-3 bg-yellow-900/30 border border-yellow-700 rounded-lg text-sm">
              <ShieldAlert size={20} className="text-yellow-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-yellow-200 font-medium">{"\u9ad8\u5371\u64cd\u4f5c\u786e\u8ba4"}</p>
                <p className="text-yellow-300/70 text-xs mt-1">
                  {"\u6280\u80fd \u201c"}{currentSkill.title}{"\u201d \u5b89\u5168\u7ea7\u522b\u4e3a \u201c"}{currentSkill.safety_level}{"\u201d\u3002\u786e\u8ba4\u6267\u884c\uff1f"}
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 rounded text-xs font-medium"
                    onClick={debouncedDispatch}
                  >
                    {"\u786e\u8ba4\u6267\u884c"}
                  </button>
                  <button
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs"
                    onClick={() => setShowConfirm(false)}
                  >
                    {"\u53d6\u6d88"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* 状态反馈 — 智能恢复路径 */}
          {pageState === "error" && errorMsg && (
            <ErrorRecoveryPanel
              errorMsg={errorMsg}
              lastErrorCode={lastErrorCode}
              onAction={(action) => {
                if (action === "retry" || action === "redetect" || action === "retry_clipboard") {
                  setErrorMsg("");
                  setLastErrorCode("");
                  dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "idle" } });
                } else if (action === "edit") {
                  setErrorMsg("");
                  setLastErrorCode("");
                  dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "ready" } });
                } else if (action === "cancel") {
                  setErrorMsg("");
                  setLastErrorCode("");
                  dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "idle" } });
                  toast("info", "已强行中断 Agent 执行，阻止循环");
                } else if (action === "delay_retry") {
                  toast("warning", "已触发速率限制，正在执行冷却...");
                  setTimeout(() => {
                    setErrorMsg("");
                    setLastErrorCode("");
                    dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "idle" } });
                    toast("success", "冷却结束，可以重试");
                  }, 5000);
                } else if (action === "detail") {
                  toast("info", "详细信息：此功能在 Agent 日志中记录了拦截详情。");
                }
              }}
            />
          )}
          {(pageState === "waiting_capture" || pageState === "archived") && (
            <div className="flex items-center gap-2 px-4 py-3 bg-green-900/30 border border-green-800 rounded-lg text-sm text-green-300">
              <CheckCircle size={16} />
              {pageState === "archived"
                ? "\u5df2\u5b8c\u6210\u5e76\u5f52\u6863\u3002"
                : "\u5df2\u6295\u9012\u3002\u8bf7\u4ece\u76ee\u6807\u7a97\u53e3\u590d\u5236\u8f93\u51fa\uff0c\u7136\u540e\u70b9\u51fb Capture\u3002"}
            </div>
          )}

          {/* 浏览器未知检测警告 */}
          {browserWarning && (
            <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-2 text-sm text-amber-200">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" />
                <div className="flex-1">
                  <p className="font-medium flex items-center gap-1.5">
                    <Globe size={14} />
                    {"\u672a\u8bc6\u522b\u7684\u6d4f\u89c8\u5668"}
                  </p>
                  <p className="text-xs text-amber-300/80 mt-1 whitespace-pre-wrap">{browserWarning}</p>
                </div>
              </div>
              <div className="flex gap-2 pl-6">
                <button
                  className="text-xs px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 rounded-lg font-medium transition-colors"
                  onClick={() => setBrowserWarning("")}
                >
                  {"\u77e5\u9053\u4e86\uff0c\u7ee7\u7eed\u4f7f\u7528"}
                </button>
                <button
                  className="text-xs px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700/80 text-slate-300 rounded-lg transition-colors"
                  onClick={() => {
                    setBrowserWarning("");
                    toast("info", "\u8bf7\u5728 Targets \u9875\u9762\u8fdb\u5165\u7ed1\u5b9a\u5411\u5bfc\u914d\u7f6e\u6d4f\u89c8\u5668");
                  }}
                >
                  {"\u8fdb\u5165\u7ed1\u5b9a\u5411\u5bfc"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Preview & Output */}
        <div className="space-y-4">
          {/* Rendered Prompt */}
          <div className="glass-card-static p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              {"Prompt \u9884\u89c8"}
              {currentSkill && (
                <span className="badge badge-slate text-[10px]">
                  {renderedPrompt.length} chars
                </span>
              )}
            </h3>
            {renderedPrompt ? (
              <pre className="inner-panel rounded-xl p-4 text-sm text-slate-300 overflow-auto max-h-[300px] whitespace-pre-wrap font-mono">
                {renderedPrompt}
              </pre>
            ) : (
              <EmptyState
                icon="🧩"
                title="选择 Skill 后显示"
                description="从左侧选择一个 Skill 来开始配置和生成 Prompt"
              />
            )}
          </div>

          {/* Quality Gates Info */}
          {currentSkill && currentSkill.quality_gates.length > 0 && (
            <div className="glass-card-static p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                <Info size={14} className="text-blue-400" />
                Quality Gates
              </h3>
              <div className="space-y-1 text-xs text-slate-400">
                {currentSkill.quality_gates.map((g, i) => (
                  <div key={i} className="flex gap-2">
                    {g.min_length && <span>{"\u6700\u5c0f\u957f\u5ea6: "}{g.min_length}</span>}
                    {g.max_length && <span>{"\u6700\u5927\u957f\u5ea6: "}{g.max_length}</span>}
                    {g.must_contain.length > 0 && (
                      <span>{"\u5fc5\u987b\u5305\u542b: "}{g.must_contain.join(", ")}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Output */}
          <div className="glass-card-static p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-2">
              {"Captured \u8f93\u51fa"}
            </h3>
            {output ? (
              <pre className="inner-panel rounded-xl p-4 text-sm text-slate-300 overflow-auto max-h-[300px] whitespace-pre-wrap font-mono">
                {output}
              </pre>
            ) : (
              <EmptyState
                icon="📋"
                title="点击 Capture 按钮获取剪贴板内容"
                description="使用上方的 Capture 按钮捕获剪贴板内容后，这里将显示结果"
              />
            )}
          </div>
        </div>
      </div>

      {/* Recent Runs (from store) */}
      <RunHistoryList runs={sessionRuns} />
    </div>
  );
}

