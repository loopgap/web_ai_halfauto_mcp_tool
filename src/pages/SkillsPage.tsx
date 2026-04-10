import { useState } from "react";
import { useAppStore } from '../store/AppStore';
import { SkeletonList } from "../components/Skeleton";
import { Zap, ChevronDown, ChevronRight, Shield, Clock, Tag } from "lucide-react";

export default function SkillsPage() {
  const skills = useAppStore(s => s.skills);
  const initialized = useAppStore(s => s.initialized);
  const [expanded, setExpanded] = useState<string | null>(null);

  if (!initialized) {
    return <div className="p-8"><SkeletonList count={5} /></div>;
  }

  return (
    <div className="p-8 space-y-8">
      <div className="animate-fade-in-up">
        <h2 className="text-2xl font-bold text-gradient">Skills</h2>
        <p className="text-slate-500 text-sm mt-1">
          已注册 {skills.length} 个技能 · Schema v3
        </p>
      </div>

      <div className="space-y-3">
        {skills.map((skill, idx) => (
          <div
            key={skill.id}
            className="glass-card overflow-hidden animate-fade-in-up"
            style={{ animationDelay: `${idx * 50}ms` }}
          >
            <button
              className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/[0.02] transition-colors"
              onClick={() =>
                setExpanded(expanded === skill.id ? null : skill.id)
              }
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-amber-500/15 flex items-center justify-center">
                  <Zap size={16} className="text-amber-400" />
                </div>
                <div className="text-left">
                  <div className="font-medium">{skill.title}</div>
                  <div className="text-xs text-slate-600">
                    {skill.id} · v{skill.version}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {skill.dispatch?.prefer_providers && (
                  <div className="flex gap-1.5">
                    {skill.dispatch.prefer_providers.map((p) => (
                      <span key={p} className="badge badge-blue text-[10px]">{p}</span>
                    ))}
                  </div>
                )}
                <span className={`badge text-[10px] ${
                  skill.safety_level === "safe" ? "badge-green"
                  : skill.safety_level === "caution" ? "badge-yellow" : "badge-red"
                }`}>
                  <Shield size={8} /> {skill.safety_level}
                </span>
                {expanded === skill.id ? (
                  <ChevronDown size={18} className="text-slate-500" />
                ) : (
                  <ChevronRight size={18} className="text-slate-500" />
                )}
              </div>
            </button>

            {expanded === skill.id && (
              <div className="px-5 pb-5 border-t border-white/[0.06] pt-4 space-y-4">
                {/* Intent Tags */}
                {skill.intent_tags.length > 0 && (
                  <div className="flex items-center gap-2 flex-wrap">
                    <Tag size={14} className="text-purple-400" />
                    {skill.intent_tags.map((t) => (
                      <span key={t} className="badge badge-purple text-[10px]">{t}</span>
                    ))}
                  </div>
                )}

                {/* Metadata badges */}
                <div className="flex gap-2 flex-wrap">
                  <span className="badge badge-slate text-[10px]">
                    <Clock size={8} /> {skill.latency_class}
                  </span>
                  <span className="badge badge-slate text-[10px]">
                    cost: {skill.cost_class}
                  </span>
                  <span className="badge badge-slate text-[10px]">
                    {skill.determinism}
                  </span>
                  {skill.cache_policy && (
                    <span className="badge badge-slate text-[10px]">
                      cache: {skill.cache_policy}
                    </span>
                  )}
                </div>

                {/* Inputs */}
                {Object.keys(skill.inputs).length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-2">输入参数</h4>
                    <div className="grid grid-cols-2 gap-2">
                      {Object.entries(skill.inputs).map(([key, input]) => (
                        <div key={key} className="px-3.5 py-2.5 inner-panel rounded-xl text-sm">
                          <span className="text-indigo-300">{key}</span>
                          <span className="text-slate-500 ml-2">
                            ({input.type}{input.required ? ", 必填" : ""})
                          </span>
                          {input.description && (
                            <div className="text-xs text-slate-600 mt-0.5">{input.description}</div>
                          )}
                          {input.max_length && (
                            <div className="text-xs text-slate-600">最大长度: {input.max_length}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Prompt Template */}
                <div>
                  <h4 className="text-sm font-semibold text-slate-300 mb-2">Prompt 模板</h4>
                  <pre className="inner-panel rounded-xl p-4 text-sm text-slate-300 overflow-x-auto whitespace-pre-wrap font-mono">
                    {skill.prompt_template}
                  </pre>
                </div>

                {/* Quality Gates */}
                {skill.quality_gates.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-2">Quality Gates</h4>
                    <div className="space-y-1">
                      {skill.quality_gates.map((g, i) => (
                        <div key={i} className="px-3.5 py-2.5 inner-panel rounded-xl text-xs text-slate-400">
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
                    <h4 className="text-sm font-semibold text-slate-300 mb-2">Fallbacks</h4>
                    {skill.fallbacks.map((f, i) => (
                      <div key={i} className="px-3.5 py-2.5 inner-panel rounded-xl text-xs text-slate-400">
                        action: {f.action} · providers: [{f.fallback_providers.join(", ")}]
                        {f.fallback_skill && ` · skill: ${f.fallback_skill}`}
                      </div>
                    ))}
                  </div>
                )}

                {/* Dispatch */}
                {skill.dispatch && (
                  <div>
                    <h4 className="text-sm font-semibold text-slate-300 mb-2">分发策略</h4>
                    <div className="inner-panel rounded-xl p-4 text-sm space-y-1">
                      <div>
                        模式: <span className="text-emerald-400">{skill.dispatch.mode}</span>
                      </div>
                      {skill.dispatch.prefer_providers.length > 0 && (
                        <div>优先 Provider: {skill.dispatch.prefer_providers.join(" -> ")}</div>
                      )}
                      <div className="text-xs text-slate-500">
                        timeout: {skill.dispatch.timeout_ms}ms · retry: {skill.dispatch.retry_count}
                      </div>
                    </div>
                  </div>
                )}

                {/* Observability */}
                {skill.observability && (
                  <div className="text-xs text-slate-600">
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
