import { AlertCircle } from "lucide-react";
import { getRecoveryActions } from "../domain/actions";

export interface ErrorRecoveryPanelProps {
  errorMsg: string;
  lastErrorCode: string;
  onAction: (action: string) => void;
}

export default function ErrorRecoveryPanel({ errorMsg, lastErrorCode, onAction }: ErrorRecoveryPanelProps) {
  return (
    <div className="bg-red-900/30 border border-red-800 rounded-lg p-4 space-y-3">
      <div className="flex items-start gap-2 text-sm text-red-300">
        <AlertCircle size={16} className="mt-0.5 shrink-0" />
        <pre className="whitespace-pre-wrap text-xs flex-1">{errorMsg}</pre>
      </div>
      {lastErrorCode && (
        <div className="flex gap-2 pl-6">
          {getRecoveryActions(lastErrorCode).map((ra) => (
            <button
              key={ra.action}
              onClick={() => onAction(ra.action)}
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
  );
}
