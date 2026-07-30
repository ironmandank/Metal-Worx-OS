// Live Operations Command Center data service.
import { supabase } from "../lib/supabase";
import { getActionCenterData } from "./actionCenterService";

function startOfToday() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function endOfToday() {
  const today = startOfToday();
  today.setHours(23, 59, 59, 999);
  return today;
}

function normalizeStatus(value) {
  return String(value || "")
    .trim()
    .toLowerCase();
}

function normalizeDepartment(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[\/_-]+/g, " ")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function getCanonicalShopStage(record) {
  const department = normalizeDepartment(
    firstText(record, [
      "current_department",
      "current_station",
      "department",
      "work_center",
      "station",
    ])
  );

  if (!department) return "";

  if (
    department === "design" ||
    department.includes("design queue")
  ) {
    return "Design";
  }

  if (
    department === "laser" ||
    department.includes("laser cutting") ||
    department.includes("laser queue")
  ) {
    return "Laser";
  }

  if (
    department === "prep" ||
    department.includes("preparation") ||
    department.includes("sandblast") ||
    department.includes("surface prep")
  ) {
    return "Prep";
  }

  if (
    department === "weld" ||
    department === "welding" ||
    department.includes("fabrication welding")
  ) {
    return "Welding";
  }

  if (
    department === "paint" ||
    department === "painting" ||
    department === "powder" ||
    department === "powder coat" ||
    department === "powder coating" ||
    department === "paint powder" ||
    department === "paint and powder" ||
    department.includes("paint booth") ||
    department.includes("finishing")
  ) {
    return "Paint/Powder";
  }

  if (
    department === "assembly" ||
    department.includes("final assembly")
  ) {
    return "Assembly";
  }

  if (
    department === "qc" ||
    department === "quality" ||
    department === "quality control" ||
    department.includes("inspection") ||
    department === "showroom" ||
    department.includes("final qc")
  ) {
    return "Final QC / Showroom";
  }

  if (
    department === "showroom" ||
    department === "ready for pickup" ||
    department === "ready for delivery" ||
    department === "pickup" ||
    department === "shipping"
  ) {
    return "Final QC / Showroom";
  }

  return "";
}

function getCustomerOrderShopStage(order) {
  const assignedStage =
    getCanonicalShopStage(order);

  if (assignedStage) {
    return assignedStage;
  }

  const statusValues = [
    order?.status,
    order?.design_status,
  ]
    .map(normalizeDepartment)
    .filter(Boolean);

  for (const status of statusValues) {
    if (
      status === "design" ||
      status === "design needed" ||
      status === "needs design" ||
      status === "in design"
    ) {
      return "Design";
    }

    if (
      status === "laser" ||
      status === "in laser" ||
      status === "ready for laser" ||
      status === "laser cutting"
    ) {
      return "Laser";
    }

    if (
      status === "prep" ||
      status === "in prep" ||
      status === "sandblast" ||
      status === "sandblasting" ||
      status === "surface prep"
    ) {
      return "Prep";
    }

    if (
      status === "weld" ||
      status === "welding" ||
      status === "in welding"
    ) {
      return "Welding";
    }

    if (
      status === "paint" ||
      status === "in paint" ||
      status === "powder" ||
      status === "powder coat" ||
      status === "powder coating" ||
      status === "paint powder" ||
      status === "paint and powder"
    ) {
      return "Paint/Powder";
    }

    if (
      status === "assembly" ||
      status === "in assembly"
    ) {
      return "Assembly";
    }

    if (
      status === "qc" ||
      status === "quality control" ||
      status === "in qc" ||
      status === "inspection"
    ) {
      return "QC";
    }

    if (
      status === "showroom" ||
      status === "ready for showroom" ||
      status === "ready for pickup" ||
      status === "ready for delivery" ||
      status === "pickup" ||
      status === "shipping"
    ) {
      return "Showroom";
    }
  }

  return "";
}

function isClosedStatus(status) {
  return [
    "completed",
    "complete",
    "closed",
    "cancelled",
    "canceled",
  ].includes(normalizeStatus(status));
}

function isProjectOpen(project) {
  return (
    project.is_active !== false &&
    !isClosedStatus(project.status)
  );
}

function isOrderOpen(order) {
  return !isClosedStatus(order.status);
}

function isWorkOrderOpen(workOrder) {
  return (
    workOrder.is_active !== false &&
    !isClosedStatus(workOrder.status)
  );
}

function isProductionJobOpen(job) {
  return (
    job.is_active !== false &&
    !isClosedStatus(job.status)
  );
}

function isWithinNextDays(dateValue, days = 7) {
  if (!dateValue) return false;

  const eventDate = new Date(dateValue);

  if (Number.isNaN(eventDate.getTime())) {
    return false;
  }

  const start = startOfToday();

  const end = new Date(start);
  end.setDate(end.getDate() + days);
  end.setHours(23, 59, 59, 999);

  return eventDate >= start && eventDate <= end;
}

