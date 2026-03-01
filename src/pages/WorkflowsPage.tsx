import { useState, useMemo } from "react";
import { useAppState } from "../store/AppStore";
import { SkeletonList } from "../components/Skeleton";
import { GitBranch, ArrowRight, ChevronDown, ChevronRight, Timer, RefreshCw, AlertTriangle, CheckCircle, Layers } from "lucide-react";
import { analyzeDag, validateWorkflowDag } from "../domain/workflow-engine";
import type { Workflow } from "../types";

export default function WorkflowsPage() {
  const { workflows, initialized } = useAppState();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!initialized) {
    return <div className="p-6"><SkeletonList count={3} /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Workflows 工作流</h2>
        <p className="text-slate-400 mt-1">
          已注册 {workflows.length} 个工作流 · DAG++ Schema v3
        </p>
      </div>

      <div className="space-y-4">
        {workflows.map((wf) => (
          <div
            key={wf.id}
            className="bg-[#1e293b] rounded-xl border border-[#334155] overflow-hidden"
          >
            {/* Header */}
            <button
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#263548] transition-colors"
              onClick={() => setExpanded(expanded === wf.id ? null : wf.id)}
            >
              <div className="flex items-center gap-3">
                <GitBranch size={20} className="text-purple-400" />
                <div className="text-left">
                  <div className="font-semibold text-lg">{wf.title}</div>
                  <div className="text-xs text-slate-500">
                    {wf.id} · v{wf.version} · {wf.steps.length} steps
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">
                  {wf.policy.fail_policy}
                </span>
                {expanded === wf.id ? (
                  <ChevronDown size={18} className="text-slate-400" />
                ) : (
                  <ChevronRight size={18} className="text-slate-400" />
                )}
              </div>
            </button>

            {/* Steps Pipeline */}
            <div className="px-5 pb-4">
              <div className="flex items-center gap-2 flex-wrap">
                {wf.steps.map((step, i) => (
                  <div key={step.id || i} className="flex items-center gap-2">
                    <div className="bg-[#0f172a] border border-[#334155] rounded-lg px-4 py-3">
                      <div className="text-sm font-medium text-blue-300">
                        {step.id || `Step ${i + 1}`}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">
                        {step.use}
                      </div>
                      {step.depends_on.length > 0 && (
                        <div className="text-[10px] text-slate-600 mt-1">
                          depends: {step.depends_on.join(", ")}
                        </div>
                      )}
                      <div className="flex gap-1 mt-2 flex-wrap">
                        {step.dispatch?.prefer_providers?.map((p) => (
                          <span
                            key={p}
                            className="text-[10px] px-1.5 py-0.5 bg-purple-600/20 text-purple-300 rounded"
                          >
                            {p}
                          </span>
                        ))}
                        {step.timeout_ms > 0 && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">
                            <Timer size={8} className="inline mr-0.5" />
                            {step.timeout_ms}ms
                          </span>
                        )}
                        {step.retry_policy && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">
                            <RefreshCw size={8} className="inline mr-0.5" />
                            ×{step.retry_policy.max_retries}
                          </span>
                        )}
                      </div>
                    </div>
                    {i < wf.steps.length - 1 && (
                      <ArrowRight size={16} className="text-slate-500" />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Expanded details */}
            {expanded === wf.id && (
              <ExpandedWorkflowDetails wf={wf} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ───── DAG 分析 + 步骤详情 ─────

function ExpandedWorkflowDetails({ wf }: { wf: Workflow }) {
  const dag = useMemo(() => analyzeDag(wf), [wf]);
  const issues = useMemo(() => validateWorkflowDag(wf), [wf]);

  return (
    <div className="px-5 pb-5 border-t border-[#334155] pt-4 space-y-4">
      {/* §7 DAG 分析 */}
      <div>
        <h4 className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
          <Layers size={14} className="text-purple-400" />
          DAG 拓扑分析
        </h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 text-xs mb-3">
          <div className="px-3 py-2 bg-[#0f172a] rounded">
            <span className="text-slate-500">深度: </span>
            <span className="text-slate-300">{dag.maxDepth + 1} 层</span>
          </div>
          <div className="px-3 py-2 bg-[#0f172a] rounded">
            <span className="text-slate-500">拓扑序: </span>
            <span className="text-slate-300">{dag.topoOrder.join(" → ")}</span>
          </div>
          <div className={`px-3 py-2 rounded ${dag.hasCycle ? "bg-red-900/20" : "bg-[#0f172a]"}`}>
            <span className="text-slate-500">环检测: </span>
            <span className={dag.hasCycle ? "text-red-400" : "text-green-400"}>
              {dag.hasCycle ? "❌ 有环" : "✓ 无环"}
            </span>
          </div>
          <div className="px-3 py-2 bg-[#0f172a] rounded">
            <span className="text-slate-500">不可达: </span>
            <span className={dag.unreachable.length > 0 ? "text-yellow-400" : "text-green-400"}>
              {dag.unreachable.length > 0 ? dag.unreachable.join(", ") : "无"}
            </span>
          </div>
        </div>

        {/* Parallel layers visualization */}
        <div className="space-y-2">
          {dag.layers.map((layer, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="text-[10px] text-slate-600 w-12 shrink-0">Layer {i}</span>
              <div className="flex gap-1 flex-wrap">
                {layer.map((stepId) => (
                  <span key={stepId} className="px-2 py-1 text-xs bg-purple-600/20 text-purple-300 rounded font-mono">
                    {stepId}
                  </span>
                ))}
              </div>
              {layer.length > 1 && (
                <span className="text-[10px] text-blue-400">⇆ 可并行</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 验证问题 */}
      {issues.length > 0 && (
        <div className="bg-yellow-900/10 border border-yellow-800/30 rounded-lg p-3">
          <h4 className="text-sm font-semibold text-yellow-400 mb-2 flex items-center gap-2">
            <AlertTriangle size={14} />
            DAG 验证问题 ({issues.length})
          </h4>
          <ul className="list-disc list-inside text-xs text-yellow-300/80 space-y-1">
            {issues.map((issue, i) => <li key={i}>{issue}</li>)}
          </ul>
        </div>
      )}

      {issues.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-green-400">
          <CheckCircle size={14} />
          DAG 验证通过 — 可发布
        </div>
      )}

      {/* Graph Policy */}
      <div>
        <h4 className="text-sm font-semibold text-slate-300 mb-2">Graph Policy</h4>
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-2 text-xs">
          {Object.entries({
            max_parallelism: wf.policy.max_parallelism,
            global_timeout: `${wf.policy.global_timeout_ms}ms`,
            fail_policy: wf.policy.fail_policy,
            checkpoint: wf.policy.checkpoint_policy,
            resume: wf.policy.resume_policy,
            merge: wf.policy.merge_strategy,
          }).map(([k, v]) => (
            <div key={k} className="px-3 py-2 bg-[#0f172a] rounded">
              <span className="text-slate-500">{k}: </span>
              <span className="text-slate-300">{v}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Steps 详情 */}
      <div>
        <h4 className="text-sm font-semibold text-slate-300 mb-2">Steps 详情</h4>
        <div className="space-y-2">
          {wf.steps.map((step, i) => {
            const node = dag.nodes.get(step.id ?? step.use);
            return (
              <div key={step.id || i} className="bg-[#0f172a] rounded-lg p-3 border border-[#334155] text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-blue-300 font-medium">{step.id || `step_${i + 1}`}</span>
                  <div className="flex items-center gap-2">
                    {node && <span className="text-[10px] text-slate-600">Level {node.level}</span>}
                    <span className="text-slate-500">use: {step.use}</span>
                  </div>
                </div>
                {step.depends_on.length > 0 && (
                  <div className="text-slate-500">depends: {step.depends_on.join(", ")}</div>
                )}
                {node && node.successors.length > 0 && (
                  <div className="text-purple-400/70">→ {node.successors.join(", ")}</div>
                )}
                {step.retry_policy && (
                  <div className="text-slate-500">
                    retry: max={step.retry_policy.max_retries}, delay={step.retry_policy.delay_ms}ms, backoff={step.retry_policy.backoff}
                  </div>
                )}
                {step.compensation && <div className="text-yellow-400/70">compensation: {step.compensation}</div>}
                {step.emit_events.length > 0 && <div className="text-slate-500">emit: {step.emit_events.join(", ")}</div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}