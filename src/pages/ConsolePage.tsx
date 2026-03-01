import { useState, useCallback, useMemo, useEffect } from "react";
import { useAppState, useAppDispatch } from "../store/AppStore";
import {
  executeDispatchFlow,
  captureOutput,
  confirmSend,
  routePromptFlow,
  validateInput,
  lookupError,
  getRecoveryActions,
} from "../domain/actions";
import type { InjectionMode, RouteDecision } from "../types";
import { RUN_STATUS } from "../domain/dictionary";
import StepProgress from "../components/StepProgress";
import { useToast } from "../components/Toast";
import { useDebouncedAction } from "../hooks/useDebounce";
import {
  Play,
  Copy,
  AlertCircle,
  CheckCircle,
  Loader2,
  Route,
  ShieldAlert,
  Info,
  Send,
  Pause,
  AlertTriangle,
  Globe,
} from "lucide-react";

export default function ConsolePage() {
  const { skills, targets, runs, errorCatalog, pageStates } = useAppState();
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
  const [twoPhaseMode, setTwoPhaseMode] = useState(true); // §9.4 默认两阶段提交
  const [autoBrowserSelect, setAutoBrowserSelect] = useState(true);
  const [autoInject, setAutoInject] = useState(true);
  const [injectionMode, setInjectionMode] = useState<InjectionMode>("balanced");
  const [lastErrorCode, setLastErrorCode] = useState<string>("");
  const [browserWarning, setBrowserWarning] = useState<string>("");

  const pageState = pageStates.console || "idle";
  const currentSkill = useMemo(() => skills.find((s) => s.id === selectedSkill), [skills, selectedSkill]);

  // 鈹€鈹€鈹€ 娓叉煋 prompt 妯℃澘 鈹€鈹€鈹€
  const renderedPrompt = useMemo(() => {
    if (!currentSkill) return "";
    let prompt = currentSkill.prompt_template;
    for (const [key, val] of Object.entries(inputValues)) {
      prompt = prompt.replace(new RegExp(`\\{${key}\\}`, "g"), val || `{${key}}`);
    }
    return prompt;
  }, [currentSkill, inputValues]);

  // 鈹€鈹€鈹€ Auto-route: 褰?prompt 鍙樺寲鏃跺仛璺敱鎺ㄨ崘 鈹€鈹€鈹€
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

  // 鈹€鈹€鈹€ 杈撳叆鏍￠獙 (瀹炴椂) 鈹€鈹€鈹€
  const handleInputChange = useCallback(
    (key: string, value: string) => {
      setInputValues((prev) => ({ ...prev, [key]: value }));
      const maxLen = currentSkill?.inputs[key]?.max_length;
      const err = validateInput(key, value, maxLen);
      setInputErrors((prev) => {
        const next = { ...prev };
        if (err) next[key] = err;
        else delete next[key];
        return next;
      });
    },
    [currentSkill],
  );

  // 鈹€鈹€鈹€ Dispatch 闂幆 (搂9.4 涓ら樁娈? 鈹€鈹€鈹€
  const handleDispatch = useCallback(async () => {
    if (!currentSkill || !targets || !selectedTarget) return;

    // 楂樺嵄 skill 闇€纭 (搂3 瀹夊叏鏍囧噯)
    if (currentSkill.safety_level !== "safe" && !showConfirm) {
      setShowConfirm(true);
      return;
    }
    setShowConfirm(false);

    setErrorMsg("");
    setLastErrorCode("");
    setStagedHwnd(null);
    setBrowserWarning("");
    const result = await executeDispatchFlow(
      {
        skill: currentSkill,
        targetId: selectedTarget,
        targets,
        inputValues,
        routeDecision: routeDecision ?? undefined,
        stageOnly: twoPhaseMode, // 搂9.4
        autoBrowserSelect,
        autoInject,
        injectionMode,
      },
      dispatch,
    );

    if (result.success && result.run) {
      setLastRunId(result.run.id);
      // §60 浏览器警告处理
      if (result.browserWarning) {
        setBrowserWarning(result.browserWarning);
        toast("warning", "检测到未识别的浏览器，请查看提示");
      }
      if (twoPhaseMode && result.stagedHwnd) {
        setStagedHwnd(result.stagedHwnd); // 搂9.4 绛夊緟鐢ㄦ埛纭
        toast("info", "宸茬矘璐村埌鐩爣绐楀彛锛岃纭鍚庣偣鍑?Send Now");
      } else {
        toast("success", "鎶曢€掓垚鍔燂紝绛夊緟鍥炴敹杈撳嚭");
      }
    } else if (result.error) {
      const def = lookupError(errorCatalog, result.error.code);
      setErrorMsg(def ? `${def.user_message}\n馃挕 ${def.fix_suggestion}` : result.error.message);
      setLastErrorCode(result.error.code);
      toast("error", `鎶曢€掑け璐? ${result.error.code}`);
    }
  }, [currentSkill, targets, selectedTarget, inputValues, routeDecision, showConfirm, twoPhaseMode, autoBrowserSelect, autoInject, injectionMode, dispatch, errorCatalog, toast]);

  // 鈹€鈹€鈹€ 搂9.4 涓ら樁娈? Send Now 纭 鈹€鈹€鈹€
  const handleConfirmSend = useCallback(async () => {
    if (!stagedHwnd || !lastRunId) return;
    const result = await confirmSend(stagedHwnd, lastRunId, dispatch);
    if (result.success) {
      setStagedHwnd(null);
      toast("success", "宸插彂閫侊紒绛夊緟鐩爣绐楀彛鍥炲鍚庢墽琛?Capture");
    } else if (result.error) {
      setErrorMsg(result.error.message);
      toast("error", `鍙戦€佸け璐? ${result.error.message}`);
    }
  }, [stagedHwnd, lastRunId, dispatch, toast]);

  // 鈹€鈹€鈹€ Capture 杈撳嚭 鈹€鈹€鈹€
  const handleCapture = useCallback(async () => {
    if (!lastRunId) return;
    const result = await captureOutput(lastRunId, dispatch, currentSkill?.quality_gates);
    if (result.success && result.text) {
      setOutput(result.text);
      // 搂28 Quality Gate 楠屾敹鍙嶉
      if (result.qualityResult && !result.qualityResult.passed) {
        toast("warning", `璐ㄩ噺闂ㄦ湭閫氳繃: ${result.qualityResult.failures[0]}`);
      } else {
        toast("success", "杈撳嚭宸插洖鏀跺苟褰掓。");
      }
    } else if (result.error) {
      setErrorMsg(result.error.message);
      toast("error", `鍥炴敹澶辫触: ${result.error.message}`);
    }
  }, [lastRunId, dispatch, currentSkill, toast]);

  // §71 debounced wrappers for critical buttons
  const [debouncedDispatch, dispatchLoading] = useDebouncedAction(handleDispatch, 400);
  const [debouncedCapture, captureLoading] = useDebouncedAction(handleCapture, 400);
  const [debouncedConfirmSend, confirmLoading] = useDebouncedAction(handleConfirmSend, 400);

  const hasInputErrors = Object.keys(inputErrors).length > 0;
  const sessionRuns = runs.slice(0, 10);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Run Console</h2>
        <p className="text-slate-400 mt-1">
          閫夋嫨 Skill 鈫?濉啓鍙傛暟 鈫?閫夋嫨 Target 鈫?鎶曢€?路 闂幆娴佺▼
        </p>
      </div>

      {/* 搂45 璋冨害闃舵杩涘害鏉?*/}
      <StepProgress pageState={pageState} visible={pageState !== "idle" && pageState !== "ready"} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Input */}
        <div className="space-y-4">
          {/* Skill Select */}
          <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              閫夋嫨 Skill
            </label>
            <select
              className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-sm text-slate-200"
              value={selectedSkill}
              onChange={(e) => {
                setSelectedSkill(e.target.value);
                setInputValues({});
                setInputErrors({});
                setOutput("");
                setErrorMsg("");
                setLastRunId(null);
                setShowConfirm(false);
                dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "idle" } });
              }}
            >
              <option value="">-- 閫夋嫨鎶€鑳?--</option>
              {skills.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title} ({s.id}) v{s.version}
                </option>
              ))}
            </select>
            {currentSkill && (
              <div className="flex gap-1.5 mt-2 flex-wrap">
                {currentSkill.intent_tags.map((t) => (
                  <span key={t} className="text-[10px] px-1.5 py-0.5 bg-purple-600/20 text-purple-300 rounded">
                    {t}
                  </span>
                ))}
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    currentSkill.safety_level === "safe"
                      ? "bg-green-600/20 text-green-300"
                      : "bg-yellow-600/20 text-yellow-300"
                  }`}
                >
                  {currentSkill.safety_level}
                </span>
              </div>
            )}
          </div>

          {/* Inputs with validation */}
          {currentSkill && Object.keys(currentSkill.inputs).length > 0 && (
            <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-4 space-y-3">
              <h3 className="text-sm font-medium text-slate-300">杈撳叆鍙傛暟</h3>
              {Object.entries(currentSkill.inputs).map(([key, input]) => (
                <div key={key}>
                  <label className="block text-xs text-slate-400 mb-1">
                    {key} {input.required && <span className="text-red-400">*</span>}
                    {input.description && (
                      <span className="text-slate-600 ml-1">鈥?{input.description}</span>
                    )}
                    {input.max_length && (
                      <span className="text-slate-600 ml-1">
                        ({(inputValues[key] || "").length}/{input.max_length})
                      </span>
                    )}
                  </label>
                  <textarea
                    className={`w-full bg-[#0f172a] border rounded-lg px-3 py-2 text-sm text-slate-200 resize-y min-h-[60px] ${
                      inputErrors[key] ? "border-red-500" : "border-[#334155]"
                    }`}
                    value={inputValues[key] || ""}
                    onChange={(e) => handleInputChange(key, e.target.value)}
                    placeholder={`杈撳叆 ${key}...`}
                  />
                  {inputErrors[key] && (
                    <p className="text-xs text-red-400 mt-0.5">{inputErrors[key]}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Target Select */}
          <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-4">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              閫夋嫨 Target
            </label>
            <select
              className="w-full bg-[#0f172a] border border-[#334155] rounded-lg px-3 py-2 text-sm text-slate-200"
              value={selectedTarget}
              onChange={(e) => setSelectedTarget(e.target.value)}
            >
              <option value="">-- 閫夋嫨鐩爣绐楀彛 --</option>
              {targets &&
                Object.entries(targets.targets).map(([id, t]) => (
                  <option key={id} value={id}>
                    {id} ({t.provider})
                  </option>
                ))}
            </select>
          </div>

          {/* Route Decision (搂5 rule engine) */}
          {routeDecision && (
            <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                <Route size={14} className="text-green-400" />
                璺敱鍐崇瓥
              </h3>
              <div className="text-xs text-slate-400 space-y-1">
                <div>
                  鍔ㄤ綔:{" "}
                  <span
                    className={
                      routeDecision.action === "auto_execute"
                        ? "text-green-300"
                        : routeDecision.action === "user_confirm"
                        ? "text-yellow-300"
                        : "text-slate-300"
                    }
                  >
                    {{ auto_execute: "自动执行", user_confirm: "需确认", fallback_default: "默认回退" }[routeDecision.action] ?? routeDecision.action}
                  </span>{" "}
                  路 缃俊搴? {(routeDecision.confidence * 100).toFixed(0)}%
                </div>
                <div className="text-slate-500">{routeDecision.explanation}</div>
                {routeDecision.top_candidates.length > 0 && (
                  <div className="flex gap-1 mt-1">
                    {routeDecision.top_candidates.map((c) => (
                      <span
                        key={c.intent}
                        className="px-1.5 py-0.5 bg-slate-700 rounded text-slate-300"
                      >
                        {c.intent} ({(c.score * 100).toFixed(0)}%)
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* 搂9.4 Two-Phase Mode Toggle */}
          <div className="flex items-center gap-3 px-4 py-2 bg-[#1e293b] rounded-xl border border-[#334155]">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={twoPhaseMode}
                onChange={(e) => setTwoPhaseMode(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              <Pause size={14} className="text-blue-400" />
              涓ら樁娈垫彁浜?(搂9.4)
            </label>
            <span className="text-xs text-slate-500">
              {twoPhaseMode ? "Paste only, confirm before sending" : "Paste and auto press Enter"}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3 px-4 py-2 bg-[#1e293b] rounded-xl border border-[#334155]">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoBrowserSelect}
                onChange={(e) => setAutoBrowserSelect(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              浏览器智能选择
            </label>
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoInject}
                onChange={(e) => setAutoInject(e.target.checked)}
                className="w-4 h-4 rounded"
              />
              自动指令注入
            </label>
            <select
              className="bg-[#0f172a] border border-[#334155] rounded px-2 py-1 text-xs text-slate-200"
              value={injectionMode}
              onChange={(e) => setInjectionMode(e.target.value as InjectionMode)}
              disabled={!autoInject}
            >
              <option value="strict">注入严格</option>
              <option value="balanced">注入平衡</option>
              <option value="lean">注入简洁</option>
            </select>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
              {pageState === "dispatching" ? "鎶曢€掍腑..." : twoPhaseMode ? "Stage 绮樿创" : "鎶曢€?Dispatch"}
            </button>

            {/* 搂9.4 Send Now 鈥?涓ら樁娈电‘璁?*/}
            {stagedHwnd && (
              <button
                className="flex items-center gap-2 px-4 py-2.5 bg-orange-600 hover:bg-orange-700 rounded-lg text-sm font-medium transition-colors animate-pulse"
                onClick={debouncedConfirmSend}
                disabled={confirmLoading}
                aria-busy={confirmLoading}
              >
                <Send size={16} />
                Send Now 纭鍙戦€?
              </button>
            )}

            <button
              className="flex items-center gap-2 px-4 py-2.5 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              disabled={!lastRunId || captureLoading}
              onClick={debouncedCapture}
              aria-busy={captureLoading}
            >
              <Copy size={16} />
              Capture 杈撳嚭
            </button>
          </div>

          {/* High-risk confirmation dialog (搂3 瀹夊叏鏍囧噯) */}
          {showConfirm && currentSkill && (
            <div className="flex items-start gap-3 px-4 py-3 bg-yellow-900/30 border border-yellow-700 rounded-lg text-sm">
              <ShieldAlert size={20} className="text-yellow-400 mt-0.5" />
              <div className="flex-1">
                <p className="text-yellow-200 font-medium">High-risk action confirmation</p>
                <p className="text-yellow-300/70 text-xs mt-1">
                  鎶€鑳?"{currentSkill.title}" 瀹夊叏绾у埆涓?"{currentSkill.safety_level}"銆傜‘璁ゆ墽琛岋紵
                </p>
                <div className="flex gap-2 mt-2">
                  <button
                    className="px-3 py-1.5 bg-yellow-600 hover:bg-yellow-700 rounded text-xs font-medium"
                    onClick={debouncedDispatch}
                  >
                    纭鎵ц
                  </button>
                  <button
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-xs"
                    onClick={() => setShowConfirm(false)}
                  >
                    鍙栨秷
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Status Feedback 鈥?搂42.3 鏅鸿兘鎭㈠璺緞 */}
          {pageState === "error" && errorMsg && (
            <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 space-y-3">
              <div className="flex items-start gap-2 text-sm text-red-300">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                <pre className="whitespace-pre-wrap text-xs flex-1">{errorMsg}</pre>
              </div>
              {/* 搂42.3 鏅鸿兘鎭㈠鎸夐挳 鈥?1 涓富鎸夐挳 + 1 涓鎸夐挳 */}
              {lastErrorCode && (
                <div className="flex gap-2 pl-6">
                  {getRecoveryActions(lastErrorCode).map((ra) => (
                    <button
                      key={ra.action}
                      onClick={() => {
                        if (ra.action === "retry" || ra.action === "redetect" || ra.action === "retry_clipboard") {
                          setErrorMsg("");
                          setLastErrorCode("");
                          dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "idle" } });
                        } else if (ra.action === "edit") {
                          setErrorMsg("");
                          setLastErrorCode("");
                          dispatch({ type: "SET_PAGE_STATE", payload: { page: "console", state: "ready" } });
                        }
                      }}
                      className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                        ra.primary
                          ? "bg-red-600/30 hover:bg-red-600/50 text-red-200 font-medium"
                          : "bg-slate-700/50 hover:bg-slate-700/80 text-slate-300"
                      }`}
                      title={ra.description}
                    >
                      {ra.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {(pageState === "waiting_capture" || pageState === "archived") && (
            <div className="flex items-center gap-2 px-4 py-3 bg-green-900/30 border border-green-800 rounded-lg text-sm text-green-300">
              <CheckCircle size={16} />
              {pageState === "archived"
                ? "Completed and archived."
                : "Dispatched. Copy output from target window, then click Capture."}
            </div>
          )}

          {/* §60 浏览器未知检测警告 */}
          {browserWarning && (
            <div className="bg-amber-900/30 border border-amber-700 rounded-lg p-4 space-y-2">
              <div className="flex items-start gap-2 text-sm text-amber-200">
                <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-400" />
                <div className="flex-1">
                  <p className="font-medium flex items-center gap-1.5">
                    <Globe size={14} />
                    未识别的浏览器
                  </p>
                  <p className="text-xs text-amber-300/80 mt-1 whitespace-pre-wrap">{browserWarning}</p>
                </div>
              </div>
              <div className="flex gap-2 pl-6">
                <button
                  className="text-xs px-3 py-1.5 bg-amber-600/30 hover:bg-amber-600/50 text-amber-200 rounded-lg font-medium transition-colors"
                  onClick={() => setBrowserWarning("")}
                >
                  知道了，继续使用
                </button>
                <button
                  className="text-xs px-3 py-1.5 bg-slate-700/50 hover:bg-slate-700/80 text-slate-300 rounded-lg transition-colors"
                  onClick={() => {
                    setBrowserWarning("");
                    toast("info", "请在 Targets 页面进入绑定向导配置浏览器");
                  }}
                >
                  进入绑定向导
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Preview & Output */}
        <div className="space-y-4">
          {/* Rendered Prompt */}
          <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
              Prompt 棰勮
              {currentSkill && (
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">
                  {renderedPrompt.length} chars
                </span>
              )}
            </h3>
            <pre className="bg-[#0f172a] rounded-lg p-4 text-sm text-slate-300 overflow-auto max-h-[300px] whitespace-pre-wrap font-mono">
              {renderedPrompt || "閫夋嫨 Skill 鍚庢樉绀?.."}
            </pre>
          </div>

          {/* Quality Gates Info */}
          {currentSkill && currentSkill.quality_gates.length > 0 && (
            <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-4">
              <h3 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
                <Info size={14} className="text-blue-400" />
                Quality Gates
              </h3>
              <div className="space-y-1 text-xs text-slate-400">
                {currentSkill.quality_gates.map((g, i) => (
                  <div key={i} className="flex gap-2">
                    {g.min_length && <span>鏈€灏忛暱搴? {g.min_length}</span>}
                    {g.max_length && <span>鏈€澶ч暱搴? {g.max_length}</span>}
                    {g.must_contain.length > 0 && (
                      <span>蹇呴』鍖呭惈: {g.must_contain.join(", ")}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Output */}
          <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-4">
            <h3 className="text-sm font-medium text-slate-300 mb-2">
              Captured 杈撳嚭
            </h3>
            <pre className="bg-[#0f172a] rounded-lg p-4 text-sm text-slate-300 overflow-auto max-h-[300px] whitespace-pre-wrap font-mono">
              {output || "鐐瑰嚮 Capture 鎸夐挳鑾峰彇鍓创鏉垮唴瀹?.."}
            </pre>
          </div>
        </div>
      </div>

      {/* Recent Runs (from store) */}
      {sessionRuns.length > 0 && (
        <div className="bg-[#1e293b] rounded-xl border border-[#334155] p-5">
          <h3 className="text-lg font-semibold mb-4">杩愯璁板綍</h3>
          <div className="space-y-2">
            {sessionRuns.map((run) => (
              <div
                key={run.id}
                className="flex items-center justify-between px-4 py-2.5 bg-[#0f172a] rounded-lg text-sm"
              >
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      RUN_STATUS[run.status]?.dot ?? "bg-slate-400"
                    }`}
                  />
                  <span>{run.skill_id}</span>
                  <span className="text-slate-500">-&gt;</span>
                  <span className="text-blue-300">{run.target_id}</span>
                  {run.trace_id && (
                    <span className="text-[10px] text-slate-600 font-mono">
                      {run.trace_id.substring(0, 12)}
                    </span>
                  )}
                </div>
                <span className="text-slate-500 text-xs">
                  {new Date(run.ts_start).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

