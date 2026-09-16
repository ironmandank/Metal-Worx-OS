export const OUTSIDE_PHASES = [
  { key: "pre_quote", label: "Pre-Quote", color: "cyan" },
  { key: "quote_approval", label: "Quote & Approval", color: "violet" },
  { key: "ready", label: "Ready for Production", color: "blue" },
  { key: "production", label: "In Production", color: "orange" },
  { key: "field", label: "Field Work", color: "teal" },
  { key: "closeout", label: "Closeout", color: "green" },
  { key: "hold", label: "On Hold", color: "red" },
];

const complete = (value) => ["Completed", "Approved", "Received", "Paid", "Passed", "Not Required"].includes(value);

export function getOutsidePhase(project) {
  if (!project) return OUTSIDE_PHASES[0];
  if (["On Hold", "Cancelled"].includes(project.status)) return OUTSIDE_PHASES[6];

  const preQuoteOpen =
    (project.site_visit_required && !complete(project.site_visit_status)) ||
    (project.measurements_required && !complete(project.measurements_status));
  if (preQuoteOpen) return OUTSIDE_PHASES[0];

  const approvalOpen =
    (project.quote_required && !["Sent", "Approved"].includes(project.quote_status)) ||
    (project.customer_approval_required !== false && project.approval_status !== "Approved");
  if (approvalOpen) return OUTSIDE_PHASES[1];

  const releaseOpen =
    (project.down_payment_required && project.down_payment_status !== "Received") ||
    ["Pricing Needed", "Waiting", "Pending"].includes(project.material_status);
  if (releaseOpen || ["New", "Ready for Production"].includes(project.status)) return OUTSIDE_PHASES[2];

  const productionOpen =
    (project.design_required && !complete(project.design_status)) ||
    (project.fabrication_required && !complete(project.fabrication_status)) ||
    (project.finish_required && !complete(project.finish_status)) ||
    (project.assembly_required && !complete(project.assembly_status));
  if (productionOpen) return OUTSIDE_PHASES[3];

  const fieldOpen =
    (project.test_fit_required && !complete(project.test_fit_status)) ||
    (project.install_required && !complete(project.install_status));
  if (fieldOpen) return OUTSIDE_PHASES[4];

  return OUTSIDE_PHASES[5];
}

export function getSuggestedNextAction(project) {
  if (!project) return "Review project";
  if (project.status === "On Hold") return "Resolve hold and assign an owner";
  if (project.status === "Cancelled") return "Review archived project record";
  const steps = [
    [project.site_visit_required && !complete(project.site_visit_status), "Schedule or complete the site visit"],
    [project.measurements_required && !complete(project.measurements_status), "Complete field measurements"],
    [project.quote_required && !["Sent", "Approved"].includes(project.quote_status), "Finish and send the customer quote"],
    [project.customer_approval_required !== false && project.approval_status !== "Approved", "Send or follow up on customer approval"],
    [project.down_payment_required && project.down_payment_status !== "Received", "Collect the required down payment"],
    [project.design_required && !complete(project.design_status), "Complete design and drawings"],
    [project.fabrication_required && !complete(project.fabrication_status), "Continue fabrication"],
    [project.test_fit_required && !complete(project.test_fit_status), "Schedule or complete the test fit"],
    [project.finish_required && !complete(project.finish_status), "Complete paint or powder coating"],
    [project.assembly_required && !complete(project.assembly_status), "Complete final assembly"],
    [project.install_required && !complete(project.install_status), "Schedule or complete installation"],
    [project.final_inspection_status && !complete(project.final_inspection_status), "Complete final inspection"],
    [project.balance_status !== "Not Required" && project.balance_status !== "Paid", "Collect the remaining balance"],
  ];
  return steps.find(([needed]) => needed)?.[1] || "Close out and archive the project";
}

export function getOutsideNextDate(project) {
  return project?.next_action_date || project?.site_visit_date || project?.install_date || project?.due_date || project?.target_completion_date || project?.planned_start_date || null;
}
