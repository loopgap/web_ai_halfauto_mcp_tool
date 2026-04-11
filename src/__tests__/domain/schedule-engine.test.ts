import { describe, expect, it } from "vitest";
import {
  getNextRunAt,
  isScheduleDue,
  previewNextRuns,
  validateScheduleTrigger,
} from "../../domain/schedule-engine";
import type { ScheduledWorkflow } from "../../types";

describe("validateScheduleTrigger", () => {
  it("validates once trigger", () => {
    const result = validateScheduleTrigger({ type: "once", once_at: 1700000000000 });
    expect(result.valid).toBe(true);
  });

  it("rejects too short interval", () => {
    const result = validateScheduleTrigger({ type: "interval", interval_ms: 1000 });
    expect(result.valid).toBe(false);
  });

  it("validates daily UTC trigger", () => {
    const result = validateScheduleTrigger({ type: "daily", daily_utc_hm: "09:30" });
    expect(result.valid).toBe(true);
  });

  it("validates supported cron", () => {
    const result = validateScheduleTrigger({ type: "cron", cron: "*/15 * * * *" });
    expect(result.valid).toBe(true);
  });
});

describe("getNextRunAt", () => {
  it("computes interval next run", () => {
    const next = getNextRunAt({ type: "interval", interval_ms: 60000 }, 1_700_000_000_000);
    expect(next).toBe(1_700_000_060_000);
  });

  it("computes daily next run across day boundary", () => {
    const from = Date.UTC(2026, 3, 11, 22, 0, 0, 0);
    const next = getNextRunAt({ type: "daily", daily_utc_hm: "09:00" }, from);
    expect(next).toBe(Date.UTC(2026, 3, 12, 9, 0, 0, 0));
  });

  it("computes cron next run", () => {
    const from = Date.UTC(2026, 3, 11, 9, 7, 0, 0);
    const next = getNextRunAt({ type: "cron", cron: "*/15 * * * *" }, from);
    expect(next).toBe(Date.UTC(2026, 3, 11, 9, 15, 0, 0));
  });
});

describe("schedule helpers", () => {
  it("marks schedule due", () => {
    const schedule: ScheduledWorkflow = {
      id: "sch-1",
      workflow_id: "wf-1",
      trigger: { type: "interval", interval_ms: 60000 },
      enabled: true,
      next_run_at: 1000,
      failure_count: 0,
      created_at: 10,
      updated_at: 10,
    };
    expect(isScheduleDue(schedule, 1001)).toBe(true);
  });

  it("previews upcoming runs", () => {
    const runs = previewNextRuns({ type: "interval", interval_ms: 60000 }, 0, 3);
    expect(runs).toEqual([60000, 120000, 180000]);
  });
});
