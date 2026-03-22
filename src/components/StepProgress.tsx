import React from 'react';
// ═══════════════════════════════════════════════════════════
// §45 阶段进度条 — 调度全链路可视化
// preflight → route → stage → confirm → capture → archive
// ═══════════════════════════════════════════════════════════

import { CheckCircle, Loader2, Circle } from "lucide-react";
import { DISPATCH_STAGES, getDispatchStageIndex } from "../domain/dictionary";

interface StepProgressProps {
  /** 当前页面状态 (idle/validating/dispatching/waiting_capture/archived/error) */
  pageState: string;
  /** 是否显示 (仅在调度过程中显示) */
  visible?: boolean;
}

export default React.memo(function StepProgress({ pageState, visible }: StepProgressProps) {
  const activeIndex = getDispatchStageIndex(pageState);

  // 非调度流程中不显示
  if (!visible && activeIndex < 0) return null;

  return (
    <div className="flex items-center gap-1" role="progressbar" aria-label="调度进度">
      {DISPATCH_STAGES.map((stage, i) => {
        const isDone = i < activeIndex;
        const isActive = i === activeIndex;
        const isPending = i > activeIndex;

        return (
          <div key={stage.key} className="flex items-center gap-1">
            {/* Step indicator */}
            <div
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs transition-colors ${
                isDone
                  ? "bg-emerald-900/30 text-emerald-300"
                  : isActive
                  ? "bg-blue-900/40 text-blue-300 font-medium"
                  : "text-slate-600"
              }`}
            >
              {isDone && <CheckCircle size={12} className="text-emerald-400" />}
              {isActive && <Loader2 size={12} className="animate-spin text-blue-400" />}
              {isPending && <Circle size={12} className="text-slate-700" />}
              <span>{stage.label}</span>
            </div>
            {/* Connector line */}
            {i < DISPATCH_STAGES.length - 1 && (
              <div
                className={`w-4 h-px ${
                  isDone ? "bg-emerald-600" : "bg-slate-700"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
});
