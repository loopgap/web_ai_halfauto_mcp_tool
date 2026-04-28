import type { ScheduleTrigger, ScheduledWorkflow } from "../types";

const MIN_INTERVAL_MS = 10_000;

function parseDailyUtcHm(value: string): { hour: number; minute: number } | null {
  const m = /^(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2]);
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null;
  return { hour, minute };
}

function isCronFieldValid(part: string, min: number, max: number): boolean {
  if (part === "*") return true;
  if (/^\d+$/.test(part)) {
    const v = Number(part);
    return v >= min && v <= max;
  }
  if (/^\*\/\d+$/.test(part)) {
    const step = Number(part.slice(2));
    return step > 0 && step <= max;
  }
  return false;
}

export function validateScheduleTrigger(trigger: ScheduleTrigger): { valid: boolean; reason?: string } {
  if (trigger.type === "once") {
    if (typeof trigger.once_at !== "number") {
      return { valid: false, reason: "once_at is required for once trigger" };
    }
    return { valid: true };
  }

  if (trigger.type === "interval") {
    if (typeof trigger.interval_ms !== "number") {
      return { valid: false, reason: "interval_ms is required for interval trigger" };
    }
    if (trigger.interval_ms < MIN_INTERVAL_MS) {
      return { valid: false, reason: `interval_ms must be >= ${MIN_INTERVAL_MS}` };
    }
    return { valid: true };
  }

  if (trigger.type === "daily") {
    if (!trigger.daily_utc_hm) {
      return { valid: false, reason: "daily_utc_hm is required for daily trigger" };
    }
    return parseDailyUtcHm(trigger.daily_utc_hm)
      ? { valid: true }
      : { valid: false, reason: "daily_utc_hm must be HH:mm" };
  }

  if (trigger.type === "cron") {
    if (!trigger.cron) return { valid: false, reason: "cron is required for cron trigger" };
    const parts = trigger.cron.trim().split(/\s+/);
    if (parts.length !== 5) return { valid: false, reason: "cron must have 5 fields" };
    const ok =
      isCronFieldValid(parts[0], 0, 59) &&
      isCronFieldValid(parts[1], 0, 23) &&
      isCronFieldValid(parts[2], 1, 31) &&
      isCronFieldValid(parts[3], 0, 11) && // §G1.3 getUTCMonth() returns 0-11
      isCronFieldValid(parts[4], 0, 6);
    return ok ? { valid: true } : { valid: false, reason: "cron contains unsupported field" };
  }

  return { valid: false, reason: "unknown schedule type" };
}

function cronMatches(date: Date, cron: string): boolean {
  const parts = cron.trim().split(/\s+/);
  const values = [
    date.getUTCMinutes(),
    date.getUTCHours(),
    date.getUTCDate(),
    date.getUTCMonth() + 1,
    date.getUTCDay(),
  ];

  return parts.every((p, idx) => {
    if (p === "*") return true;
    if (/^\d+$/.test(p)) return Number(p) === values[idx];
    if (/^\*\/\d+$/.test(p)) {
      const step = Number(p.slice(2));
      return values[idx] % step === 0;
    }
    return false;
  });
}

export function getNextRunAt(trigger: ScheduleTrigger, fromTs: number): number | null {
  const validation = validateScheduleTrigger(trigger);
  if (!validation.valid) return null;

  if (trigger.type === "once") {
    return trigger.once_at!;
  }

  if (trigger.type === "interval") {
    return fromTs + trigger.interval_ms!;
  }

  if (trigger.type === "daily") {
    const hm = parseDailyUtcHm(trigger.daily_utc_hm!);
    if (!hm) return null;
    const base = new Date(fromTs);
    const run = new Date(Date.UTC(
      base.getUTCFullYear(),
      base.getUTCMonth(),
      base.getUTCDate(),
      hm.hour,
      hm.minute,
      0,
      0,
    ));
    if (run.getTime() <= fromTs) {
      run.setUTCDate(run.getUTCDate() + 1);
    }
    return run.getTime();
  }

  if (trigger.type === "cron") {
    const cron = trigger.cron!;
    const cursor = new Date(fromTs);
    cursor.setUTCSeconds(0, 0);
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);

    for (let i = 0; i < 60 * 24 * 32; i += 1) {
      if (cronMatches(cursor, cron)) return cursor.getTime();
      cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
    }
    return null;
  }

  return null;
}

export function isScheduleDue(schedule: ScheduledWorkflow, nowTs: number): boolean {
  return schedule.enabled && schedule.next_run_at <= nowTs;
}

export function previewNextRuns(trigger: ScheduleTrigger, fromTs: number, count = 5): number[] {
  const results: number[] = [];
  let cursor = fromTs;
  for (let i = 0; i < count; i += 1) {
    const next = getNextRunAt(trigger, cursor);
    if (next == null) break;
    results.push(next);
    cursor = next;
  }
  return results;
}
