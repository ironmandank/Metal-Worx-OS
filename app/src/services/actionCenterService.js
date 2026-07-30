import { supabase } from "../lib/supabase";
import { getOpenCallbacks } from "./callbackService";

function isClosedStatus(status) {
  return [
    "Completed",
    "Complete",
    "Closed",
    "Cancelled",
    "Canceled",
  ].includes(status);
}

function getTodayStart() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return today;
}

function getTodayEnd() {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  return today;
}

function isPastDue(dateValue) {
  if (!dateValue) return false;

  const date = new Date(dateValue);
  date.setHours(0, 0, 0, 0);

  return date < getTodayStart();
}

function isDueToday(dateValue) {
  if (!dateValue) return false;

  const date = new Date(dateValue);

  return (
    date >= getTodayStart() &&
    date <= getTodayEnd()
  );
}

function formatDate(dateValue) {
  if (!dateValue) return "No date";

  return new Date(dateValue).toLocaleDateString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
    }
  );
}

function formatDateTime(dateValue) {
  if (!dateValue) return "No date";

  return new Date(dateValue).toLocaleString(
    "en-US",
    {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }
  );
}

/* =====================================================
   PROJECT WORKFLOW
===================================================== */

function getProjectAction(project) {
  if (project.next_action) {
    return project.next_action;
  }

  if (
    project.site_visit_required &&
    project.site_visit_status !== "Completed"
  ) {
    return project.site_visit_status === "Scheduled"
      ? "Complete Site Visit"
      : "Schedule Site Visit";
  }

  if (
    project.measurements_required &&
    project.measurements_status !== "Completed"
  ) {
    return "Complete Measurements";
  }

  if (
    project.quote_required &&
    project.quote_status === "Not Started"
  ) {
    return "Start Quote";
  }

  if (
    project.quote_required &&
    project.quote_status === "In Progress"
  ) {
    return "Complete Quote";
  }

  if (
    project.quote_required &&
    project.quote_status === "Sent" &&
    project.approval_status !== "Approved"
  ) {
    return "Follow Up for Customer Approval";
  }

  if (
    project.approval_status === "Approved" &&
    project.down_payment_required &&
    project.down_payment_status !== "Received"
  ) {
    return "Collect Down Payment";
  }

  if (project.material_status === "Pricing Needed") {
    return "Get Material Pricing";
  }

  if (project.material_status === "Not Started") {
    return "Review Material Requirements";
  }

  if (project.material_status === "Ready to Order") {
    return "Order Materials";
  }

  if (project.material_status === "Ordered") {
    return "Check Material Delivery Status";
  }

  if (
    project.material_status === "Partially Received"
  ) {
    return "Check Remaining Material Delivery";
  }

  if (
    project.fabrication_required &&
    project.material_status === "Received" &&
    project.fabrication_status !== "Completed"
  ) {
    return project.fabrication_status === "In Progress"
      ? "Continue Fabrication"
      : "Start Fabrication";
  }

  if (
    project.test_fit_required &&
    project.fabrication_status === "Completed" &&
    project.test_fit_status !== "Completed"
  ) {
    if (
      project.test_fit_status === "Adjustments Needed"
    ) {
      return "Complete Test Fit Adjustments";
    }

    if (project.test_fit_status === "Scheduled") {
      return "Complete Test Fit";
    }

    return "Schedule Test Fit";
  }

  if (
    project.finish_required &&
    (
      !project.test_fit_required ||
      project.test_fit_status === "Completed"
    ) &&
    project.finish_status !== "Completed"
  ) {
    if (project.finish_status === "At Powder Coat") {
      return "Check Powder Coat Status";
    }

    if (project.finish_status === "In Progress") {
      return "Complete Finish Work";
    }

    return "Send to Paint / Powder Coat";
  }

  if (
    project.install_required &&
    (
      !project.finish_required ||
      project.finish_status === "Completed"
    ) &&
    project.install_status !== "Completed"
  ) {
    if (
      project.install_status === "Scheduled" ||
      project.install_status === "In Progress"
    ) {
      return "Complete Installation";
    }

    return "Schedule Installation";
  }

  if (
    project.balance_status !== "Not Required" &&
    project.balance_status !== "Paid"
  ) {
    return "Collect Final Balance";
  }

  return "Review Project";
}

function getProjectCategory(project, dueDate) {
  if (isPastDue(dueDate)) {
    return "Overdue";
  }

  if (isDueToday(dueDate)) {
    return "Due Today";
  }

  const nextAction =
    getProjectAction(project).toLowerCase();

  if (
    nextAction.includes("payment") ||
    nextAction.includes("balance") ||
    nextAction.includes("deposit")
  ) {
    return "Payment";
  }

  if (nextAction.includes("quote")) {
    return "Quote";
  }

  if (
    nextAction.includes("material") ||
    nextAction.includes("pricing")
  ) {
    return "Material";
  }

  return "Next Action";
}

/* =====================================================
   CUSTOMER ORDER WORKFLOW
===================================================== */

