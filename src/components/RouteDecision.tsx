import { Route } from "lucide-react";
import type { RouteDecision } from "../types";
import { recordRouteFeedback } from "../domain/actions";

interface RouteDecisionProps {
  decision: RouteDecision;
}

export default function RouteDecision({ decision }: RouteDecisionProps) {
  const handleAccept = () => {
    recordRouteFeedback(decision.trace_id, decision.decision_intent, "accept", undefined);
  };

  const handleReject = () => {
    recordRouteFeedback(decision.trace_id, decision.decision_intent, "reject", undefined);
  };

  return (
    <div className="glass-card-static p-4">
      <h3 className="text-sm font-medium text-slate-300 mb-2 flex items-center gap-2">
        <Route size={14} className="text-emerald-400" />
        {"路由决策"}
      </h3>
      <div className="text-xs text-slate-400 space-y-1">
        <div>
          {"动作: "}
          <span
            className={
              decision.action === "auto_execute"
                ? "text-green-300"
                : decision.action === "user_confirm"
                ? "text-yellow-300"
                : "text-slate-300"
            }
          >
            {{ auto_execute: "自动执行", user_confirm: "需确认", fallback_default: "默认回退" }[decision.action] ?? decision.action}
          </span>{" "}
          {"· 置信度 "}{(decision.confidence * 100).toFixed(0)}%
        </div>
        <div className="text-slate-500">{decision.explanation}</div>
        {decision.top_candidates.length > 0 && (
          <div className="flex gap-1 mt-1">
            {decision.top_candidates.map((c) => (
              <span
                key={c.intent}
                className="badge badge-slate text-[10px]"
              >
                {c.intent} ({(c.score * 100).toFixed(0)}%)
              </span>
            ))}
          </div>
        )}
        <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
          <button
            onClick={handleAccept}
            style={{
              padding: "6px 16px",
              backgroundColor: "#22c55e",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            ✓ Accept
          </button>
          <button
            onClick={handleReject}
            style={{
              padding: "6px 16px",
              backgroundColor: "#ef4444",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            ✗ Reject
          </button>
        </div>
      </div>
    </div>
  );
}