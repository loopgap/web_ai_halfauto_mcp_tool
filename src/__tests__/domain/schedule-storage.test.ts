import { describe, expect, it } from "vitest";
import { removeSchedule, upsertSchedule } from "../../domain/schedule-storage";
import type { ScheduledWorkflow } from "../../types";

function mkBase(): ScheduledWorkflow {
  return {
    id: "sch-1",
    workflow_id: "wf-1",
    trigger: { type: "interval", interval_ms: 60_000 },
    enabled: true,
    next_run_at: 0,
    last_run_at: undefined,
    last_error: undefined,
    failure_count: 0,
    created_at: 1,
    updated_at: 1,
  };
}

describe("upsertSchedule", () => {
  it("inserts new schedule and computes next_run_at", () => {
    const base = mkBase();
    const result = upsertSchedule([], base, 1000);
    expect(result.error).toBeUndefined();
    expect(result.next).toHaveLength(1);
    expect(result.next[0].next_run_at).toBe(61_000);
  });

  it("updates existing schedule", () => {
    const base = mkBase();
    const first = upsertSchedule([], base, 1000).next;
    const updated: ScheduledWorkflow = { ...base, trigger: { type: "interval", interval_ms: 120_000 } };
    const second = upsertSchedule(first, updated, 2000).next;
    expect(second).toHaveLength(1);
    expect(second[0].next_run_at).toBe(122_000);
  });

  it("returns error when trigger invalid", () => {
    const invalid: ScheduledWorkflow = {
      ...mkBase(),
      trigger: { type: "daily", daily_utc_hm: "99:99" },
    };
    const out = upsertSchedule([], invalid, 1000);
    expect(out.error).toBeDefined();
    expect(out.next).toEqual([]);
  });
});

describe("removeSchedule", () => {
  it("removes by id", () => {
    const a = mkBase();
    const b: ScheduledWorkflow = { ...mkBase(), id: "sch-2" };
    const left = removeSchedule([a, b], "sch-1");
    expect(left).toHaveLength(1);
    expect(left[0].id).toBe("sch-2");
  });
});