function getOrderAction(order) {
  if (
    order.design_needed === true &&
    order.design_status !== "Completed" &&
    order.design_status !== "Approved"
  ) {
    return "Complete Design Work";
  }

  if (
    order.deposit_received === false &&
    Number(order.down_payment ?? order.deposit_amount ?? 0) > 0
  ) {
    return "Collect Customer Deposit";
  }

  if (order.status === "New") {
    return "Review New Order";
  }

  if (order.status === "In Production") {
    return "Continue Production";
  }

  if (order.status === "Ready") {
    return "Contact Customer for Pickup";
  }

  return "Review Order Status";
}

function getOrderCategory(order) {
  if (isPastDue(order.due_date)) {
    return "Overdue";
  }

  if (isDueToday(order.due_date)) {
    return "Due Today";
  }

  const action =
    getOrderAction(order).toLowerCase();

  if (
    action.includes("deposit") ||
    action.includes("payment") ||
    action.includes("balance")
  ) {
    return "Payment";
  }

  return "Next Action";
}

/* =====================================================
   CALLBACK HELPERS
===================================================== */

function getCallbackCategory(callback) {
  if (isPastDue(callback.due_at)) {
    return "Overdue";
  }

  if (isDueToday(callback.due_at)) {
    return "Due Today";
  }

  return "Callback";
}

function getCallbackCustomer(callback) {
  if (callback.contact_name) {
    return callback.contact_name;
  }

  if (callback.company_name) {
    return callback.company_name;
  }

  return "Callback / Follow-Up";
}

function getCallbackReason(callback) {
  const parts = [];

  if (callback.contact_name) {
    parts.push(callback.contact_name);
  }

  if (callback.phone) {
    parts.push(callback.phone);
  }

  if (callback.notes) {
    parts.push(callback.notes);
  }

  return parts.length > 0
    ? parts.join(" • ")
    : "Callback or follow-up requires attention.";
}

/* =====================================================
   MAIN ACTION CENTER SERVICE
===================================================== */

