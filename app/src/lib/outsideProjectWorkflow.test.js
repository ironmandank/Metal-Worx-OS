import { describe, expect, it } from "vitest";
import { getApprovedProjectHandoff, getOutsidePhase, getSuggestedNextAction } from "./outsideProjectWorkflow";

describe("outside project workflow", () => {
  it("places a project needing a site visit in pre-quote", () => {
    const project = { site_visit_required: true, site_visit_status: "Not Started" };
    expect(getOutsidePhase(project).key).toBe("pre_quote");
    expect(getSuggestedNextAction(project)).toMatch(/site visit/i);
  });

  it("places a sent quote awaiting customer approval in quote and approval", () => {
    const project = { quote_required: true, quote_status: "Sent", customer_approval_required: true, approval_status: "Pending" };
    expect(getOutsidePhase(project).key).toBe("quote_approval");
  });

  it("places approved fabrication work in production", () => {
    const project = { quote_required: true, quote_status: "Approved", customer_approval_required: true, approval_status: "Approved", status: "In Progress", planned_start_date: "2026-09-24", fabrication_required: true, fabrication_status: "In Progress", balance_status: "Pending" };
    expect(getOutsidePhase(project).key).toBe("production");
  });

  it("routes approved work awaiting a required deposit before scheduling", () => {
    const project = { down_payment_required: true, down_payment_status: "Pending" };
    expect(getApprovedProjectHandoff(project)).toMatchObject({ status: "Awaiting Deposit" });
    expect(getOutsidePhase({ ...project, approval_status: "Approved" }).key).toBe("deposit");
  });

  it("routes approved paid work to needs scheduling", () => {
    const project = { down_payment_required: true, down_payment_status: "Received" };
    expect(getApprovedProjectHandoff(project)).toMatchObject({ status: "Needs Scheduling" });
    expect(getSuggestedNextAction({ ...project, status: "Needs Scheduling", approval_status: "Approved" })).toMatch(/schedule the project start/i);
  });

  it("places finished work with a balance in closeout", () => {
    const project = { customer_approval_required: false, status: "In Progress", balance_status: "Due" };
    expect(getOutsidePhase(project).key).toBe("closeout");
    expect(getSuggestedNextAction(project)).toMatch(/remaining balance/i);
  });
});
