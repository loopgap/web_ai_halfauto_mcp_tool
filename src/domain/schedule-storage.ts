import type { ScheduledWorkflow } from "../types";
import { getNextRunAt, validateScheduleTrigger } from "./schedule-engine";

const STORAGE_KEY = "ai-workbench:schedules";

function canUseStorage(): boolean {
  return typeof window !== "undefined" && !!window.localStorage;
}

export function loadSchedules(): ScheduledWorkflow[] {
  if (!canUseStorage()) return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as ScheduledWorkflow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveSchedules(schedules: ScheduledWorkflow[]): void {
  if (!canUseStorage()) return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(schedules));
}

export function upsertSchedule(
  existing: ScheduledWorkflow[],
  incoming: Omit<ScheduledWorkflow, "next_run_at" | "updated_at">,
  nowTs = Date.now(),
): { next: ScheduledWorkflow[]; error?: string } {
  const valid = validateScheduleTrigger(incoming.trigger);
  if (!valid.valid) {
    return { next: existing, error: valid.reason ?? "invalid trigger" };
  }

  // §P2-2 disabled schedule should have a placeholder next_run_at
  const nextRunAt = incoming.enabled
    ? getNextRunAt(incoming.trigger, nowTs) ?? incoming.last_run_at ?? nowTs
    : nowTs;

  const record: ScheduledWorkflow = {
    ...incoming,
    next_run_at: nextRunAt,
    updated_at: nowTs,
  };

  const idx = existing.findIndex((x) => x.id === record.id);
  if (idx === -1) return { next: [record, ...existing] };

  const copy = [...existing];
  copy[idx] = record;
  return { next: copy };
}

export function removeSchedule(existing: ScheduledWorkflow[], id: string): ScheduledWorkflow[] {
  return existing.filter((x) => x.id !== id);
}
