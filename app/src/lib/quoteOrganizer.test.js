import { describe, expect, it } from "vitest";
import { organizeQuoteText } from "./quoteOrganizer";

describe("organizeQuoteText", () => {
  it("organizes a handrail quote into editable fields", () => {
    const result = organizeQuoteText(`
**Quote Summary**
- Item: 21 total feet of Custom Handrail
- Rate: $130.00 per linear foot (Includes labor, shop materials, sandblasting, powder coating, and installation)
- Customer Special Order Materials: $550.00 (Forged Steel Baluster)
- Total: $3,280.00 (Excluding taxes and fees)
- Down Payment: A 50% deposit is required to begin the project.

**Project Scope**
Custom-fabricate handrails for the front and side porch.

**Process**
1. Measurement: Gather precise measurements.
2. Test Fit: Confirm alignment.
`);

    expect(result.quote_title).toBe("Custom Handrail");
    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ quantity: 21, unit_price: 130, unit: "Linear Foot" });
    expect(result.items[1]).toMatchObject({ quantity: 1, unit_price: 550 });
    expect(result.scope_of_work).toContain("Custom-fabricate");
    expect(result.project_schedule).toContain("Measurement");
    expect(result.down_payment_terms).toContain("50%");
    expect(result.price_notes).toContain("$3,280.00");
  });
});
