import { describe, expect, it } from "vitest";
import {
  getDesignComplexity,
  getDesignPriority,
  isDesignFeeCleared,
  sortDesignQueue,
} from "./designPriority";

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

  it("sorts existing and cut-ready artwork ahead of new design work", () => {
    const details = {
      1: { order: { design_notes: "New Design Required" } },
      2: { order: { design_notes: "Existing Logo — Placement Only" } },
      3: { order: { design_notes: "Design Already on File" } },
      4: { order: { design_notes: "Customer-Supplied Cut-Ready File" } },
      5: { order: { design_notes: "Design Changes Required" } },
    };
    const orders = [1, 2, 3, 4, 5].map((id) => ({
      id,
      production_job_id: id,
      station_entered_at: "2026-09-22T10:00:00Z",
    }));

    expect(sortDesignQueue(orders, details, [], now).map((item) => item.id)).toEqual([
      4, 3, 2, 5, 1,
    ]);
    expect(getDesignComplexity(details[3])).toMatchObject({ tier: 2, color: "teal" });
  });

  it("keeps unpaid required design work behind financially cleared work", () => {
    const details = {
      1: { order: { design_notes: "Design Already on File", design_fee_required: true, design_fee_paid: false } },
      2: { order: { design_notes: "New Design Required", design_fee_required: false } },
    };
    const orders = [
      { id: 1, production_job_id: 1 },
      { id: 2, production_job_id: 2 },
    ];
    expect(sortDesignQueue(orders, details, [], now).map((item) => item.id)).toEqual([2, 1]);
    expect(isDesignFeeCleared(details[1])).toBe(false);
    expect(isDesignFeeCleared(details[2])).toBe(true);
  });
});
