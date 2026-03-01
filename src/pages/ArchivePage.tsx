import { useState } from "react";
import { useAppState } from "../store/AppStore";
import { SkeletonList } from "../components/Skeleton";
import { RUN_STATUS } from "../domain/dictionary";
import { useVirtualScroll } from "../hooks/useVirtualScroll";
import { Archive, Search, Download } from "lucide-react";

export default function ArchivePage() {
  const { runs, initialized } = useAppState();
  const [search, setSearch] = useState("");

  const filtered = runs.filter(
    (r) =>
      r.skill_id.toLowerCase().includes(search.toLowerCase()) ||
      r.target_id.toLowerCase().includes(search.toLowerCase()) ||
      r.provider.toLowerCase().includes(search.toLowerCase()) ||
      r.prompt.toLowerCase().includes(search.toLowerCase()) ||
      (r.trace_id && r.trace_id.toLowerCase().includes(search.toLowerCase()))
  );

  // §3 virtual scrolling for large run lists
  const CONTAINER_HEIGHT = 600;
  const ROW_HEIGHT = 150;
  const { visibleRange, totalHeight, offsetTop, containerRef, onScroll } = useVirtualScroll({
    itemCount: filtered.length,
    itemHeight: ROW_HEIGHT,
    containerHeight: CONTAINER_HEIGHT,
    overscan: 4,
  });

  const handleExportMarkdown = () => {
    const md = filtered
      .map(
        (r) =>
          `## Run ${r.id}\n- Skill: ${r.skill_id}\n- Target: ${r.target_id} (${r.provider})\n- Status: ${r.status}\n- Time: ${new Date(r.ts_start).toLocaleString()}\n- TraceID: ${r.trace_id}\n\n### Prompt\n\`\`\`\n${r.prompt}\n\`\`\`\n${r.output ? `\n### Output\n\`\`\`\n${r.output}\n\`\`\`` : ""}\n`
      )
      .join("\n---\n\n");

    const blob = new Blob([md], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `runs-export-${Date.now()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!initialized) {
    return <div className="p-6"><SkeletonList count={4} /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gradient">Runs 归档</h2>
          <p className="text-slate-500 mt-1">
            历史运行记录 · {runs.length} 条 · Vault 持久化
          </p>
        </div>
        <button
          onClick={handleExportMarkdown}
          disabled={filtered.length === 0}
          className="btn-secondary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
        >
          <Download size={16} />
          导出 Markdown
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"
        />
        <input
          className="w-full input-modern pl-10 pr-4 py-2.5 text-sm"
          placeholder="搜索 skill、target、provider、trace_id..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-500" role="status">
          <Archive size={48} className="mb-4 opacity-50" />
          <p>暂无运行记录</p>
          <p className="text-sm mt-1">
            在运行控制台投递 Skill 后，记录会自动归档到 Vault
          </p>
        </div>
      ) : (
        <div
          ref={containerRef}
          onScroll={onScroll}
          className="overflow-auto"
          style={{ height: CONTAINER_HEIGHT }}
          role="list"
          aria-label={`运行记录列表，共 ${filtered.length} 条`}
        >
          <div style={{ height: totalHeight, position: "relative" }}>
            <div style={{ position: "absolute", top: offsetTop, left: 0, right: 0 }} className="space-y-3">
              {filtered.slice(visibleRange.start, visibleRange.end).map((run) => (
            <div
              key={run.id}
                    role="listitem"
              className="glass-card-static p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${RUN_STATUS[run.status]?.dot ?? "bg-slate-400"}`}
                  />
                  <span className="font-medium">{run.skill_id}</span>
                  <span className="text-slate-500">→</span>
                  <span className="text-blue-300">{run.target_id}</span>
                  <span className={`badge text-[10px] ${RUN_STATUS[run.status]?.color ?? "text-slate-400"}`}>{RUN_STATUS[run.status]?.label ?? run.status}</span>
                  <span className="badge badge-slate text-[10px]">
                    {run.provider}
                  </span>
                  {run.error_code && (
                    <span className="badge badge-red text-[10px]">
                      {run.error_code}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {run.trace_id && (
                    <span className="text-[10px] text-slate-600 font-mono">
                      {run.trace_id.substring(0, 16)}
                    </span>
                  )}
                  <span className="text-xs text-slate-500">
                    {new Date(run.ts_start).toLocaleString()}
                  </span>
                </div>
              </div>
              <pre className="inner-panel rounded-xl p-3 text-xs text-slate-400 overflow-auto max-h-[100px] whitespace-pre-wrap">
                {run.prompt.substring(0, 200)}
                {run.prompt.length > 200 && "..."}
              </pre>
              {run.output && (
                <div className="mt-2">
                  <div className="text-xs text-slate-500 mb-1">输出:</div>
                  <pre className="inner-panel rounded-xl p-3 text-xs text-green-300 overflow-auto max-h-[100px] whitespace-pre-wrap">
                    {run.output.substring(0, 300)}
                    {run.output.length > 300 && "..."}
                  </pre>
                </div>
              )}
              {run.route_decision && (
                <div className="mt-2 text-[10px] text-slate-600">
                  路由: {run.route_decision.action} · 置信度: {(run.route_decision.confidence * 100).toFixed(0)}%
                  {run.route_decision.selected && ` · intent: ${run.route_decision.selected.intent}`}
                </div>
              )}
            </div>
                ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
