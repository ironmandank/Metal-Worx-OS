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

  it("organizes the Anna Perez labor and materials quote correctly", () => {
    const result = organizeQuoteText(`
**Quote Summary**
- Scope of Work: Replace missing post caps on existing handrails, replace the frame and door on two crawl space openings, and repair the locking mechanism on the third crawl space door.
- Hourly Rate: $1500 ($150.00/hr estimate: 6 hrs for fabrication and 4 hrs for installation). This includes labor, shop materials, sandblasting, powder coating, and installation.
- Special Order Materials: $75.00 (1" square cast iron drive-in caps, including freight and taxes)
- Estimated Total: $1,575.00 (Excluding taxes and fees)
- Deposit: A 50% down payment is required to begin the project.

**Project Scope**
- Post Caps: Drive new caps into existing handrails and weld them into place.
- Crawl Space Doors: Remove two existing wood doors and replace them with custom-fabricated metal framed lockable doors.
- Lock Repair: Extend the locking mechanism on the third crawl space door to ensure it secures properly.

**Next Steps & Process**
1. Measurement: Upon approval of this quote, we will visit the site to gather precise measurements.
2. Test Fit: We will conduct an on-site test fit to ensure proper alignment.
3. Finishing: Once the fit is confirmed, components will receive a grey powder-coat finish.
4. Installation: We will coordinate a final installation date after powder coating is complete.

Due to fluctuations in metal prices this quote is valid for five (5) working days beginning Monday 21 Sep.
`);

    expect(result.items).toHaveLength(2);
    expect(result.items[0]).toMatchObject({ quantity: 10, unit_price: 150, unit: "Hour" });
    expect(result.items[1]).toMatchObject({ title: "Special Order Materials", quantity: 1, unit_price: 75 });
    expect(result.items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0)).toBe(1575);
    expect(result.scope_of_work).toContain("Replace missing post caps");
    expect(result.scope_of_work).toContain("Crawl Space Doors");
    expect(result.project_schedule).toContain("Measurement");
    expect(result.down_payment_terms).toContain("50%");
    expect(result.price_notes).toContain("$1,575.00");
    expect(result.valid_until).toBe("2026-09-25");
    expect(result.tax_treatment).toBe("plus");
  });

  it("organizes a natural-language SSU container quote into the form fields", () => {
    const result = organizeQuoteText(`
SSU Quote 1 – Two 20-Foot Containers

Project: Fabrication Preparation for Two 20-Foot Shipping Containers

Metal Worx Inc. will cut the adjoining side walls from two 20-foot shipping containers and prepare the containers to be welded together at an off-site location.

This quote includes:

Cutting the required side walls from both containers
Bracing the containers for structural support during transportation
Preparing the containers for shipment and off-site assembly

Not Included:

TYVEK® sheeting or installation
Transportation or delivery
On-site assembly, welding, or installation

SSU will be responsible for delivering the containers to Metal Worx Inc. and picking them up when the fabrication work is complete.

Labor and Fabrication: $7,325.00
Taxes: Plus applicable taxes
Total Before Tax: $7,325.00
`);

    expect(result.customer_name).toBe("SSU");
    expect(result.quote_title).toBe("Fabrication Preparation for Two 20-Foot Shipping Containers");
    expect(result.items).toHaveLength(1);
    expect(result.items[0]).toMatchObject({ title: "Labor and Fabrication", quantity: 1, unit_price: 7325 });
    expect(result.scope_of_work).toContain("cut the adjoining side walls");
    expect(result.included_services).toContain("Bracing the containers");
    expect(result.exclusions).toContain("TYVEK");
    expect(result.exclusions).toContain("On-site assembly");
    expect(result.exclusions).not.toContain("Labor and Fabrication");
    expect(result.price_notes).toContain("Total Before Tax");
    expect(result.tax_treatment).toBe("plus");
  });
});
