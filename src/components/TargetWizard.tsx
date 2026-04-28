// ═══════════════════════════════════════════════════════════
// §9.2 Target Setup Wizard — 多步骤引导状态机
// 流程: 欢迎 → 选择目标 → 配置选项 → 启动
// ═══════════════════════════════════════════════════════════

import { useState, useEffect, useCallback, useRef } from "react";
import { dispatchStage } from "../api";
import type { WindowInfo, DispatchTrace, TargetBehavior } from "../types";
import {
  CheckCircle,
  XCircle,
  Clipboard,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Rocket,
  Sparkles,
  Settings2,
  Monitor,
  RotateCcw,
  SkipForward,
  Unlock,
} from "lucide-react";

// ─── localStorage Keys ───
const WIZARD_COMPLETED_KEY = "wizard_completed";
const WIZARD_STEP_KEY = "wizard_step";
const FIRST_TARGET_CREATED_KEY = "first_target_created";

// ─── 步骤类型定义 ───
type WizardStep = "welcome" | "select" | "verifying" | "confirm" | "config" | "launch" | "done" | "failed";

// 步骤配置
const WIZARD_STEPS: { key: WizardStep; label: string; stepNum: number }[] = [
  { key: "welcome", label: "欢迎", stepNum: 1 },
  { key: "select", label: "选择目标", stepNum: 2 },
  { key: "config", label: "配置选项", stepNum: 3 },
  { key: "launch", label: "启动", stepNum: 4 },
];

// ─── localStorage helpers ───
function setWizardCompleted(completed: boolean): void {
  try {
    localStorage.setItem(WIZARD_COMPLETED_KEY, completed ? "true" : "false");
  } catch {
    // localStorage not available
  }
}

function getWizardStep(): WizardStep | null {
  try {
    const saved = localStorage.getItem(WIZARD_STEP_KEY);
    if (saved && WIZARD_STEPS.some((s) => s.key === saved)) {
      return saved as WizardStep;
    }
  } catch {
    // localStorage not available
  }
  return null;
}

function setWizardStep(step: WizardStep): void {
  try {
    localStorage.setItem(WIZARD_STEP_KEY, step);
  } catch {
    // localStorage not available
  }
}

function getFirstTargetCreated(): boolean {
  try {
    return localStorage.getItem(FIRST_TARGET_CREATED_KEY) === "true";
  } catch {
    return false;
  }
}

function setFirstTargetCreated(): void {
  try {
    localStorage.setItem(FIRST_TARGET_CREATED_KEY, "true");
  } catch {
    // localStorage not available
  }
}

// ─── Celebration CSS ───
const CELEBRATION_STYLE = `
@keyframes confetti-fall {
  0% { transform: translateY(-100%) rotate(0deg); opacity: 1; }
  100% { transform: translateY(400px) rotate(720deg); opacity: 0; }
}

@keyframes bounce-in {
  0% { transform: scale(0); opacity: 0; }
  50% { transform: scale(1.2); }
  100% { transform: scale(1); opacity: 1; }
}

@keyframes fade-in {
  0% { opacity: 0; transform: translateY(10px); }
  100% { opacity: 1; transform: translateY(0); }
}

.animate-bounce-in {
  animation: bounce-in 0.5s ease-out forwards;
}

.animate-fade-in {
  animation: fade-in 0.5s ease-out 0.3s forwards;
  opacity: 0;
}

.confetti-1, .confetti-2, .confetti-3, .confetti-4, .confetti-5 {
  position: absolute;
  width: 10px;
  height: 10px;
  top: -20px;
}

.confetti-1 {
  left: 10%;
  background: #6366f1;
  animation: confetti-fall 2s ease-in-out 0s forwards;
  border-radius: 2px;
}

.confetti-2 {
  left: 25%;
  background: #f59e0b;
  animation: confetti-fall 2.5s ease-in-out 0.2s forwards;
  border-radius: 50%;
}

.confetti-3 {
  left: 50%;
  background: #10b981;
  animation: confetti-fall 1.8s ease-in-out 0.4s forwards;
  border-radius: 2px;
}

.confetti-4 {
  left: 75%;
  background: #ec4899;
  animation: confetti-fall 2.2s ease-in-out 0.1s forwards;
  border-radius: 50%;
}

.confetti-5 {
  left: 90%;
  background: #8b5cf6;
  animation: confetti-fall 2s ease-in-out 0.3s forwards;
  border-radius: 2px;
}
`;

