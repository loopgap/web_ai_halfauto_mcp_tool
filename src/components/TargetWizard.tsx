// ═══════════════════════════════════════════════════════════
// §9.2 Target Setup Wizard — 验证粘贴向导
// 流程: 选择窗口 → 发送 UUID 测试 → 用户确认看到/没看到
// ═══════════════════════════════════════════════════════════

import { useState } from "react";
import { dispatchStage } from "../api";
import type { WindowInfo, DispatchTrace } from "../types";
import { CheckCircle, XCircle, Clipboard, Loader2, ArrowRight } from "lucide-react";

type WizardStep = "select" | "verifying" | "confirm" | "done" | "failed";

interface TargetWizardProps {
  windows: WindowInfo[];
  onComplete: (win: WindowInfo, verified: boolean) => void;
  onCancel: () => void;
}

export default function TargetWizard({ windows, onComplete, onCancel }: TargetWizardProps) {
  const [step, setStep] = useState<WizardStep>("select");
  const [selectedWin, setSelectedWin] = useState<WindowInfo | null>(null);
  const [testUuid, setTestUuid] = useState("");
  const [verifyError, setVerifyError] = useState("");
  const [trace, setTrace] = useState<DispatchTrace | null>(null);

  // Step 1→2: 选择窗口后发送 UUID 粘贴测试
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
      setStep("done");
      onComplete(selectedWin, true);
    } else {
      // 验证未通过 → 回到选择步骤让用户重试，不落库
      setStep("select");
    }
  };

  const filteredWindows = windows.filter((w) => w.title.length > 0);

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#1e293b] rounded-2xl border border-[#334155] p-6 w-[700px] max-h-[80vh] overflow-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">
            {step === "select" && "步骤 1/3 — 选择目标窗口"}
            {step === "verifying" && "步骤 2/3 — 正在发送测试..."}
            {step === "confirm" && "步骤 2/3 — 确认粘贴结果"}
            {step === "failed" && "步骤 2/3 — 测试失败"}
            {step === "done" && "步骤 3/3 — 完成"}
          </h3>
          <button onClick={onCancel} className="text-slate-400 hover:text-slate-200">✕</button>
        </div>

        {/* Progress bar */}
        <div className="flex gap-1 mb-6">
          {["select", "confirm", "done"].map((s, i) => (
            <div
              key={s}
              className={`h-1 flex-1 rounded-full transition-colors ${
                i <= (step === "select" ? 0 : step === "verifying" || step === "confirm" || step === "failed" ? 1 : 2)
                  ? "bg-blue-500"
                  : "bg-slate-700"
              }`}
            />
          ))}
        </div>

        {/* Step 1: Select Window */}
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
                  className="w-full text-left flex items-center justify-between px-4 py-3 bg-[#0f172a] rounded-lg hover:bg-[#162032] transition-colors border border-transparent hover:border-blue-500/50"
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

        {/* Step 2a: Verifying (sending UUID) */}
        {step === "verifying" && (
          <div className="flex flex-col items-center py-12">
            <Loader2 size={40} className="animate-spin text-blue-400 mb-4" />
            <p className="text-slate-300 mb-2">正在向窗口发送测试文本...</p>
            <div className="font-mono text-lg text-yellow-300 bg-[#0f172a] px-4 py-2 rounded-lg">
              {testUuid}
            </div>
            <p className="text-xs text-slate-500 mt-3">
              窗口: {selectedWin?.title?.substring(0, 40)}
            </p>
          </div>
        )}

        {/* Step 2b: Confirm — ask "did you see it?" */}
        {step === "confirm" && (
          <div className="space-y-6">
            <div className="bg-[#0f172a] rounded-xl p-5 text-center">
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
              <div className="text-xs text-slate-600 bg-[#0f172a] rounded-lg p-3 font-mono">
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

        {/* Step 2c: Failed */}
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
                onClick={() => setStep("select")}
                className="flex-1 px-4 py-2 bg-[#0f172a] border border-[#334155] rounded-lg text-sm hover:bg-[#162032] transition-colors"
              >
                返回重选
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

        {/* Step 3: Done */}
        {step === "done" && (
          <div className="flex flex-col items-center py-12">
            <CheckCircle size={48} className="text-green-400 mb-3" />
            <p className="text-slate-300">目标已添加</p>
          </div>
        )}
      </div>
    </div>
  );
}