export async function getActionCenterData() {
  const [
    customerOrdersResult,
    projectsResult,
    customersResult,
    orderItemsResult,
    callbacks,
  ] = await Promise.all([
    supabase
      .from("customer_orders")
      .select("*"),

    supabase
      .from("projects")
      .select("*"),

    supabase
      .from("customers")
      .select("*"),

    supabase
      .from("customer_order_items")
      .select("*"),

    getOpenCallbacks(),
  ]);

  if (customerOrdersResult.error) {
    throw customerOrdersResult.error;
  }

  if (projectsResult.error) {
    throw projectsResult.error;
  }

  if (customersResult.error) {
    throw customersResult.error;
  }

  if (orderItemsResult.error) {
    throw orderItemsResult.error;
  }

  const customerOrders =
    customerOrdersResult.data || [];

  const projects =
    projectsResult.data || [];

  const customers =
    customersResult.data || [];

  const orderItems =
    orderItemsResult.data || [];

  const templateIds = [
    ...new Set(
      orderItems
        .map((item) => item.product_template_id)
        .filter(Boolean)
    ),
  ];

  let templates = [];

  if (templateIds.length) {
    const { data: templateData, error: templateError } = await supabase
      .from("product_templates")
      .select("*")
      .in("id", templateIds);

    if (templateError) {
      throw templateError;
    }

    templates = templateData || [];
  }

  const customerMap = new Map(
    customers.map((customer) => [
      customer.id,
      customer,
    ])
  );

  const templatesById = new Map(
    templates.map((template) => [
      template.id,
      template,
    ])
  );

  const itemsByOrderId = new Map();

  orderItems.forEach((item) => {
    const currentItems =
      itemsByOrderId.get(item.order_id) || [];

    currentItems.push(item);
    itemsByOrderId.set(item.order_id, currentItems);
  });

  function getCustomerName(customerId) {
    const customer = customerMap.get(customerId);

    if (!customer) {
      return "Customer";
    }

    const name = [
      customer.first_name,
      customer.last_name,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      name ||
      customer.contact_name ||
      customer.name ||
      customer.company_name ||
      "Customer"
    );
  }

  function getCustomerCompany(customerId) {
    const customer = customerMap.get(customerId);
    if (!customer?.company_name) return "";

    return customer.company_name === getCustomerName(customerId)
      ? ""
      : customer.company_name;
  }

  function getOrderItemNames(orderId) {
    const names = (itemsByOrderId.get(orderId) || [])
      .map((item) => {
        const product = templatesById.get(
          item.product_template_id
        );

        return (
          product?.name ||
          item.item_name ||
          item.design_name ||
          item.description ||
          item.notes
        );
      })
      .filter(Boolean);

    return names.length
      ? [...new Set(names)].join(", ")
      : "Item not specified";
  }

  const actions = [];

  /* =====================================================
     CUSTOMER ORDERS
     ONE ACTION PER OPEN ORDER
  ===================================================== */

  customerOrders
    .filter(
      (order) =>
        !isClosedStatus(order.status)
    )
    .forEach((order) => {
      const nextAction =
        getOrderAction(order);

      const category =
        getOrderCategory(order);

      actions.push({
        id: `order-${order.id}`,

        sourceId: order.id,
        sourceType: "customerOrder",

        category,

        priority:
          category === "Overdue" ||
          category === "Due Today"
            ? "High"
            : "Medium",

        title:
          getOrderItemNames(order.id),

        customer:
          getCustomerName(
            order.customer_id
          ),

        company:
          getCustomerCompany(
            order.customer_id
          ),

        reference:
          order.order_number ||
          order.customer_order_number ||
          "Customer Order",

        reason:
          category === "Overdue"
            ? "Order is past its due date."
            : category === "Due Today"
              ? "Order is due today."
              : "Order requires the next workflow action.",

        nextAction,

        owner:
          order.order_owner ||
          "Unassigned",

        dueDate:
          formatDate(order.due_date),

        sortDate:
          order.due_date
            ? new Date(
                order.due_date
              ).getTime()
            : Number.MAX_SAFE_INTEGER,
      });
    });

  /* =====================================================
     PROJECTS
     ONE ACTION PER OPEN PROJECT
  ===================================================== */

  projects
    .filter(
      (project) =>
        project.is_active !== false &&
        !isClosedStatus(project.status)
    )
    .forEach((project) => {
      const dueDate =
        project.due_date ||
        project.target_completion_date;

      const nextAction =
        getProjectAction(project);

      const category =
        getProjectCategory(
          project,
          dueDate
        );

      const projectName =
        project.project_name ||
        project.project_number ||
        "Outside Project";

      actions.push({
        id: `project-${project.id}`,

        sourceId: project.id,
        sourceType: "project",

        category,

        priority:
          category === "Overdue" ||
          category === "Due Today"
            ? "High"
            : "Medium",

        title: projectName,

        customer:
          getCustomerName(
            project.customer_id
          ),

        company:
          getCustomerCompany(
            project.customer_id
          ),

        reference:
          project.project_number ||
          project.work_order_number ||
          "",

        reason:
          category === "Overdue"
            ? "Project is past its due or target completion date."
            : category === "Due Today"
              ? "Project requires attention today."
              : "Project requires the next workflow action.",

        nextAction,

        owner:
          project.assigned_to ||
          project.intake_owner ||
          "Unassigned",

        dueDate:
          formatDate(dueDate),

        sortDate:
          dueDate
            ? new Date(
                dueDate
              ).getTime()
            : Number.MAX_SAFE_INTEGER,
      });
    });

  /* =====================================================
     CALLBACKS & FOLLOW-UPS
     ONE ACTION PER OPEN CALLBACK
  ===================================================== */

  (callbacks || []).forEach((callback) => {
    const category =
      getCallbackCategory(callback);

    actions.push({
      id: `callback-${callback.id}`,

      sourceId: callback.id,
      sourceType: "callback",

      category,

      priority:
        category === "Overdue" ||
        category === "Due Today"
          ? "High"
          : callback.priority || "Medium",

      title:
        callback.title ||
        callback.callback_type ||
        "Callback",

      customer:
        getCallbackCustomer(callback),

      company:
        callback.company_name &&
        callback.company_name !==
          getCallbackCustomer(callback)
          ? callback.company_name
          : "",

      reference:
        callback.phone || "",

      reason:
        getCallbackReason(callback),

      nextAction:
        callback.callback_type === "Follow-Up"
          ? "Complete Follow-Up"
          : "Complete Callback",

      owner:
        callback.assigned_to ||
        "Unassigned",

      dueDate:
        formatDateTime(
          callback.due_at
        ),

      sortDate:
        callback.due_at
          ? new Date(
              callback.due_at
            ).getTime()
          : Number.MAX_SAFE_INTEGER,
    });
  });

  /* =====================================================
     SORT ACTIONS
  ===================================================== */

  const priorityOrder = {
    High: 1,
    Medium: 2,
    Low: 3,
  };

  actions.sort((a, b) => {
    const priorityDifference =
      (priorityOrder[a.priority] || 2) -
      (priorityOrder[b.priority] || 2);

    if (priorityDifference !== 0) {
      return priorityDifference;
    }

    return a.sortDate - b.sortDate;
  });

  /* =====================================================
     COUNTS
  ===================================================== */

  const counts = {
    all: actions.length,

    overdue:
      actions.filter(
        (item) =>
          item.category === "Overdue"
      ).length,

    dueToday:
      actions.filter(
        (item) =>
          item.category === "Due Today"
      ).length,

    nextAction:
      actions.filter(
        (item) =>
          item.category === "Next Action"
      ).length,

    quote:
      actions.filter(
        (item) =>
          item.category === "Quote"
      ).length,

    material:
      actions.filter(
        (item) =>
          item.category === "Material"
      ).length,

    payment:
      actions.filter(
        (item) =>
          item.category === "Payment"
      ).length,

    callback:
      actions.filter(
        (item) =>
          item.sourceType === "callback"
      ).length,
  };

  return {
    actions,
    counts,
  };
}