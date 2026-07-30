import { supabase } from "../lib/supabase";
import { getOpenCallbacks } from "./callbackService";

function isClosedStatus(status) {
  return ["Completed", "Complete", "Closed", "Cancelled", "Canceled"].includes(
    status
  );
}

function isOpenStatus(status) {
  return !isClosedStatus(status);
}

function getTodayStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function isPastDue(dateValue) {
  if (!dateValue) return false;
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return false;
  date.setHours(0, 0, 0, 0);
  return date < getTodayStart();
}

function moneyNumber(value) {
  const number = Number(value || 0);
  return Number.isFinite(number) ? number : 0;
}

function countBy(items, getKey) {
  const counts = {};

  items.forEach((item) => {
    const key = getKey(item) || "Unassigned";
    counts[key] = (counts[key] || 0) + 1;
  });

  return Object.entries(counts)
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value);
}

function sumBy(items, getValue) {
  return items.reduce((total, item) => total + moneyNumber(getValue(item)), 0);
}

function getProjectPipelineValue(project) {
  return (
    moneyNumber(project.quote_total) ||
    moneyNumber(project.quoted_amount) ||
    moneyNumber(project.total_amount) ||
    moneyNumber(project.project_value) ||
    0
  );
}

function getProjectBalance(project) {
  const directBalance =
    moneyNumber(project.balance_due) ||
    moneyNumber(project.remaining_balance);

  if (directBalance > 0) return directBalance;

  const paymentsReceived =
    moneyNumber(project.amount_paid) +
    moneyNumber(project.down_payment_amount);

  return Math.max(getProjectPipelineValue(project) - paymentsReceived, 0);
}

function getOrderBalance(order) {
  const total = moneyNumber(order.total_amount);
  const deposit = order.deposit_received
    ? moneyNumber(order.deposit_amount)
    : 0;
  return Math.max(total - deposit, 0);
}

function getWorkOrderDepartment(workOrder) {
  return (
    workOrder.current_department ||
    workOrder.department ||
    workOrder.assigned_department ||
    workOrder.production_department ||
    "Unassigned"
  );
}

export async function getWeeklyOperationsSummary(weekStart = null) {
  const { data, error } = await supabase.rpc("mw_weekly_operations_summary", {
    p_week_start: weekStart || null,
  });

  if (error) throw error;
  return data || null;
}

export async function saveWeeklyOperationsGoals(goals) {
  const { data, error } = await supabase.rpc(
    "mw_save_weekly_operations_goals",
    {
      p_week_start: goals.week_start,
      p_production_jobs_target: Number(goals.production_jobs_target || 0),
      p_production_steps_target: Number(goals.production_steps_target || 0),
      p_customer_orders_target: Number(goals.customer_orders_target || 0),
      p_outside_projects_target: Number(goals.outside_projects_target || 0),
      p_on_time_percent_target: Number(goals.on_time_percent_target || 90),
      p_site_visits_target: Number(goals.site_visits_target || 0),
      p_weekly_focus: goals.weekly_focus || null,
      p_management_notes: goals.management_notes || null,
    }
  );

  if (error) throw error;
  return data;
}

