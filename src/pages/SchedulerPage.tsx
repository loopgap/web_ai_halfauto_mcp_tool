import { useMemo, useState } from "react";
import { CalendarClock, Plus, Trash2 } from "lucide-react";
import type { ScheduleTrigger, ScheduledWorkflow } from "../types";
import { previewNextRuns } from "../domain/schedule-engine";
import { loadSchedules, saveSchedules, upsertSchedule, removeSchedule } from "../domain/schedule-storage";

function formatTs(ts: number): string {
  return new Date(ts).toLocaleString();
}

export default function SchedulerPage() {
  const [workflowId, setWorkflowId] = useState("wf-default");
  const [triggerType, setTriggerType] = useState<ScheduleTrigger["type"]>("interval");
  const [intervalMs, setIntervalMs] = useState(300000);
  const [dailyHm, setDailyHm] = useState("09:00");
  const [cronExpr, setCronExpr] = useState("*/15 * * * *");
  const [enabled, setEnabled] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<ScheduledWorkflow[]>(() => loadSchedules());

  const triggerDraft: ScheduleTrigger = useMemo(() => {
    if (triggerType === "interval") return { type: "interval", interval_ms: intervalMs };
    if (triggerType === "daily") return { type: "daily", daily_utc_hm: dailyHm };
    if (triggerType === "cron") return { type: "cron", cron: cronExpr };
    return { type: "once", once_at: Date.now() + 60_000 };
  }, [triggerType, intervalMs, dailyHm, cronExpr]);

  const nextPreview = useMemo(() => previewNextRuns(triggerDraft, Date.now(), 3), [triggerDraft]);

  const handleCreate = () => {
    const now = Date.now();
    const payload = {
      id: `sch-${now}`,
      workflow_id: workflowId.trim(),
      trigger: triggerDraft,
      enabled,
      last_run_at: undefined,
      last_error: undefined,
      failure_count: 0,
      created_at: now,
    };
    const out = upsertSchedule(schedules, payload, now);
    if (out.error) {
      setError(out.error);
      return;
    }
    setError(null);
    setSchedules(out.next);
    saveSchedules(out.next);
  };

  const handleDelete = (id: string) => {
    const next = removeSchedule(schedules, id);
    setSchedules(next);
    saveSchedules(next);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gradient">Scheduler 定时任务</h2>
          <p className="text-slate-500 mt-1">创建定时触发 Workflow 任务（本地持久化）</p>
        </div>
      </div>

      <div className="glass-card p-4 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="space-y-1">
            <div className="text-xs text-slate-400">Workflow ID</div>
            <input
              className="w-full input-modern px-3 py-2 text-sm"
              value={workflowId}
              onChange={(e) => setWorkflowId(e.target.value)}
              placeholder="wf-daily-brief"
            />
          </label>

          <label className="space-y-1">
            <div className="text-xs text-slate-400">触发类型</div>
            <select
              className="w-full input-modern px-3 py-2 text-sm"
              value={triggerType}
              onChange={(e) => setTriggerType(e.target.value as ScheduleTrigger["type"])}
            >
              <option value="interval">Interval</option>
              <option value="daily">Daily (UTC)</option>
              <option value="cron">Cron</option>
              <option value="once">Once</option>
            </select>
          </label>
        </div>

        {triggerType === "interval" && (
          <label className="space-y-1 block">
            <div className="text-xs text-slate-400">interval_ms</div>
            <input
              type="number"
              min={10000}
              step={1000}
              className="w-full input-modern px-3 py-2 text-sm"
              value={intervalMs}
              onChange={(e) => setIntervalMs(Number(e.target.value || 0))}
            />
          </label>
        )}

        {triggerType === "daily" && (
          <label className="space-y-1 block">
            <div className="text-xs text-slate-400">daily_utc_hm (HH:mm)</div>
            <input
              className="w-full input-modern px-3 py-2 text-sm"
              value={dailyHm}
              onChange={(e) => setDailyHm(e.target.value)}
              placeholder="09:00"
            />
          </label>
        )}

        {triggerType === "cron" && (
          <label className="space-y-1 block">
            <div className="text-xs text-slate-400">cron</div>
            <input
              className="w-full input-modern px-3 py-2 text-sm"
              value={cronExpr}
              onChange={(e) => setCronExpr(e.target.value)}
              placeholder="*/15 * * * *"
            />
          </label>
        )}

        <label className="flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          启用
        </label>

        <div className="rounded-xl border border-white/[0.06] p-3">
          <div className="text-xs text-slate-400 mb-2">下次触发预览</div>
          <ul className="space-y-1 text-sm text-slate-300">
            {nextPreview.length === 0 ? <li className="text-slate-500">无可计算时间</li> : nextPreview.map((ts) => <li key={ts}>{formatTs(ts)}</li>)}
          </ul>
        </div>

        {error && <div className="text-sm text-red-400">{error}</div>}

        <button
          onClick={handleCreate}
          className="btn-primary flex items-center gap-2 px-4 py-2 text-sm"
        >
          <Plus size={16} />
          创建定时任务
        </button>
      </div>

      <div className="space-y-3">
        <h3 className="text-sm text-slate-300 flex items-center gap-2">
          <CalendarClock size={16} />
          已配置任务 ({schedules.length})
        </h3>
        {schedules.length === 0 && <div className="text-sm text-slate-500">暂无定时任务</div>}
        {schedules.map((s) => (
          <div key={s.id} className="glass-card-static p-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-sm text-slate-200 truncate">{s.workflow_id}</div>
              <div className="text-xs text-slate-500 truncate">
                {s.id} · {s.trigger.type} · next: {formatTs(s.next_run_at)}
              </div>
            </div>
            <button
              onClick={() => handleDelete(s.id)}
              className="px-2 py-1 rounded border border-red-500/30 text-red-300 hover:bg-red-500/10"
              aria-label={`删除 ${s.id}`}
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