// 获取当前主步骤编号 (1-4)
function getMainStepIndex(step: WizardStep): number {
  if (step === "welcome") return 1;
  if (step === "select" || step === "verifying" || step === "confirm" || step === "failed") return 2;
  if (step === "config") return 3;
  if (step === "launch" || step === "done") return 4;
  return 1;
}

// 判断是否是主步骤流程中的步骤
function isMainStep(step: WizardStep): boolean {
  return step === "welcome" || step === "select" || step === "config" || step === "launch" || step === "done";
}

interface TargetWizardProps {
  windows: WindowInfo[];
  onComplete: (win: WindowInfo, verified: boolean, behavior: TargetBehavior) => void;
  onCancel: () => void;
}

// ─── StepIndicator 组件 ───
function StepIndicator({ currentStep }: { currentStep: WizardStep }) {
  const currentNum = getMainStepIndex(currentStep);
  const isComplete = currentStep === "done";
  const isFailed = currentStep === "failed";

  return (
    <div className="mb-6">
      {/* 步骤指示器头部 */}
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm text-slate-400">
          Step {currentNum} of 4
        </span>
        {!isComplete && !isFailed && (
          <span className="text-xs text-slate-500">
            {WIZARD_STEPS.find((s) => s.stepNum === currentNum)?.label}
          </span>
        )}
      </div>

      {/* 进度条 */}
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((num) => (
          <div
            key={num}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              num < currentNum
                ? "bg-indigo-500"
                : num === currentNum
                ? "bg-indigo-500 w-1/2"
                : "bg-white/[0.06]"
            }`}
          />
        ))}
      </div>

      {/* 步骤标签 */}
      <div className="flex justify-between mt-2">
        {WIZARD_STEPS.map((s) => (
          <div
            key={s.key}
            className={`text-xs transition-colors ${
              s.stepNum === currentNum
                ? "text-indigo-400 font-medium"
                : s.stepNum < currentNum
                ? "text-slate-500"
                : "text-slate-600"
            }`}
          >
            {s.label}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── 默认行为配置 ───
const DEFAULT_BEHAVIOR: TargetBehavior = {
  auto_enter: false,
  paste_delay_ms: 80,
  restore_clipboard_after_paste: true,
  focus_recipe: [],
  append_run_watermark: false,
};

export default function TargetWizard({ windows, onComplete, onCancel }: TargetWizardProps) {
  // 从 localStorage 恢复步骤状态
  const [step, setStep] = useState<WizardStep>(() => getWizardStep() || "welcome");
  const [selectedWin, setSelectedWin] = useState<WindowInfo | null>(null);
  const [testUuid, setTestUuid] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [trace, setTrace] = useState<DispatchTrace | null>(null);
  const [justCompletedFirst, setJustCompletedFirst] = useState(false);

  // 配置选项状态
  const [behavior, setBehavior] = useState<TargetBehavior>(DEFAULT_BEHAVIOR);

  // ─── Focus Trap & 无障碍支持 ───
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Focus Trap: Modal 打开时保存焦点并锁定在 Modal 内
  useEffect(() => {
    // 保存当前焦点元素
    previousActiveElement.current = document.activeElement as HTMLElement;

    // 聚焦到 Modal 内的第一个可聚焦元素
    const focusableElements = modalRef.current?.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (focusableElements && focusableElements.length > 0) {
      focusableElements[0].focus();
    } else {
      modalRef.current?.focus();
    }

    // 监听 Tab 键实现 focus trap
    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab" || !modalRef.current) return;

      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleTabKey);

    return () => {
      document.removeEventListener("keydown", handleTabKey);
      // 关闭时恢复焦点
      previousActiveElement.current?.focus();
    };
  }, []);

  // 步骤变化时同步到 localStorage
  useEffect(() => {
    if (step !== "done") {
      setWizardStep(step);
    }
  }, [step]);

  // 注入庆祝动画样式
  useEffect(() => {
    const styleId = "wizard-celebration-styles";
    if (!document.getElementById(styleId)) {
      const styleEl = document.createElement("style");
      styleEl.id = styleId;
      styleEl.textContent = CELEBRATION_STYLE;
      document.head.appendChild(styleEl);
    }
    return () => {
      // Don't remove on unmount to preserve animation if component re-renders
    };
  }, []);

  // 步骤导航
  const canGoBack = step !== "welcome" && step !== "done";
  const canGoNext = step === "config";

  const handleNext = () => {
    if (step === "select" && selectedWin) {
      // 选择目标后进入配置步骤
      setStep("config");
    } else if (step === "config") {
      // 配置完成后进入启动步骤
      setStep("launch");
    }
  };

  const handleBack = () => {
    if (step === "select" || step === "verifying" || step === "confirm" || step === "failed") {
      setStep("welcome");
    } else if (step === "config") {
      setStep("select");
    } else if (step === "launch") {
      setStep("config");
    }
  };

  // Step 2→3: 选择窗口后发送 UUID 粘贴测试
  const handleSelectAndVerify = async (win: WindowInfo) => {
    setSelectedWin(win);
    const uuid = `VERIFY-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
    setTestUuid(uuid);
    setStep("verifying");
    setVerifyError("");

    try {
      // §9.2: 粘贴测试，auto_enter=false（只粘贴不发送）
      const result = await dispatchStage({
        hwnd: win.hwnd,
        text: uuid,
        paste_delay_ms: 80,
        activate_retry: 3,
        activate_settle_delay_ms: 80,
        restore_clipboard: true,
        focus_recipe: [],
        append_watermark: false,
      });
      setTrace(result);
      setStep("confirm");
    } catch (e) {
      setVerifyError(String((e as { message?: string }).message || e));
      setStep("failed");
    }
  };

  // Step 3: 用户确认
  const handleConfirm = (sawIt: boolean) => {
    if (!selectedWin) return;
    if (sawIt) {
      // 验证通过 → 进入配置步骤
      setStep("config");
    } else {
      // 验证未通过 → 回到选择步骤让用户重试
      setStep("select");
    }
  };

  // Step 4: 启动完成
  const handleLaunch = () => {
    if (!selectedWin) return;
    // 标记首次目标创建
    const wasFirstTarget = !getFirstTargetCreated();
    if (wasFirstTarget) {
      setFirstTargetCreated();
      setJustCompletedFirst(true);
    }
    setWizardCompleted(true);
    setWizardStep("done");
    setStep("done");
    onComplete(selectedWin, true, behavior);
  };

  // 跳过引导
  const handleSkip = useCallback(() => {
    setWizardCompleted(true);
    setWizardStep("done");
    onCancel();
  }, [onCancel]);

  // 重新演示
  const handleReset = useCallback(() => {
    setWizardCompleted(false);
    try {
      localStorage.removeItem(WIZARD_STEP_KEY);
    } catch {
      // ignore
    }
    setStep("welcome");
    setSelectedWin(null);
    setBehavior(DEFAULT_BEHAVIOR);
  }, []);

  // 配置选项变更
  const updateBehavior = <K extends keyof TargetBehavior>(key: K, value: TargetBehavior[K]) => {
    setBehavior((prev) => ({ ...prev, [key]: value }));
  };

  const filteredWindows = windows.filter((w) => w.title.length > 0);

  // 判断是否显示导航按钮
  const showNavButtons = isMainStep(step) && step !== "done";

  return (
    <div
      className="fixed inset-0 bg-black/60 flex items-center justify-center z-50"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wizard-title"
    >
      <div
        ref={modalRef}
        className="bg-[#0a0f1e]/95 backdrop-blur-2xl rounded-2xl border border-white/[0.06] p-6 w-[700px] max-h-[80vh] overflow-auto shadow-2xl"
        tabIndex={-1}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <h3 id="wizard-title" className="text-lg font-semibold text-slate-200">
            {step === "welcome" && "欢迎使用目标向导"}
            {step === "select" && "步骤 2/4 — 选择目标窗口"}
            {step === "verifying" && "步骤 2/4 — 正在发送测试..."}
            {step === "confirm" && "步骤 2/4 — 确认粘贴结果"}
            {step === "failed" && "步骤 2/4 — 测试失败"}
            {step === "config" && "步骤 3/4 — 配置选项"}
            {step === "launch" && "步骤 4/4 — 启动目标"}
            {step === "done" && "目标设置完成"}
          </h3>
          <div className="flex items-center gap-2">
            {/* 重新演示按钮 */}
            {(step === "done" || step === "welcome") && (
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] rounded-lg transition-colors"
                title="重新演示"
              >
                <RotateCcw size={14} />
                重新演示
              </button>
            )}
            {/* 跳过按钮 */}
            {(step === "welcome" || step === "select") && (
              <button
                onClick={handleSkip}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] rounded-lg transition-colors"
                title="跳过引导"
              >
                <SkipForward size={14} />
                跳过
              </button>
            )}
            <button onClick={onCancel} className="text-slate-400 hover:text-slate-200 transition-colors ml-2">
              ✕
            </button>
          </div>
        </div>

        {/* 步骤指示器 - 不在 welcome 和 done 步骤显示 */}
        {step !== "welcome" && step !== "done" && <StepIndicator currentStep={step} />}

        {/* ─── Step 1: Welcome ─── */}
        {step === "welcome" && (
          <div className="space-y-6 py-4">
            <div className="flex flex-col items-center text-center">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center mb-4">
                <Sparkles size={32} className="text-indigo-400" />
              </div>
              <h2 className="text-xl font-bold text-slate-100 mb-2">欢迎使用 AI Workbench</h2>
              <p className="text-slate-400 max-w-md">
                通过几个简单步骤，您将学会如何设置自动化目标。目标窗口是 AI
                将要交互的应用程序窗口。
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="inner-panel rounded-xl p-4 text-center">
                <Monitor size={20} className="mx-auto text-blue-400 mb-2" />
                <div className="text-sm font-medium text-slate-300">选择窗口</div>
                <div className="text-xs text-slate-500 mt-1">选择要自动化的应用</div>
              </div>
              <div className="inner-panel rounded-xl p-4 text-center">
                <Settings2 size={20} className="mx-auto text-green-400 mb-2" />
                <div className="text-sm font-medium text-slate-300">配置选项</div>
                <div className="text-xs text-slate-500 mt-1">自定义粘贴行为</div>
              </div>
              <div className="inner-panel rounded-xl p-4 text-center">
                <Rocket size={20} className="mx-auto text-purple-400 mb-2" />
                <div className="text-sm font-medium text-slate-300">启动目标</div>
                <div className="text-xs text-slate-500 mt-1">验证并激活目标</div>
              </div>
            </div>

            <button
              onClick={() => setStep("select")}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 rounded-xl font-medium transition-colors"
            >
              开始设置
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* ─── Step 2: Select Window ─── */}
        {step === "select" && (
          <>
            <p className="text-sm text-slate-400 mb-4">
              检测到 {filteredWindows.length} 个窗口。选择一个作为目标，系统将向它发送一段测试文字（不按回车）来验证粘贴是否可用。
            </p>
            <div className="space-y-2 max-h-[50vh] overflow-auto">
              {filteredWindows.map((w) => (
                <button
                  key={w.hwnd}
                  onClick={() => handleSelectAndVerify(w)}
                  className="w-full text-left flex items-center justify-between px-4 py-3.5 inner-panel rounded-xl hover:border-indigo-500/30 transition-colors border border-transparent"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{w.title}</div>
                    <div className="text-xs text-slate-500">
                      HWND: {w.hwnd} | PID: {w.process_id} | exe: {w.exe_name ?? "–"} | class: {w.class_name}
                    </div>
                  </div>
                  <ArrowRight size={16} className="text-slate-500 ml-2" />
                </button>
              ))}
            </div>
          </>
        )}

        {/* ─── Step 2a: Verifying (sending UUID) ─── */}
        {step === "verifying" && (
          <div className="flex flex-col items-center py-12">
            <Loader2 size={40} className="animate-spin text-blue-400 mb-4" />
            <p className="text-slate-300 mb-2">正在向窗口发送测试文本...</p>
            <div className="font-mono text-lg text-yellow-300 inner-panel rounded-xl px-4 py-2">
              {testUuid}
            </div>
            <p className="text-xs text-slate-500 mt-3">
              窗口: {selectedWin?.title?.substring(0, 40)}
            </p>
          </div>
        )}

        {/* ─── Step 2b: Confirm — ask "did you see it?" ─── */}
        {step === "confirm" && (
          <div className="space-y-6">
            <div className="inner-panel rounded-xl p-5 text-center">
              <Clipboard size={28} className="mx-auto text-blue-400 mb-3" />
              <p className="text-slate-300 mb-2">
                系统已向 <span className="text-blue-300 font-medium">{selectedWin?.title?.substring(0, 40)}</span> 发送:
              </p>
              <div className="font-mono text-2xl text-yellow-300 bg-slate-900 inline-block px-6 py-3 rounded-lg">
                {testUuid}
              </div>
              <p className="text-xs text-slate-500 mt-3">
                请检查目标窗口的输入框中是否出现了上面的文字（不会按回车）
              </p>
            </div>

            {trace && (
              <div className="text-xs text-slate-600 inner-panel rounded-xl p-3 font-mono">
                trace_id: {trace.trace_id} · activation: {trace.activation_ok ? "✓" : "✗"} · 
                stage: {trace.stage_ok ? "✓" : "✗"} · duration: {trace.duration_ms}ms
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => handleConfirm(true)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-medium transition-colors"
              >
                <CheckCircle size={18} />
                看到了，验证通过
              </button>
              <button
                onClick={() => handleConfirm(false)}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600/80 hover:bg-red-700 rounded-lg font-medium transition-colors"
              >
                <XCircle size={18} />
                没看到，重试
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 2c: Failed ─── */}
        {step === "failed" && (
          <div className="space-y-4">
            <div className="flex flex-col items-center py-8">
              <XCircle size={48} className="text-red-400 mb-3" />
              <p className="text-slate-300 mb-2">粘贴测试失败</p>
              <p className="text-sm text-red-300 bg-red-900/20 rounded-lg px-4 py-2 max-w-full break-all">
                {verifyError}
              </p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => setStep("welcome")}
                className="flex-1 px-4 py-2 btn-secondary text-sm"
              >
                返回欢迎
              </button>
              <button
                onClick={() => selectedWin && handleSelectAndVerify(selectedWin)}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm font-medium transition-colors"
              >
                重试此窗口
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 3: Config Options ─── */}
        {step === "config" && (
          <div className="space-y-4">
            <p className="text-sm text-slate-400 mb-4">
              配置目标窗口的自动化行为。目标: <span className="text-blue-300">{selectedWin?.title?.substring(0, 40)}</span>
            </p>

            {/* 自动回车 */}
            <div className="flex items-center justify-between py-3 border-b border-white/[0.06]">
              <div>
                <div className="text-sm font-medium text-slate-200">自动回车 (Auto Enter)</div>
                <div className="text-xs text-slate-500">粘贴后自动发送回车键</div>
              </div>
              <button
                role="switch"
                aria-checked={behavior.auto_enter}
                aria-label="自动回车开关"
                onClick={() => updateBehavior("auto_enter", !behavior.auto_enter)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  behavior.auto_enter ? "bg-indigo-500" : "bg-slate-700"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                    behavior.auto_enter ? "translate-x-6" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {/* 粘贴延迟 */}
            <div className="py-3 border-b border-white/[0.06]">
              <div className="flex items-center justify-between mb-2">
                <div className="text-sm font-medium text-slate-200">粘贴延迟</div>
                <div className="text-sm text-indigo-400">{behavior.paste_delay_ms}ms</div>
              </div>
              <input
                type="range"
                min="20"
                max="500"
                step="10"
                value={behavior.paste_delay_ms}
                onChange={(e) => updateBehavior("paste_delay_ms", Number(e.target.value))}
                className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-500"
              />
              <div className="flex justify-between text-xs text-slate-600 mt-1">
                <span>20ms</span>
                <span>500ms</span>
              </div>
            </div>

            {/* 恢复剪贴板 */}
            <div className="flex items-center justify-between py-3 border-b border-white/[0.06]">
              <div>
                <div className="text-sm font-medium text-slate-200">恢复剪贴板</div>
                <div className="text-xs text-slate-500">粘贴后恢复原始剪贴板内容</div>
              </div>
              <button
                role="switch"
                aria-checked={behavior.restore_clipboard_after_paste}
                aria-label="恢复剪贴板开关"
                onClick={() => updateBehavior("restore_clipboard_after_paste", !behavior.restore_clipboard_after_paste)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  behavior.restore_clipboard_after_paste ? "bg-indigo-500" : "bg-slate-700"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                    behavior.restore_clipboard_after_paste ? "translate-x-6" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>

            {/* Run ID 水印 */}
            <div className="flex items-center justify-between py-3">
              <div>
                <div className="text-sm font-medium text-slate-200">附加 Run ID 水印</div>
                <div className="text-xs text-slate-500">在输出中附加运行标识</div>
              </div>
              <button
                role="switch"
                aria-checked={behavior.append_run_watermark}
                aria-label="附加Run ID水印开关"
                onClick={() => updateBehavior("append_run_watermark", !behavior.append_run_watermark)}
                className={`w-12 h-6 rounded-full transition-colors ${
                  behavior.append_run_watermark ? "bg-indigo-500" : "bg-slate-700"
                }`}
              >
                <div
                  className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                    behavior.append_run_watermark ? "translate-x-6" : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {/* ─── Step 4: Launch ─── */}
        {step === "launch" && (
          <div className="space-y-6">
            <div className="flex flex-col items-center py-6">
              <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-indigo-500/30 flex items-center justify-center mb-4">
                <Rocket size={40} className="text-indigo-400" />
              </div>
              <h2 className="text-lg font-bold text-slate-100 mb-2">准备就绪!</h2>
              <p className="text-sm text-slate-400 text-center">
                目标窗口已验证并配置完成。<br />
                点击下方按钮启动自动化目标。
              </p>
            </div>

            {/* 配置摘要 */}
            <div className="inner-panel rounded-xl p-4 space-y-2">
              <div className="text-xs text-slate-500 mb-2">配置摘要</div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">目标窗口</span>
                <span className="text-slate-200 truncate ml-2">{selectedWin?.title?.substring(0, 30)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">自动回车</span>
                <span className={behavior.auto_enter ? "text-green-400" : "text-slate-500"}>
                  {behavior.auto_enter ? "开启" : "关闭"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">粘贴延迟</span>
                <span className="text-slate-200">{behavior.paste_delay_ms}ms</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">恢复剪贴板</span>
                <span className={behavior.restore_clipboard_after_paste ? "text-green-400" : "text-slate-500"}>
                  {behavior.restore_clipboard_after_paste ? "开启" : "关闭"}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Run ID 水印</span>
                <span className={behavior.append_run_watermark ? "text-green-400" : "text-slate-500"}>
                  {behavior.append_run_watermark ? "开启" : "关闭"}
                </span>
              </div>
            </div>

            <button
              onClick={handleLaunch}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 rounded-xl font-medium transition-all shadow-lg shadow-indigo-500/20"
            >
              <Rocket size={18} />
              启动目标
            </button>
          </div>
        )}

        {/* ─── Step 5: Done ─── */}
        {step === "done" && (
          <div className="flex flex-col items-center py-12 relative overflow-hidden">
            {/* 庆祝动画 - CSS confetti effect */}
            {justCompletedFirst && (
              <div className="absolute inset-0 pointer-events-none overflow-hidden">
                <div className="confetti-1" />
                <div className="confetti-2" />
                <div className="confetti-3" />
                <div className="confetti-4" />
                <div className="confetti-5" />
              </div>
            )}

            <CheckCircle size={64} className="text-green-400 mb-4 animate-bounce-in" />
            <p className="text-slate-200 text-lg font-medium mb-2">目标已成功设置!</p>
            <p className="text-slate-500 text-sm mb-4">您现在可以使用此目标进行自动化操作</p>

            {/* 首次创建奖励提示 */}
            {justCompletedFirst && (
              <div className="mt-4 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20 animate-fade-in">
                <div className="flex items-center gap-2 mb-2">
                  <Unlock size={16} className="text-amber-400" />
                  <span className="text-sm font-medium text-amber-300">恭喜解锁新功能!</span>
                </div>
                <p className="text-xs text-slate-400">
                  您已完成首次目标设置。高级自动化功能已解锁使用。
                </p>
              </div>
            )}

            {/* 重新演示按钮 (底部) */}
            <button
              onClick={handleReset}
              className="mt-6 flex items-center gap-2 px-4 py-2 text-sm text-slate-400 hover:text-slate-200 hover:bg-white/[0.06] rounded-lg transition-colors"
            >
              <RotateCcw size={14} />
              重新演示
            </button>
          </div>
        )}

        {/* ─── 导航按钮 ─── */}
        {showNavButtons && (
          <div className="flex justify-between mt-6 pt-4 border-t border-white/[0.06]">
            <button
              onClick={handleBack}
              disabled={!canGoBack}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                canGoBack
                  ? "text-slate-300 hover:bg-white/[0.06]"
                  : "text-slate-600 cursor-not-allowed"
              }`}
            >
              <ArrowLeft size={16} />
              上一步
            </button>

            {canGoNext && (
              <button
                onClick={handleNext}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-medium transition-colors"
              >
                下一步
                <ArrowRight size={16} />
              </button>
            )}

            {/* 步骤提示 */}
            <div className="text-xs text-slate-600 self-center">
              {step === "welcome" && "开始引导流程"}
              {step === "select" && "选择一个目标窗口"}
              {step === "config" && "自定义自动化行为"}
              {step === "launch" && "确认并启动"}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}