export async function getReportsData() {
  const [
    customerOrdersResult,
    projectsResult,
    productionJobsResult,
    workOrdersResult,
    customersResult,
    callbacks,
  ] = await Promise.all([
    supabase.from("customer_orders").select("*"),
    supabase.from("projects").select("*"),
    supabase.from("production_jobs").select("*"),
    supabase.from("work_orders").select("*"),
    supabase.from("customers").select("*"),
    getOpenCallbacks(),
  ]);

  if (customerOrdersResult.error) throw customerOrdersResult.error;
  if (projectsResult.error) throw projectsResult.error;
  if (productionJobsResult.error) throw productionJobsResult.error;
  if (workOrdersResult.error) throw workOrdersResult.error;
  if (customersResult.error) throw customersResult.error;

  const customerOrders = customerOrdersResult.data || [];
  const projects = projectsResult.data || [];
  const productionJobs = productionJobsResult.data || [];
  const workOrders = workOrdersResult.data || [];
  const customers = customersResult.data || [];
  const openCallbacks = callbacks || [];

  const openOrders = customerOrders.filter((order) => isOpenStatus(order.status));
  const openProjects = projects.filter(
    (project) => project.is_active !== false && isOpenStatus(project.status)
  );
  const activeProductionJobs = productionJobs.filter((job) =>
    isOpenStatus(job.status)
  );
  const activeWorkOrders = workOrders.filter((workOrder) =>
    isOpenStatus(workOrder.status)
  );

  const overdueOrders = openOrders.filter((order) => isPastDue(order.due_date));
  const overdueProjects = openProjects.filter((project) =>
    isPastDue(project.due_date || project.target_completion_date)
  );
  const overdueCallbacks = openCallbacks.filter((callback) =>
    isPastDue(callback.due_at)
  );

  const orderPipelineValue = sumBy(openOrders, (order) => order.total_amount);
  const projectPipelineValue = sumBy(openProjects, getProjectPipelineValue);
  const openOrderBalance = sumBy(openOrders, getOrderBalance);
  const openProjectBalance = sumBy(openProjects, getProjectBalance);

  const orderStatusBreakdown = countBy(
    openOrders,
    (order) => order.status || "Unknown"
  );
  const projectStatusBreakdown = countBy(
    openProjects,
    (project) => project.status || "Unknown"
  );
  const orderOwnerBreakdown = countBy(
    openOrders,
    (order) => order.order_owner || "Unassigned"
  );
  const projectOwnerBreakdown = countBy(
    openProjects,
    (project) => project.assigned_to || project.intake_owner || "Unassigned"
  );
  const callbackOwnerBreakdown = countBy(
    openCallbacks,
    (callback) => callback.assigned_to || "Unassigned"
  );
  const departmentWorkload = countBy(activeWorkOrders, getWorkOrderDepartment);
  const productionStatusBreakdown = countBy(
    activeProductionJobs,
    (job) => job.status || "Unknown"
  );

  const customerOrderCounts = {};
  customerOrders.forEach((order) => {
    if (!order.customer_id) return;
    customerOrderCounts[order.customer_id] =
      (customerOrderCounts[order.customer_id] || 0) + 1;
  });

  const topCustomers = customers
    .map((customer) => ({
      id: customer.id,
      label:
        customer.company_name ||
        [customer.first_name, customer.last_name].filter(Boolean).join(" ") ||
        customer.name ||
        "Unnamed Customer",
      value: customerOrderCounts[customer.id] || 0,
    }))
    .filter((customer) => customer.value > 0)
    .sort((a, b) => b.value - a.value)
    .slice(0, 10);

  const attentionItems = [
    { label: "Overdue Customer Orders", value: overdueOrders.length, type: "order" },
    {
      label: "Overdue Outside Projects",
      value: overdueProjects.length,
      type: "project",
    },
    { label: "Overdue Callbacks", value: overdueCallbacks.length, type: "callback" },
    { label: "Open Callbacks", value: openCallbacks.length, type: "callback" },
  ];

  return {
    summary: {
      openOrders: openOrders.length,
      openProjects: openProjects.length,
      activeProductionJobs: activeProductionJobs.length,
      openCallbacks: openCallbacks.length,
      overdueWork:
        overdueOrders.length + overdueProjects.length + overdueCallbacks.length,
      orderPipelineValue,
      projectPipelineValue,
      totalPipelineValue: orderPipelineValue + projectPipelineValue,
      openOrderBalance,
      openProjectBalance,
      totalOutstandingBalance: openOrderBalance + openProjectBalance,
    },
    orderStatusBreakdown,
    projectStatusBreakdown,
    productionStatusBreakdown,
    departmentWorkload,
    orderOwnerBreakdown,
    projectOwnerBreakdown,
    callbackOwnerBreakdown,
    topCustomers,
    attentionItems,
    overdue: {
      orders: overdueOrders,
      projects: overdueProjects,
      callbacks: overdueCallbacks,
    },
    raw: {
      customerOrders,
      projects,
      productionJobs,
      workOrders,
      customers,
      callbacks: openCallbacks,
    },
  };
}