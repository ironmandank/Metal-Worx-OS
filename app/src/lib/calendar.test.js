import { describe, expect, it } from "vitest";

import { buildMonthGrid, dateKey, firstOfMonth, moveMonth } from "./calendar";

describe("project capacity month calendar", () => {
  it("always renders six complete Sunday-through-Saturday weeks", () => {
    const days = buildMonthGrid(new Date("2026-09-14T12:00:00"));
    expect(days).toHaveLength(42);
    expect(days[0].getDay()).toBe(0);
    expect(days[41].getDay()).toBe(6);
    expect(dateKey(days[0])).toBe("2026-08-30");
    expect(dateKey(days[41])).toBe("2026-10-10");
  });

  it("moves between months without carrying an invalid day", () => {
    expect(dateKey(moveMonth(new Date("2026-01-31T12:00:00"), 1))).toBe("2026-02-01");
    expect(dateKey(moveMonth(new Date("2026-03-31T12:00:00"), -1))).toBe("2026-02-01");
  });

  it("normalizes the selected month to its first day", () => {
    expect(dateKey(firstOfMonth(new Date("2026-09-14T12:00:00")))).toBe("2026-09-01");
  });
});
