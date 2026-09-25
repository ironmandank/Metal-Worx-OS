const DAY_MS = 24 * 60 * 60 * 1000;

function startOfDay(value = new Date()) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  date.setHours(0, 0, 0, 0);
  return date;
}

function validDate(value) {
  if (!value) return null;
  const date = typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T12:00:00`)
    : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function sourceIsHot(hotItems, detail) {
  const ids = new Set(
    [detail?.job?.id, detail?.order?.id, detail?.project?.id]
      .filter((value) => value !== null && value !== undefined)
      .map(String),
  );
  return (hotItems || []).some((item) => ids.has(String(item.source_id)));
}

export function getDesignComplexity(detail = {}) {
  const designType = String(detail?.order?.design_notes || "")
    .split("\n")[0]
    .trim()
    .toLowerCase();

  if (designType.includes("cut-ready") || designType.includes("cut ready")) {
    return { tier: 1, label: "Cut-Ready File", color: "green" };
  }
  if (designType.includes("already on file")) {
    return { tier: 2, label: "Design Already on File", color: "teal" };
  }
  if (designType.includes("placement only") || designType.includes("existing logo")) {
    return { tier: 3, label: "Existing Logo — Placement Only", color: "cyan" };
  }
  if (designType.includes("changes required") || designType.includes("design changes")) {
    return { tier: 4, label: "Design Changes Required", color: "orange" };
  }
  return { tier: 5, label: "New Design Required", color: "red" };
}

export function isDesignFeeCleared(detail = {}) {
  const order = detail?.order || {};
  return !order.design_fee_required ||
    order.design_fee_paid ||
    order.design_fee_status === "Paid";
}

export function getDesignPriority(workOrder, detail = {}, hotItems = [], now = new Date()) {
  const job = detail.job || {};
  const order = detail.order || {};
  const project = detail.project || {};
  const due = validDate(job.due_date || project.due_date || order.due_date);
  const today = startOfDay(now);
  const dueDay = due ? startOfDay(due) : null;
  const daysUntilDue = dueDay ? Math.round((dueDay - today) / DAY_MS) : null;
  const entered = validDate(workOrder.station_entered_at || workOrder.created_at);
  const age = entered ? now.getTime() - entered.getTime() : 0;

  if (sourceIsHot(hotItems, detail)) {
    return { tier: 1, reason: "Hot Today", color: "red", age };
  }
  if (daysUntilDue !== null && daysUntilDue < 0) {
    return { tier: 2, reason: "Overdue hard date", color: "red", age };
  }
  if (daysUntilDue === 0) {
    return { tier: 3, reason: "Due today", color: "orange", age };
  }
  if (daysUntilDue === 1) {
    return { tier: 4, reason: "Due tomorrow", color: "yellow", age };
  }
  if (job.is_quick_turnaround || project.is_quick_turnaround || order.is_quick_turnaround) {
    return { tier: 5, reason: "Quick Turnaround", color: "violet", age };
  }
  if (order.design_fee_paid || order.design_fee_status === "Paid") {
    return { tier: 6, reason: "Paid design waiting", color: "blue", age };
  }
  if (workOrder.priority === "High" || job.rush || project.priority === "Rush") {
    return { tier: 7, reason: "Admin priority", color: "orange", age };
  }
  return { tier: 8, reason: "Oldest ready design", color: "gray", age };
}

export function sortDesignQueue(workOrders, detailsByJob = {}, hotItems = [], now = new Date()) {
  return [...workOrders].sort((left, right) => {
    const leftFeeCleared = isDesignFeeCleared(detailsByJob[left.production_job_id]);
    const rightFeeCleared = isDesignFeeCleared(detailsByJob[right.production_job_id]);
    if (leftFeeCleared !== rightFeeCleared) return leftFeeCleared ? -1 : 1;
    const leftComplexity = getDesignComplexity(detailsByJob[left.production_job_id]);
    const rightComplexity = getDesignComplexity(detailsByJob[right.production_job_id]);
    if (leftComplexity.tier !== rightComplexity.tier) {
      return leftComplexity.tier - rightComplexity.tier;
    }
    const leftRank = getDesignPriority(left, detailsByJob[left.production_job_id], hotItems, now);
    const rightRank = getDesignPriority(right, detailsByJob[right.production_job_id], hotItems, now);
    if (leftRank.tier !== rightRank.tier) return leftRank.tier - rightRank.tier;
    if (leftRank.age !== rightRank.age) return rightRank.age - leftRank.age;
    return Number(left.id || 0) - Number(right.id || 0);
  });
}
