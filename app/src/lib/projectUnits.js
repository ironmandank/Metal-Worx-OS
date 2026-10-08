export const UNIT_STAGES = [
  "Planning",
  "Design",
  "Materials",
  "Fabrication",
  "Finish",
  "Final Inspection",
  "Ready for Pickup / Delivery",
  "Completed",
];

export const UNIT_STATUSES = ["Not Started", "Ready", "In Progress", "Blocked", "Complete"];

export const HANDOFF_STATUSES = [
  "Not Ready",
  "Waiting for Customer Pickup",
  "Pickup Scheduled",
  "Picked Up",
  "Delivery Scheduled",
  "Delivered",
  "Not Required",
];

export const HANDOFF_METHODS = [
  "Customer Pickup",
  "Metal Worx Delivery",
  "Third-Party Delivery",
  "Not Required",
];

export function summarizeProjectUnits(units) {
  const active = units.filter((unit) => unit.is_active !== false);
  const completed = active.filter((unit) =>
    unit.status === "Complete" || ["Picked Up", "Delivered"].includes(unit.handoff_status),
  );
  const ready = active.filter((unit) =>
    ["Waiting for Customer Pickup", "Pickup Scheduled", "Delivery Scheduled"].includes(unit.handoff_status),
  );
  return { total: active.length, completed: completed.length, ready: ready.length };
}
