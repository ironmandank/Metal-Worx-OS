import { describe, expect, it } from "vitest";
import {
  buildStageAdvanceUpdates,
  findOutOfSequenceStages,
  getStageDates,
} from "./projectWorkflowTimeline";

describe("project workflow timeline", () => {
  it("records completion and starts the next stage", () => {
    const updates = buildStageAdvanceUpdates({
      project: { workflow_stage_dates: {} },
      currentStage: { key: "production" },
      nextStage: { key: "install" },
      actor: "Dan",
      now: "2026-10-08T12:00:00.000Z",
    });

    expect(updates.fabrication_status).toBe("Completed");
    expect(updates.install_status).toBe("Needs Scheduling");
    expect(updates.workflow_stage_dates.production.completed_by).toBe("Dan");
    expect(updates.workflow_stage_dates.install.started_at).toBe("2026-10-08T12:00:00.000Z");
  });

  it("detects completed stages after the first incomplete stage", () => {
    const stages = [
      { key: "quote", complete: true },
      { key: "production", complete: false },
      { key: "install", complete: true },
    ];
    expect(findOutOfSequenceStages(stages).map((stage) => stage.key)).toEqual(["install"]);
  });

  it("uses existing scheduled project dates as fallbacks", () => {
    expect(getStageDates({ install_start: "2026-10-10T12:00:00Z" }, "install").startedAt)
      .toBe("2026-10-10T12:00:00Z");
  });
});
