import { useMemo, useState } from "react";
import { FileText, Plus, Download } from "lucide-react";
import type { NewsItem } from "../types";
import { normalizeNewsItem, dedupeNewsItems, createReportDocument } from "../domain/news-report";
import { downloadAsFile, exportNewsToMarkdown } from "../domain/config-export";

export default function ReportsPage() {
  const [reportTitle, setReportTitle] = useState("Daily Intelligence Brief");
  const [sourceName, setSourceName] = useState("Manual Source");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [url, setUrl] = useState("");
  const [items, setItems] = useState<NewsItem[]>([]);

  const deduped = useMemo(() => dedupeNewsItems(items), [items]);
  const markdown = useMemo(() => exportNewsToMarkdown(reportTitle, deduped), [reportTitle, deduped]);
  const doc = useMemo(() => createReportDocument(reportTitle, deduped, Array.from(new Set(deduped.map((x) => x.source_id)))), [reportTitle, deduped]);

  const addItem = () => {
    if (!title.trim() || !content.trim()) return;
    const normalized = normalizeNewsItem({
      source_id: sourceName.trim().toLowerCase().replace(/\s+/g, "-") || "manual",
      source_name: sourceName.trim() || "Manual Source",
      title,
      content,
      url: url.trim() || undefined,
      published_at: Date.now(),
    });
    setItems((prev) => [normalized, ...prev]);
    setTitle("");
    setContent("");
    setUrl("");
  };

  const handleExport = () => {
    downloadAsFile(markdown, `news-report-${Date.now()}.md`, "text/markdown");
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gradient">Reports 汇报中心</h2>
        <p className="text-slate-500 mt-1">整理资讯并生成 Markdown 汇报，支持站内预览与导出</p>
      </div>

      <div className="glass-card p-4 space-y-3">
        <label className="space-y-1 block">
          <div className="text-xs text-slate-400">报告标题</div>
          <input
            value={reportTitle}
            onChange={(e) => setReportTitle(e.target.value)}
            className="w-full input-modern px-3 py-2 text-sm"
            placeholder="Daily Intelligence Brief"
          />
        </label>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="space-y-1 block">
            <div className="text-xs text-slate-400">来源名称</div>
            <input
              value={sourceName}
              onChange={(e) => setSourceName(e.target.value)}
              className="w-full input-modern px-3 py-2 text-sm"
              placeholder="Tech Feed"
            />
          </label>
          <label className="space-y-1 block">
            <div className="text-xs text-slate-400">资讯标题</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full input-modern px-3 py-2 text-sm"
              placeholder="New release"
            />
          </label>
        </div>

        <label className="space-y-1 block">
          <div className="text-xs text-slate-400">URL（可选）</div>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            className="w-full input-modern px-3 py-2 text-sm"
            placeholder="https://example.com/news"
          />
        </label>

        <label className="space-y-1 block">
          <div className="text-xs text-slate-400">正文</div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className="w-full input-modern px-3 py-2 text-sm min-h-28"
            placeholder="Paste latest information..."
          />
        </label>

        <div className="flex items-center gap-2">
          <button onClick={addItem} className="btn-primary px-4 py-2 text-sm flex items-center gap-2">
            <Plus size={16} />
            添加资讯
          </button>
          <button
            onClick={handleExport}
            disabled={deduped.length === 0}
            className="btn-secondary px-4 py-2 text-sm flex items-center gap-2 disabled:opacity-50"
          >
            <Download size={16} />
            导出 Markdown
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <section className="glass-card p-4 space-y-2">
          <h3 className="text-sm text-slate-300">资讯条目 ({deduped.length})</h3>
          {deduped.length === 0 && <div className="text-sm text-slate-500">暂无资讯条目</div>}
          <div className="space-y-2 max-h-[420px] overflow-auto">
            {deduped.map((item) => (
              <div key={item.id} className="rounded-xl border border-white/[0.06] p-3">
                <div className="text-sm text-slate-200">{item.title}</div>
                <div className="text-xs text-slate-500 mt-1">{item.source_name}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="glass-card p-4 space-y-2">
          <h3 className="text-sm text-slate-300 flex items-center gap-2">
            <FileText size={16} />
            报告预览 ({doc.id})
          </h3>
          <pre className="inner-panel rounded-xl p-3 text-xs text-slate-300 whitespace-pre-wrap max-h-[420px] overflow-auto">{markdown}</pre>
        </section>
      </div>
    </div>
  );
}
