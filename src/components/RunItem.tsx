import React from "react";
import { ShieldAlert, AlertTriangle } from "lucide-react";
import { RUN_STATUS } from "../domain/dictionary";
import type { RunRecord } from "../types";

interface RunItemProps {
  run: RunRecord;
}

const RunItem = React.memo(({ run }: RunItemProps) => {
  return (
    <div className="flex items-center justify-between px-4 py-3 inner-panel rounded-xl text-sm transition-colors duration-200">
      <div className="flex items-center gap-3">
        <div
          className={`w-2 h-2 rounded-full ${
            RUN_STATUS[run.status]?.dot ?? "bg-slate-400"
          }`}
          aria-label={`状态: ${RUN_STATUS[run.status]?.label ?? "未知"}`}
          role="status"
        />
        <span className="font-medium">{run.skill_id}</span>
        <span className="text-slate-500">{"\u2192"}</span>
        <span className="text-blue-300">{run.target_id}</span>
        {run.error_code && run.error_code.startsWith("SECURITY_") && (
          <span
            className="badge bg-red-900/40 text-red-300 border border-red-800/50 flex items-center gap-1 cursor-help"
            title={run.error_code}
          >
            <ShieldAlert size={12} /> 被拦截
          </span>
        )}
        {run.error_code && run.error_code.startsWith("AGENT_LOOP_") && (
          <span
            className="badge bg-yellow-900/40 text-yellow-300 border border-yellow-800/50 flex items-center gap-1 cursor-help"
            title={run.error_code}
          >
            <AlertTriangle size={12} /> 循环警告
          </span>
        )}
        {run.trace_id && (
          <span className="text-[10px] text-slate-600 font-mono ml-2">
            {run.trace_id.substring(0, 12)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-4">
        {run.error_code &&
          !run.error_code.startsWith("SECURITY_") &&
          !run.error_code.startsWith("AGENT_LOOP_") && (
            <span className="text-red-400 text-xs">{run.error_code}</span>
          )}
        <span className="text-slate-500 text-xs font-mono">
          {new Date(run.ts_start).toLocaleTimeString()}
        </span>
      </div>
    </div>
  );
}, (prev, next) => {
  // Only re-render if fundamental properties change. 
  // ts_start or error_code or status
  return (
    prev.run.id === next.run.id &&
    prev.run.status === next.run.status &&
    prev.run.error_code === next.run.error_code
  );
});

export default RunItem;