function isToday(dateValue) {
  if (!dateValue) return false;

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return (
    date >= startOfToday() &&
    date <= endOfToday()
  );
}

function isWithinPreviousDays(dateValue, days = 7) {
  if (!dateValue) return false;

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  const end = endOfToday();

  const start = startOfToday();
  start.setDate(start.getDate() - days);

  return date >= start && date <= end;
}

function formatDateTime(dateValue) {
  if (!dateValue) {
    return {
      day: "",
      date: "",
      time: "",
    };
  }

  const date = new Date(dateValue);

  if (Number.isNaN(date.getTime())) {
    return {
      day: "",
      date: "",
      time: "",
    };
  }

  return {
    day: date.toLocaleDateString("en-US", {
      weekday: "short",
    }),

    date: date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    }),

    time: date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

function formatMoney(value) {
  const amount = Number(value || 0);

  return amount.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

function numberValue(value) {
  const number = Number(value || 0);

  return Number.isFinite(number)
    ? number
    : 0;
}

function clampScore(value) {
  return Math.max(
    0,
    Math.min(100, Math.round(numberValue(value)))
  );
}

function firstText(record, keys, fallback = "") {
  for (const key of keys) {
    const value = record?.[key];

    if (
      value !== null &&
      value !== undefined &&
      String(value).trim()
    ) {
      return String(value).trim();
    }
  }

  return fallback;
}

function firstDate(record, keys) {
  for (const key of keys) {
    const value = record?.[key];

    if (!value) continue;

    const date = new Date(value);

    if (!Number.isNaN(date.getTime())) {
      return date;
    }
  }

  return null;
}

function isActivePriorityRecord(record) {
  if (
    record?.is_active === false ||
    record?.active === false
  ) {
    return false;
  }

  return !isClosedStatus(
    firstText(record, [
      "status",
      "commitment_status",
      "item_status",
    ])
  );
}

function priorityRank(value) {
  const priority = normalizeStatus(value);

  if (
    priority.includes("critical") ||
    priority.includes("urgent")
  ) {
    return 0;
  }

  if (
    priority.includes("rush") ||
    priority.includes("high")
  ) {
    return 1;
  }

  if (
    priority.includes("normal") ||
    priority.includes("medium")
  ) {
    return 2;
  }

  return 3;
}

function buildPriorityRow(record, sourceType) {
  const dueAt = firstDate(record, [
    "required_by",
    "due_at",
    "due_date",
    "promised_at",
    "target_date",
    "work_date",
    "scheduled_for",
  ]);

  const hoursRemaining = dueAt
    ? Math.round(
        ((dueAt.getTime() - Date.now()) /
          (1000 * 60 * 60)) *
          10
      ) / 10
    : null;

  return {
    id: record.id,
    sourceType,
    sourceId:
      record.source_id ||
      record.project_id ||
      record.customer_order_id ||
      record.production_job_id ||
      record.work_order_id ||
      null,
    title: firstText(
      record,
      [
        "title",
        "item_title",
        "job_title",
        "project_name",
        "commitment_title",
        "name",
        "description",
      ],
      sourceType === "hotToday"
        ? "Hot Today Item"
        : "Quick Commitment"
    ),
    reference: firstText(record, [
      "reference_number",
      "project_number",
      "order_number",
      "job_number",
      "source_number",
    ]),
    department: firstText(
      record,
      [
        "department",
        "assigned_department",
        "current_department",
        "work_center",
      ],
      "Unassigned"
    ),
    owner: firstText(
      record,
      [
        "assigned_to",
        "owner_name",
        "employee_name",
        "owner",
      ],
      "Unassigned"
    ),
    priority: firstText(
      record,
      ["priority", "priority_level"],
      sourceType === "hotToday" ? "Hot" : "Normal"
    ),
    reason: firstText(record, [
      "reason",
      "hot_reason",
      "commitment_reason",
      "notes",
    ]),
    status: firstText(
      record,
      [
        "status",
        "commitment_status",
        "item_status",
      ],
      "Active"
    ),
    dueAt: dueAt?.toISOString() || null,
    dueDisplay: dueAt
      ? dueAt.toLocaleString("en-US", {
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : "No time set",
    hoursRemaining,
  };
}

function buildPriorityFeed(
  hotTodayRecords,
  quickCommitmentRecords
) {
  const hotToday = hotTodayRecords
    .filter(isActivePriorityRecord)
    .map((record) =>
      buildPriorityRow(record, "hotToday")
    );

  const quickCommitments =
    quickCommitmentRecords
      .filter(isActivePriorityRecord)
      .map((record) =>
        buildPriorityRow(
          record,
          "quickCommitment"
        )
      );

  const sorter = (a, b) => {
    const priorityDifference =
      priorityRank(a.priority) -
      priorityRank(b.priority);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    if (a.dueAt && b.dueAt) {
      return (
        new Date(a.dueAt) -
        new Date(b.dueAt)
      );
    }

    if (a.dueAt) return -1;
    if (b.dueAt) return 1;

    return a.title.localeCompare(b.title);
  };

  return {
    hotToday: hotToday.sort(sorter),
    quickCommitments:
      quickCommitments.sort(sorter),
    combined: [
      ...hotToday,
      ...quickCommitments,
    ].sort(sorter),
  };
}

function getProjectName(project) {
  return (
    project.project_name ||
    project.project_number ||
    "Outside Project"
  );
}

function getProjectOwner(project) {
  return (
    project.assigned_to ||
    project.intake_owner ||
    "Unassigned"
  );
}

function getProjectAddress(project) {
  return [
    project.job_address,
    project.city,
    project.state,
  ]
    .filter(Boolean)
    .join(", ");
}

function getProjectBalance(project) {
  return numberValue(project.balance_due);
}

function getDownPaymentAmount(project) {
  return numberValue(project.down_payment_amount);
}

function getProjectTotal(project) {
  return numberValue(project.project_total);
}

/* =====================================================
   PROJECT WORKFLOW
===================================================== */

function getProjectNextAction(project) {
  if (project.next_action) {
    return project.next_action;
  }

  if (
    project.site_visit_required &&
    normalizeStatus(project.site_visit_status) !==
      "completed"
  ) {
    return normalizeStatus(project.site_visit_status) ===
      "scheduled"
      ? "Complete Site Visit"
      : "Schedule Site Visit";
  }

  if (
    project.measurements_required &&
    normalizeStatus(project.measurements_status) !==
      "completed"
  ) {
    return "Complete Measurements";
  }

  if (
    project.quote_required &&
    normalizeStatus(project.quote_status) ===
      "not started"
  ) {
    return "Start Quote";
  }

  if (
    project.quote_required &&
    normalizeStatus(project.quote_status) ===
      "in progress"
  ) {
    return "Complete Quote";
  }

  if (
    project.quote_required &&
    normalizeStatus(project.quote_status) === "sent" &&
    normalizeStatus(project.approval_status) !==
      "approved"
  ) {
    return "Follow Up for Customer Approval";
  }

  if (
    normalizeStatus(project.approval_status) ===
      "approved" &&
    project.down_payment_required &&
    normalizeStatus(project.down_payment_status) !==
      "received"
  ) {
    return "Collect Down Payment";
  }

  if (
    normalizeStatus(project.material_status) ===
    "pricing needed"
  ) {
    return "Get Material Pricing";
  }

  if (
    normalizeStatus(project.material_status) ===
    "not started"
  ) {
    return "Review Material Requirements";
  }

  if (
    normalizeStatus(project.material_status) ===
    "ready to order"
  ) {
    return "Order Materials";
  }

  if (
    normalizeStatus(project.material_status) ===
    "ordered"
  ) {
    return "Check Material Delivery Status";
  }

  if (
    normalizeStatus(project.material_status) ===
    "partially received"
  ) {
    return "Check Remaining Material Delivery";
  }

  if (
    project.fabrication_required &&
    normalizeStatus(project.material_status) ===
      "received" &&
    normalizeStatus(project.fabrication_status) !==
      "completed"
  ) {
    return normalizeStatus(project.fabrication_status) ===
      "in progress"
      ? "Continue Fabrication"
      : "Start Fabrication";
  }

  if (
    project.test_fit_required &&
    normalizeStatus(project.fabrication_status) ===
      "completed" &&
    normalizeStatus(project.test_fit_status) !==
      "completed"
  ) {
    if (
      normalizeStatus(project.test_fit_status) ===
      "adjustments needed"
    ) {
      return "Complete Test Fit Adjustments";
    }

    if (
      normalizeStatus(project.test_fit_status) ===
      "scheduled"
    ) {
      return "Complete Test Fit";
    }

    return "Schedule Test Fit";
  }

  if (
    project.finish_required &&
    (
      !project.test_fit_required ||
      normalizeStatus(project.test_fit_status) ===
        "completed"
    ) &&
    normalizeStatus(project.finish_status) !==
      "completed"
  ) {
    if (
      normalizeStatus(project.finish_status) ===
      "at powder coat"
    ) {
      return "Check Powder Coat Status";
    }

    if (
      normalizeStatus(project.finish_status) ===
      "in progress"
    ) {
      return "Complete Finish Work";
    }

    return "Send to Paint / Powder Coat";
  }

  if (
    project.install_required &&
    (
      !project.finish_required ||
      normalizeStatus(project.finish_status) ===
        "completed"
    ) &&
    normalizeStatus(project.install_status) !==
      "completed"
  ) {
    if (
      ["scheduled", "in progress"].includes(
        normalizeStatus(project.install_status)
      )
    ) {
      return "Complete Installation";
    }

    return "Schedule Installation";
  }

  if (
    !["not required", "paid"].includes(
      normalizeStatus(project.balance_status)
    )
  ) {
    return "Collect Final Balance";
  }

  return "Review Project";
}

/* =====================================================
   FINANCIAL CONDITIONS
===================================================== */

function hasPaymentDue(project) {
  const balanceStatus =
    normalizeStatus(project.balance_status);

  const downPaymentStatus =
    normalizeStatus(project.down_payment_status);

  return (
    getProjectBalance(project) > 0 ||
    (
      project.down_payment_required === true &&
      downPaymentStatus !== "received" &&
      downPaymentStatus !== "not required"
    ) ||
    [
      "due",
      "pending",
      "unpaid",
      "overdue",
    ].includes(balanceStatus)
  );
}

function isPaymentOverdue(project) {
  const balanceStatus =
    normalizeStatus(project.balance_status);

  if (balanceStatus === "overdue") {
    return true;
  }

  const dueDate =
    project.balance_due_date ||
    project.payment_due_date;

  if (!dueDate || !hasPaymentDue(project)) {
    return false;
  }

  const date = new Date(dueDate);

  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date < startOfToday();
}

function needsDownPayment(project) {
  if (project.down_payment_required !== true) {
    return false;
  }

  const status =
    normalizeStatus(project.down_payment_status);

  return ![
    "received",
    "paid",
    "not required",
  ].includes(status);
}

function needsFinalBalance(project) {
  const status =
    normalizeStatus(project.balance_status);

  if (
    status === "not required" ||
    status === "paid"
  ) {
    return false;
  }

  return (
    getProjectBalance(project) > 0 ||
    [
      "due",
      "pending",
      "unpaid",
      "overdue",
    ].includes(status)
  );
}

/* =====================================================
   QUOTE CONDITIONS
===================================================== */

function needsQuote(project) {
  if (project.quote_required !== true) {
    return false;
  }

  const status =
    normalizeStatus(project.quote_status);

  return [
    "",
    "not started",
    "needed",
    "in progress",
    "pending",
  ].includes(status);
}

/* =====================================================
   MATERIAL CONDITIONS
===================================================== */

function getMaterialStage(project) {
  const status =
    normalizeStatus(project.material_status);

  if (status === "pricing needed") {
    return "Pricing Needed";
  }

  if (status === "not started") {
    return "Not Started";
  }

  if (status === "ready to order") {
    return "Needs Ordered";
  }

  if (status === "ordered") {
    return "Ordered / Waiting";
  }

  if (status === "partially received") {
    return "Partially Received";
  }

  if (status === "received") {
    return "Received";
  }

  if (
    status === "not required" ||
    status === "complete" ||
    status === "completed"
  ) {
    return "Complete";
  }

  return project.material_status || "Not Set";
}

function needsMaterialAction(project) {
  return [
    "Pricing Needed",
    "Not Started",
    "Needs Ordered",
    "Ordered / Waiting",
    "Partially Received",
  ].includes(getMaterialStage(project));
}

function materialsNeedOrdered(project) {
  return [
    "Pricing Needed",
    "Not Started",
    "Needs Ordered",
  ].includes(getMaterialStage(project));
}

function materialsWaiting(project) {
  return [
    "Ordered / Waiting",
    "Partially Received",
  ].includes(getMaterialStage(project));
}

/* =====================================================
   PROJECT HEALTH
===================================================== */

function getProjectHealth(project) {
  if (isPaymentOverdue(project)) {
    return "Blocked";
  }

  if (
    normalizeStatus(project.test_fit_status) ===
    "adjustments needed"
  ) {
    return "Blocked";
  }

  if (
    materialsWaiting(project) &&
    (
      project.fabrication_required ||
      project.install_required
    )
  ) {
    return "Blocked";
  }

  if (
    needsQuote(project) ||
    needsDownPayment(project) ||
    materialsNeedOrdered(project) ||
    needsFinalBalance(project)
  ) {
    return "Attention Needed";
  }

  return "On Track";
}

/* =====================================================
   PROJECT PRIORITY
===================================================== */

function getOutsideProjectPriority(project) {
  if (isPaymentOverdue(project)) return 1;
  if (needsQuote(project)) return 2;
  if (materialsNeedOrdered(project)) return 3;
  if (needsDownPayment(project)) return 4;
  if (materialsWaiting(project)) return 5;
  if (needsFinalBalance(project)) return 6;

  return 7;
}

function buildOutsideProjectRow(
  project,
  customerName
) {
  const balance =
    getProjectBalance(project);

  const downPayment =
    getDownPaymentAmount(project);

  const total =
    getProjectTotal(project);

  return {
    id: project.id,

    projectName:
      getProjectName(project),

    projectNumber:
      project.project_number || "",

    customer:
      customerName,

    status:
      project.status || "Open",

    owner:
      getProjectOwner(project),

    nextAction:
      getProjectNextAction(project),

    materialStatus:
      getMaterialStage(project),

    health:
      getProjectHealth(project),

    quoteNeeded:
      needsQuote(project),

    paymentDue:
      hasPaymentDue(project),

    paymentOverdue:
      isPaymentOverdue(project),

    downPaymentDue:
      needsDownPayment(project),

    finalBalanceDue:
      needsFinalBalance(project),

    balance,

    balanceDisplay:
      balance > 0
        ? formatMoney(balance)
        : "—",

    downPayment,

    downPaymentDisplay:
      downPayment > 0
        ? formatMoney(downPayment)
        : "—",

    total,

    totalDisplay:
      total > 0
        ? formatMoney(total)
        : "—",

    address:
      getProjectAddress(project) ||
      "No address entered",

    priority:
      getOutsideProjectPriority(project),
  };
}

/* =====================================================
   RECENT COMPLETIONS
===================================================== */

function getCompletionDate(record) {
  return (
    record.completed_at ||
    record.updated_at ||
    record.created_at ||
    null
  );
}

function buildRecentCompletions({
  customerOrders,
  projects,
  workOrders,
  productionJobs,
}) {
  const completed = [];

  customerOrders.forEach((order) => {
    if (!isClosedStatus(order.status)) return;

    const date = getCompletionDate(order);

    if (!isWithinPreviousDays(date, 7)) return;

    completed.push({
      id: `order-${order.id}`,
      sourceId: order.id,
      sourceType: "customerOrder",
      title:
        order.order_number ||
        order.order_type ||
        "Customer Order",
      type: "Customer Order",
      completedAt: date,
    });
  });

  projects.forEach((project) => {
    if (!isClosedStatus(project.status)) return;

    const date = getCompletionDate(project);

    if (!isWithinPreviousDays(date, 7)) return;

    completed.push({
      id: `project-${project.id}`,
      sourceId: project.id,
      sourceType: "project",
      title: getProjectName(project),
      type: "Outside Project",
      completedAt: date,
    });
  });

  workOrders.forEach((workOrder) => {
    if (!isClosedStatus(workOrder.status)) return;

    const date = getCompletionDate(workOrder);

    if (!isWithinPreviousDays(date, 7)) return;

    completed.push({
      id: `work-order-${workOrder.id}`,
      sourceId: workOrder.id,
      sourceType: "workOrder",
      title:
        workOrder.work_order_number ||
        workOrder.title ||
        "Work Order",
      type: "Work Order",
      completedAt: date,
    });
  });

  productionJobs.forEach((job) => {
    if (!isClosedStatus(job.status)) return;

    const date = getCompletionDate(job);

    if (!isWithinPreviousDays(date, 7)) return;

    completed.push({
      id: `production-${job.id}`,
      sourceId: job.id,
      sourceType: "productionJob",
      title:
        job.job_number ||
        job.product_name ||
        job.title ||
        "Production Job",
      type: "Production",
      completedAt: date,
    });
  });

  return completed
    .sort(
      (a, b) =>
        new Date(b.completedAt) -
        new Date(a.completedAt)
    )
    .slice(0, 8);
}

/* =====================================================
   DASHBOARD DATA
===================================================== */

export async function getDashboardData() {
  const [
    customerOrdersResult,
    projectsResult,
    workOrdersResult,
    productionJobsResult,
    customersResult,
    actionCenterData,
    hotTodayResult,
    quickCommitmentsResult,
  ] = await Promise.all([
    supabase
      .from("customer_orders")
      .select("*"),

    supabase
      .from("projects")
      .select("*"),

    supabase
      .from("work_orders")
      .select("*"),

    supabase
      .from("production_jobs")
      .select("*"),

    supabase
      .from("customers")
      .select("*"),

    getActionCenterData(),

    supabase
      .from("hot_today_items")
      .select("*"),

    supabase
      .from("quick_turnaround_commitments")
      .select("*"),
  ]);

  if (customerOrdersResult.error) {
    throw customerOrdersResult.error;
  }

  if (projectsResult.error) {
    throw projectsResult.error;
  }

  if (workOrdersResult.error) {
    throw workOrdersResult.error;
  }

  if (productionJobsResult.error) {
    throw productionJobsResult.error;
  }

  if (customersResult.error) {
    throw customersResult.error;
  }

  const customerOrders =
    customerOrdersResult.data || [];

  const projects =
    projectsResult.data || [];

  const workOrders =
    workOrdersResult.data || [];

  const productionJobs =
    productionJobsResult.data || [];

  const customers =
    customersResult.data || [];

  if (hotTodayResult.error) {
    console.warn(
      "Hot Today dashboard feed unavailable:",
      hotTodayResult.error
    );
  }

  if (quickCommitmentsResult.error) {
    console.warn(
      "Quick commitments dashboard feed unavailable:",
      quickCommitmentsResult.error
    );
  }

  const priorityFeed = buildPriorityFeed(
    hotTodayResult.data || [],
    quickCommitmentsResult.data || []
  );

  const customerMap = new Map(
    customers.map((customer) => [
      customer.id,
      customer,
    ])
  );

  function getCustomerName(customerId) {
    const customer =
      customerMap.get(customerId);

    if (!customer) {
      return "Customer";
    }

    if (customer.company_name) {
      return customer.company_name;
    }

    const fullName = [
      customer.first_name,
      customer.last_name,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      fullName ||
      customer.name ||
      "Customer"
    );
  }

  const openOrders =
    customerOrders.filter(isOrderOpen);

  const openProjects =
    projects.filter(isProjectOpen);

  const openWorkOrders =
    workOrders.filter(isWorkOrderOpen);

  const activeProductionJobs =
    productionJobs.filter(
      isProductionJobOpen
    );

  const productionOrderIds = new Set(
    activeProductionJobs
      .map((job) => job.customer_order_id)
      .filter(
        (orderId) =>
          orderId !== null &&
          orderId !== undefined
      )
      .map(String)
  );

  const activeShopOrders =
    openOrders
      .filter((order) => {
      if (
        productionOrderIds.has(
          String(order.id)
        )
      ) {
        return false;
      }

        return Boolean(
          getCustomerOrderShopStage(order)
        );
      })
      .map((order) => ({
        order,
        stage:
          getCustomerOrderShopStage(order),
      }));

  /* =====================================================
     SHOP FLOW
  ===================================================== */

  const departmentStages = [
    "Design",
    "Laser",
    "Welding",
    "Prep",
    "Paint/Powder",
    "Assembly",
    "Final QC / Showroom",
  ];

  const shopFlow =
    departmentStages.map((department) => ({
      name: department,
      capacity: 10,
      count: new Set(
        openWorkOrders
          .filter(
            (workOrder) =>
              workOrder.is_active !== false &&
              ["ready", "in progress", "on hold"].includes(
                normalizeStatus(workOrder.status)
              ) &&
              getCanonicalShopStage(workOrder) === department
          )
          .map(
            (workOrder) =>
              workOrder.production_job_id || `work-order-${workOrder.id}`
          )
      ).size,
    }));

  /* =====================================================
     DAILY ATTENTION
  ===================================================== */

  const allActions =
    actionCenterData.actions || [];

  const dailyAttention =
    allActions
      .slice(0, 8)
      .map((action) => ({
        id: action.id,
        sourceId: action.sourceId,
        sourceType: action.sourceType,
        title: action.title,
        type: `${action.customer} • ${action.category}`,
        issue: action.reason,
        next: action.nextAction,
        owner: action.owner,
        status: action.dueDate,
        tag: String(
          action.category || "Action"
        ).toUpperCase(),
        priority: action.priority,
      }));

  /* =====================================================
     OUTSIDE PROJECTS
  ===================================================== */

  const outsideProjects =
    openProjects
      .map((project) =>
        buildOutsideProjectRow(
          project,
          getCustomerName(
            project.customer_id
          )
        )
      )
      .sort((a, b) => {
        if (a.priority !== b.priority) {
          return a.priority - b.priority;
        }

        return a.projectName.localeCompare(
          b.projectName
        );
      });

  /* =====================================================
     OUTSIDE SCHEDULE
  ===================================================== */

  const outsideSchedule = [];

  openProjects.forEach((project) => {
    const customerName =
      getCustomerName(
        project.customer_id
      );

    const projectName =
      getProjectName(project);

    const address =
      getProjectAddress(project);

    const owner =
      getProjectOwner(project);

    if (
      project.site_visit_start &&
      isWithinNextDays(
        project.site_visit_start,
        7
      )
    ) {
      const formatted =
        formatDateTime(
          project.site_visit_start
        );

      outsideSchedule.push({
        id: `site-${project.id}`,
        projectId: project.id,

        sortDate:
          new Date(
            project.site_visit_start
          ).getTime(),

        day: formatted.day,
        date: formatted.date,
        time: formatted.time,

        owner,
        customer: customerName,

        job:
          `${projectName} • Site Visit`,

        location:
          address ||
          "Customer Location",

        status: "Site Visit",

        isToday:
          isToday(
            project.site_visit_start
          ),
      });
    }

    if (
      project.test_fit_start &&
      isWithinNextDays(
        project.test_fit_start,
        7
      )
    ) {
      const formatted =
        formatDateTime(
          project.test_fit_start
        );

      outsideSchedule.push({
        id: `test-fit-${project.id}`,
        projectId: project.id,

        sortDate:
          new Date(
            project.test_fit_start
          ).getTime(),

        day: formatted.day,
        date: formatted.date,
        time: formatted.time,

        owner:
          project.assigned_to ||
          "Field Team",

        customer:
          customerName,

        job:
          `${projectName} • Test Fit`,

        location:
          address ||
          "Job Site",

        status:
          "Test Fit",

        isToday:
          isToday(
            project.test_fit_start
          ),
      });
    }

    if (
      project.install_start &&
      isWithinNextDays(
        project.install_start,
        7
      )
    ) {
      const formatted =
        formatDateTime(
          project.install_start
        );

      outsideSchedule.push({
        id: `install-${project.id}`,
        projectId: project.id,

        sortDate:
          new Date(
            project.install_start
          ).getTime(),

        day: formatted.day,
        date: formatted.date,
        time: formatted.time,

        owner:
          project.assigned_to ||
          "Install Team",

        customer:
          customerName,

        job:
          `${projectName} • Installation`,

        location:
          address ||
          "Job Site",

        status:
          "Install",

        isToday:
          isToday(
            project.install_start
          ),
      });
    }
  });

  outsideSchedule.sort(
    (a, b) =>
      a.sortDate - b.sortDate
  );

  /* =====================================================
     OUTSIDE OPERATIONAL CONDITIONS
  ===================================================== */

  const paymentProjects =
    outsideProjects.filter(
      (project) =>
        project.paymentDue
    );

  const overduePaymentProjects =
    outsideProjects.filter(
      (project) =>
        project.paymentOverdue
    );

  const downPaymentProjects =
    outsideProjects.filter(
      (project) =>
        project.downPaymentDue
    );

  const finalBalanceProjects =
    outsideProjects.filter(
      (project) =>
        project.finalBalanceDue
    );

  const quoteProjects =
    outsideProjects.filter(
      (project) =>
        project.quoteNeeded
    );

  const materialActionProjects =
    openProjects.filter(
      needsMaterialAction
    );

  const materialOrderProjects =
    openProjects.filter(
      materialsNeedOrdered
    );

  const materialWaitingProjects =
    openProjects.filter(
      materialsWaiting
    );

  const totalOutstandingBalance =
    paymentProjects.reduce(
      (sum, project) =>
        sum +
        numberValue(project.balance),
      0
    );

  const totalOverdueBalance =
    overduePaymentProjects.reduce(
      (sum, project) =>
        sum +
        numberValue(project.balance),
      0
    );

  /* =====================================================
     MORNING HUDDLE
  ===================================================== */

  const projectHealth = {
    onTrack:
      outsideProjects.filter(
        (project) =>
          project.health === "On Track"
      ).length,

    attentionNeeded:
      outsideProjects.filter(
        (project) =>
          project.health === "Attention Needed"
      ).length,

    blocked:
      outsideProjects.filter(
        (project) =>
          project.health === "Blocked"
      ).length,
  };

  const todayFieldWork =
    outsideSchedule.filter(
      (item) => item.isToday
    );

  const upcomingFieldWork =
    outsideSchedule.filter(
      (item) => !item.isToday
    );

  const blockerItems = [];

  overduePaymentProjects.forEach((project) => {
    blockerItems.push({
      id: `payment-${project.id}`,
      sourceId: project.id,
      sourceType: "project",
      type: "Payment",
      title: project.projectName,
      detail: "Payment or balance is overdue",
      owner: project.owner,
      severity: "High",
    });
  });

  openProjects
    .filter(materialsWaiting)
    .forEach((project) => {
      blockerItems.push({
        id: `material-${project.id}`,
        sourceId: project.id,
        sourceType: "project",
        type: "Material",
        title: getProjectName(project),
        detail:
          getMaterialStage(project) ===
          "Partially Received"
            ? "Waiting on remaining material"
            : "Waiting on ordered material",
        owner: getProjectOwner(project),
        severity: "High",
      });
    });

  openProjects
    .filter(
      (project) =>
        normalizeStatus(
          project.test_fit_status
        ) === "adjustments needed"
    )
    .forEach((project) => {
      blockerItems.push({
        id: `test-fit-${project.id}`,
        sourceId: project.id,
        sourceType: "project",
        type: "Test Fit",
        title: getProjectName(project),
        detail: "Test fit adjustments are required",
        owner: getProjectOwner(project),
        severity: "High",
      });
    });

  const todayFocus =
    allActions
      .filter((action) => {
        const dueText =
          normalizeStatus(action.dueDate);

        return (
          dueText.includes("today") ||
          normalizeStatus(action.priority) ===
            "high" ||
          normalizeStatus(action.priority) ===
            "urgent"
        );
      })
      .slice(0, 5)
      .map((action) => ({
        id: action.id,
        sourceId: action.sourceId,
        sourceType: action.sourceType,
        title: action.title,
        nextAction: action.nextAction,
        owner: action.owner,
        category: action.category,
        dueDate: action.dueDate,
      }));

  const recentCompletions =
    buildRecentCompletions({
      customerOrders,
      projects,
      workOrders,
      productionJobs,
    });

  const totalShopJobs =
    shopFlow.reduce(
      (sum, department) =>
        sum + department.count,
      0
    );

  const busiestDepartment =
    shopFlow.reduce(
      (busiest, department) => {
        if (!busiest) return department;

        return department.count >
          busiest.count
          ? department
          : busiest;
      },
      null
    );

  const morningHuddle = {
    summary: {
      todayActions:
        actionCenterData.counts
          ?.dueToday || 0,

      overdueActions:
        actionCenterData.counts
          ?.overdue || 0,

      todayFieldWork:
        todayFieldWork.length,

      upcomingFieldWork:
        upcomingFieldWork.length,

      activeShopJobs:
        activeProductionJobs.length,

      blockers:
        blockerItems.length,

      completedLast7Days:
        recentCompletions.length,

      totalShopJobs,

      busiestDepartment:
        busiestDepartment?.name ||
        "None",

      busiestDepartmentCount:
        busiestDepartment?.count || 0,
    },

    projectHealth,

    shopWorkload: shopFlow,

    todayFocus,

    todayFieldWork,

    upcomingFieldWork,

    blockers:
      blockerItems.slice(0, 8),

    recentCompletions,
  };

  const totalProjectHealth =
    projectHealth.onTrack +
    projectHealth.attentionNeeded +
    projectHealth.blocked;

  const projectHealthScore =
    totalProjectHealth > 0
      ? ((projectHealth.onTrack +
          projectHealth.attentionNeeded * 0.55) /
          totalProjectHealth) *
        100
      : 100;

  const scheduleHealthScore =
    100 -
    (actionCenterData.counts?.overdue || 0) *
      12 -
    (actionCenterData.counts?.dueToday || 0) *
      2;

  const materialHealthScore =
    100 -
    materialOrderProjects.length * 9 -
    materialWaitingProjects.length * 5;

  const blockerHealthScore =
    100 - blockerItems.length * 14;

  const productionHealthScore =
    activeProductionJobs.length === 0
      ? 100
      : totalShopJobs === 0
        ? 60
        : 92;

  const operationsHealthItems = [
    {
      label: "Schedule",
      score: clampScore(scheduleHealthScore),
      detail: `${
        actionCenterData.counts?.overdue || 0
      } overdue`,
    },
    {
      label: "Projects",
      score: clampScore(projectHealthScore),
      detail: `${projectHealth.blocked} blocked`,
    },
    {
      label: "Production",
      score: clampScore(productionHealthScore),
      detail: `${activeProductionJobs.length} active jobs`,
    },
    {
      label: "Materials",
      score: clampScore(materialHealthScore),
      detail: `${materialOrderProjects.length} need ordering`,
    },
    {
      label: "Blockers",
      score: clampScore(blockerHealthScore),
      detail: `${blockerItems.length} active`,
    },
  ];

  const operationsHealth = {
    score: clampScore(
      operationsHealthItems.reduce(
        (sum, item) => sum + item.score,
        0
      ) / operationsHealthItems.length
    ),
    status:
      operationsHealthItems.some(
        (item) => item.score < 60
      )
        ? "Action Required"
        : operationsHealthItems.some(
              (item) => item.score < 80
            )
          ? "Watch"
          : "Healthy",
    items: operationsHealthItems,
  };

  /* =====================================================
     RETURN DASHBOARD
  ===================================================== */

  return {
    stats: {
      openOrders:
        openOrders.length,

      openProjects:
        openProjects.length,

      openWorkOrders:
        openWorkOrders.length,

      dueToday:
        actionCenterData.counts
          ?.dueToday || 0,

      overdue:
        actionCenterData.counts
          ?.overdue || 0,

      paymentsDue:
        paymentProjects.length,

      quotesNeeded:
        quoteProjects.length,

      materialActions:
        materialActionProjects.length,

      siteVisits:
        openProjects.filter(
          (project) =>
            project.site_visit_required ===
              true &&
            normalizeStatus(
              project.site_visit_status
            ) !== "completed"
        ).length,

      installs:
        openProjects.filter(
          (project) =>
            project.install_required ===
              true &&
            ![
              "completed",
              "complete",
              "not required",
            ].includes(
              normalizeStatus(
                project.install_status
              )
            )
        ).length,

      inProduction:
        activeProductionJobs.length,
    },

    outsideSummary: {
      paymentsDue:
        paymentProjects.length,

      overdueBalances:
        overduePaymentProjects.length,

      downPayments:
        downPaymentProjects.length,

      finalBalances:
        finalBalanceProjects.length,

      quotesNeeded:
        quoteProjects.length,

      materialsNeedOrdered:
        materialOrderProjects.length,

      materialsWaiting:
        materialWaitingProjects.length,

      totalOutstandingBalance,

      totalOutstandingBalanceDisplay:
        formatMoney(
          totalOutstandingBalance
        ),

      totalOverdueBalance,

      totalOverdueBalanceDisplay:
        formatMoney(
          totalOverdueBalance
        ),
    },

    outsideProjects,
    dailyAttention,
    outsideSchedule,
    shopFlow,
    morningHuddle,
    priorityFeed,
    operationsHealth,
  };
}
