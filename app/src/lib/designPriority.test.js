import { describe, expect, it } from "vitest";
import { getDesignPriority, sortDesignQueue } from "./designPriority";

const now = new Date("2026-09-22T12:00:00");

describe("design priority", () => {
  it("puts Hot Today ahead of overdue and quick work", () => {
    const jobs = {
      1: { job: { id: 1, due_date: "2026-09-20" } },
      2: { job: { id: 2, is_quick_turnaround: true } },
      3: { job: { id: 3 } },
    };
    const orders = [
      { id: 1, production_job_id: 1, station_entered_at: "2026-09-20T12:00:00Z" },
      { id: 2, production_job_id: 2, station_entered_at: "2026-09-18T12:00:00Z" },
      { id: 3, production_job_id: 3, station_entered_at: "2026-09-22T10:00:00Z" },
    ];
    expect(sortDesignQueue(orders, jobs, [{ source_id: "3" }], now).map((item) => item.id)).toEqual([3, 1, 2]);
  });

  it("uses station age as the tie breaker", () => {
    const older = { id: 10, production_job_id: 10, station_entered_at: "2026-09-18T12:00:00Z" };
    const newer = { id: 11, production_job_id: 11, station_entered_at: "2026-09-21T12:00:00Z" };
    expect(sortDesignQueue([newer, older], {}, [], now).map((item) => item.id)).toEqual([10, 11]);
    expect(getDesignPriority(older, {}, [], now).reason).toBe("Oldest ready design");
  });
});
