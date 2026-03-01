import { useState } from "react";
import { useAppState } from "../store/AppStore";
import { SkeletonList } from "../components/Skeleton";
import { Zap, ChevronDown, ChevronRight, Shield, Clock, Tag } from "lucide-react";

export default function SkillsPage() {
  const { skills, initialized } = useAppState();
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!initialized) {
    return <div className="p-6"><SkeletonList count={5} /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Skills 技能库</h2>
        <p className="text-slate-400 mt-1">
          已注册 {skills.length} 个技能 · Schema v3，点击展开查看详情
        </p>
      </div>

      <div className="space-y-3">
        {skills.map((skill) => (
          <div
            key={skill.id}
            className="bg-[#1e293b] rounded-xl border border-[#334155] overflow-hidden"
          >
            <button
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-[#263548] transition-colors"
              onClick={() =>
                setExpanded(expanded === skill.id ? null : skill.id)
              }
            >
              <div className="flex items-center gap-3">
                <Zap size={18} className="text-yellow-400" />
                <div className="text-left">
                  <div className="font-medium">{skill.title}</div>
                  <div className="text-xs text-slate-500">
                    {skill.id} · v{skill.version}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {skill.dispatch?.prefer_providers && (
                  <div className="flex gap-1">
                    {skill.dispatch.prefer_providers.map((p) => (
                      <span
                        key={p}
                        className="text-xs px-2 py-0.5 bg-blue-600/20 text-blue-300 rounded"
                      >
                        {p}
                      </span>
                    ))}
                  </div>
                )}
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded ${
                    skill.safety_level === "safe"
                      ? "bg-green-600/20 text-green-300"
                      : skill.safety_level === "caution"
                      ? "bg-yellow-600/20 text-yellow-300"
                      : "bg-red-600/20 text-red-300"
                  }`}
                >
                  <Shield size={8} className="inline mr-0.5" />
                  {skill.safety_level}
                </span>
                {expanded === skill.id ? (
                  <ChevronDown size={18} className="text-slate-400" />
                ) : (
                  <ChevronRight size={18} className="text-slate-400" />
                )}
              </div>
            </button>

            {expanded === skill.id && (
              <div className="px-5 pb-4 border-t border-[#334155] pt-4 space-y-4">
                {/* Intent Tags */}
                {skill.intent_tags.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag size={14} className="text-purple-400" />
                    {skill.intent_tags.map((t) => (
                      <span
                        key={t}
                        className="text-xs px-2 py-0.5 bg-purple-600/20 text-purple-300 rounded"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}

                {/* Metadata badges */}
                <div className="flex gap-2 flex-wrap text-[10px]">
                  <span className="px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">
                    <Clock size={8} className="inline mr-0.5" />
                    {skill.latency_class}
                  </span>
                  <span className="px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">
                    💰 {skill.cost_class}
                  </span>
                  <span className="px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">
                    🎲 {skill.determinism}
                  </span>
                  {skill.cache_policy && (
                    <span className="px-1.5 py-0.5 bg-slate-700 text-slate-400 rounded">
                      📦 {skill.cache_policy}
                    </span>
                  )}
                </div>

                {/* Inputs */}
                {Object.keys(skill.inputs).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-2">
                      输入参数
                    </h4>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(skill.inputs).map(([key, input]) => (
                        <div
                          key={key}
                          className="px-3 py-2 bg-[#0f172a] rounded text-sm"
                        >
                          <span className="text-blue-300">{key}</span>
                          <span className="text-slate-500 ml-2">
                            ({input.type}
                            {input.required ? ", 必填" : ""})
                          </span>
                          {input.description && (
                            <div className="text-xs text-slate-600 mt-0.5">
                              {input.description}
                            </div>
                          )}
                          {input.max_length && (
                            <div className="text-xs text-slate-600">
                              最大长度: {input.max_length}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prompt Template */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-2">
                    Prompt 模板
                  </h4>
                  <pre className="bg-[#0f172a] rounded-lg p-4 text-sm text-slate-300 overflow-x-auto whitespace-pre-wrap font-mono">
                    {skill.prompt_template}
                  </pre>
                </div>

                {/* Quality Gates */}
                {skill.quality_gates.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-2">
                      Quality Gates
                    </h4>
                    <div className="space-y-1">
                      {skill.quality_gates.map((g, i) => (
                        <div
                          key={i}
                          className="px-3 py-2 bg-[#0f172a] rounded text-xs text-slate-400"
                        >
                          {g.min_length && <span>min_length: {g.min_length} </span>}
                          {g.max_length && <span>max_length: {g.max_length} </span>}
                          {g.must_contain.length > 0 && (
                            <span>must_contain: [{g.must_contain.join(", ")}] </span>
                          )}
                          {g.must_not_contain.length > 0 && (
                            <span>must_not_contain: [{g.must_not_contain.join(", ")}]</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Fallbacks */}
                {skill.fallbacks.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-2">
                      Fallbacks
                    </h4>
                    {skill.fallbacks.map((f, i) => (
                      <div key={i} className="px-3 py-2 bg-[#0f172a] rounded text-xs text-slate-400">
                        action: {f.action} · providers: [{f.fallback_providers.join(", ")}]
                        {f.fallback_skill && ` · skill: ${f.fallback_skill}`}
                      </div>
                    ))}
                  </div>
                )}

                {/* Dispatch */}
                {skill.dispatch && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-2">
                      分发策略
                    </h4>
                    <div className="bg-[#0f172a] rounded-lg p-4 text-sm space-y-1">
                      <div>
                        模式:{" "}
                        <span className="text-green-300">
                          {skill.dispatch.mode}
                        </span>
                      </div>
                      {skill.dispatch.prefer_providers.length > 0 && (
                        <div>
                          优先 Provider:{" "}
                          {skill.dispatch.prefer_providers.join(" → ")}
                        </div>
                      )}
                      <div className="text-xs text-slate-500">
                        timeout: {skill.dispatch.timeout_ms}ms · retry: {skill.dispatch.retry_count}
                      </div>
                    </div>
                  </div>
                )}

                {/* Observability */}
                {skill.observability && (
                  <div className="text-xs text-slate-500">
                    Observability: emit_start={String(skill.observability.emit_start)},
                    emit_end={String(skill.observability.emit_end)},
                    emit_error={String(skill.observability.emit_error)}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
