import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  canUnlockProjectMoney,
  formatProjectMoney,
  setProjectMoneyActiveUser,
  setProjectMoneyUnlocked,
} from "./projectMoneyPrivacy";

describe("project money privacy", () => {
  beforeEach(() => {
    const values = new Map();
    vi.stubGlobal("window", {
      sessionStorage: {
        getItem: (key) => values.get(key) || null,
        setItem: (key, value) => values.set(key, value),
        removeItem: (key) => values.delete(key),
      },
    });
  });

  it("only allows the approved employee names to request access", () => {
    expect(canUnlockProjectMoney("Dan")).toBe(true);
    expect(canUnlockProjectMoney("kory")).toBe(true);
    expect(canUnlockProjectMoney("Austin")).toBe(false);
  });

  it("hides values until the approved employee unlocks them", () => {
    setProjectMoneyActiveUser("Lori");
    expect(formatProjectMoney(12500)).toBe("$••••••");
    setProjectMoneyUnlocked("Lori", true);
    expect(formatProjectMoney(12500)).toBe("$12,500.00");
  });

  it("does not reveal values for an unapproved employee", () => {
    setProjectMoneyActiveUser("Austin");
    setProjectMoneyUnlocked("Austin", true);
    expect(formatProjectMoney(12500)).toBe("$••••••");
  });
});
