import { describe, expect, it } from "vitest";

import { selectCurrentArtworkWorkOrder } from "./artworkRoute";

describe("selectCurrentArtworkWorkOrder", () => {
  it("selects the current ready step even when the route arrives out of order", () => {
    const route = [
      { id: 13, step_order: 3, department: "Prep", status: "Queued" },
      { id: 12, step_order: 2, department: "Laser", status: "Ready" },
      { id: 14, step_order: 4, department: "Paint/Powder", status: "Queued" },
      { id: 11, step_order: 1, department: "Design", status: "Completed" },
    ];

    expect(selectCurrentArtworkWorkOrder(route)?.department).toBe("Laser");
  });

  it("uses the earliest queued step when no step is ready or in progress", () => {
    const route = [
      { id: 22, step_order: 2, department: "Laser", status: "Queued" },
      { id: 21, step_order: 1, department: "Design", status: "Queued" },
    ];

    expect(selectCurrentArtworkWorkOrder(route)?.department).toBe("Design");
  });
});
