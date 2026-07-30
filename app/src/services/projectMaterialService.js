import { supabase } from "../lib/supabase";

import {
  createNotificationForAssignedName,
} from "./notificationService";

function normalizeRequestNumber(value) {
  if (!value) return null;

  return String(value).trim();
}

function normalizeQuantity(value, fallback = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return number;
}

function normalizeMoney(value, fallback = 0) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.round(number * 100) / 100;
}

function normalizeInteger(value, fallback = null) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return fallback;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return fallback;
  }

  return Math.round(number);
}

function calculateQuotedTotal({
  quantity = 1,
  unitCost = 0,
  freightCost = 0,
  taxCost = 0,
  otherCost = 0,
}) {
  const materialSubtotal =
    normalizeQuantity(quantity, 1) *
    normalizeMoney(unitCost, 0);

  return normalizeMoney(
    materialSubtotal +
      normalizeMoney(freightCost, 0) +
      normalizeMoney(taxCost, 0) +
      normalizeMoney(otherCost, 0),
    0
  );
}

function calculateCustomerMaterialPrice({
  quotedTotal = 0,
  markupPercent = 0,
}) {
  const total =
    normalizeMoney(quotedTotal, 0);

  const markup =
    normalizeMoney(markupPercent, 0);

  return normalizeMoney(
    total + total * (markup / 100),
    0
  );
}

function calculatePriceDifference({
  quotedTotal = 0,
  orderedCost = 0,
}) {
  return normalizeMoney(
    normalizeMoney(orderedCost, 0) -
      normalizeMoney(quotedTotal, 0),
    0
  );
}

function buildMaterialNotificationMessage({
  projectNumber,
  projectName,
  itemName,
  quantity,
  dimensions,
  neededBy,
}) {
  const parts = [
    projectNumber ||
      projectName ||
      "Project",

    `${quantity || 1} × ${
      itemName || "Material item"
    }`,
  ];

  if (dimensions) {
    parts.push(dimensions);
  }

  if (neededBy) {
    parts.push(
      `Needed by ${neededBy}`
    );
  }

  return parts.join(" • ");
}

function buildPricingCompleteMessage({
  projectNumber,
  projectName,
  itemName,
  quotedTotal,
  approvalRequired,
}) {
  const parts = [
    projectNumber ||
      projectName ||
      "Project",

    itemName ||
      "Material pricing",

    `Vendor quote: $${normalizeMoney(
      quotedTotal,
      0
    ).toFixed(2)}`,
  ];

  parts.push(
    approvalRequired
      ? "Ready for quote review"
      : "Customer already approved"
  );

  return parts.join(" • ");
}

function buildReadyToOrderMessage({
  projectNumber,
  projectName,
  itemName,
  customerMaterialPrice,
}) {
  const parts = [
    projectNumber ||
      projectName ||
      "Project",

    itemName ||
      "Material item",

    "Ready to order",
  ];

  if (
    normalizeMoney(
      customerMaterialPrice,
      0
    ) > 0
  ) {
    parts.push(
      `Customer price: $${normalizeMoney(
        customerMaterialPrice,
        0
      ).toFixed(2)}`
    );
  }

  return parts.join(" • ");
}

async function getProjectWorkflowInfo(projectId) {
  if (!projectId) {
    return null;
  }

  const {
    data,
    error,
  } = await supabase
    .from("projects")
    .select(`
      id,
      project_number,
      project_name,
      assigned_to,
      intake_owner,
      quote_status,
      approval_status,
      down_payment_required,
      down_payment_status,
      customer_approval_required,
      status,
      is_active
    `)
    .eq("id", projectId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function createProjectMaterialRequest({
  projectId,
  projectNumber = null,
  projectName = "",
  priority = "Normal",
  quantity = 1,
  dimensions = "",
  itemName,
  description = "",
  vendorName = "",
  vendorSource = "",
  assignedTo = "Lori",
  neededBy = null,
  status = "Request Submitted",
  notes = "",
  createdBy = "",
}) {
  if (!projectId) {
    throw new Error(
      "A project is required before a material request can be created."
    );
  }

  if (!itemName?.trim()) {
    throw new Error(
      "Enter an item name for the material request."
    );
  }

  const requestNumber =
    normalizeRequestNumber(
      projectNumber
    )
      ? `${normalizeRequestNumber(
          projectNumber
        )}-MAT-${Date.now()}`
      : `MAT-${Date.now()}`;

  const payload = {
    project_id: projectId,

    request_number:
      requestNumber,

    priority:
      priority || "Normal",

    quantity:
      normalizeQuantity(
        quantity,
        1
      ),

    dimensions:
      dimensions?.trim() ||
      null,

    item_name:
      itemName.trim(),

    description:
      description?.trim() ||
      null,

    vendor_name:
      vendorName?.trim() ||
      null,

    vendor_source:
      vendorSource?.trim() ||
      null,

    assigned_to:
      assignedTo || "Lori",

    needed_by:
      neededBy || null,

    status:
      status ||
      "Request Submitted",

    notes:
      notes?.trim() ||
      null,

    created_by:
      createdBy?.trim() ||
      null,

    quote_complete: false,

    customer_quote_sent: false,

    customer_approved: false,

    unit_cost: 0,

    freight_cost: 0,

    tax_cost: 0,

    other_cost: 0,

    quoted_total: 0,

    markup_percent: 0,

    customer_material_price: 0,

    ordered_cost: 0,

    price_difference: 0,
  };

  const {
    data,
    error,
  } = await supabase
    .from(
      "project_material_requests"
    )
    .insert([payload])
    .select()
    .single();

  if (error) {
    throw error;
  }

  try {
    await createNotificationForAssignedName({
      assignedTo:
        data.assigned_to ||
        "Lori",

      notificationType:
        "Material Request",

      title:
        "New Project Material Request",

      message:
        buildMaterialNotificationMessage({
          projectNumber,
          projectName,

          itemName:
            data.item_name,

          quantity:
            data.quantity,

          dimensions:
            data.dimensions,

          neededBy:
            data.needed_by,
        }),

      sourceType:
        "projectMaterialRequest",

      sourceId:
        data.id,

      targetPage:
        "procurement",

      priority:
        data.priority ===
          "Rush" ||
        data.priority ===
          "High"
          ? "High"
          : "Medium",
    });
  } catch (
    notificationError
  ) {
    console.error(
      "Material request notification error:",
      notificationError
    );
  }

  return data;
}

export async function createProjectMaterialRequests({
  project,
  requests = [],
  createdBy = "",
}) {
  if (!project?.id) {
    throw new Error(
      "A saved project is required before material requests can be created."
    );
  }

  const validRequests =
    (requests || []).filter(
      (request) =>
        request.item_name?.trim() ||
        request.itemName?.trim()
    );

  const createdRequests = [];

  for (
    const request of
    validRequests
  ) {
    const created =
      await createProjectMaterialRequest({
        projectId:
          project.id,

        projectNumber:
          project.project_number ||
          null,

        projectName:
          project.project_name ||
          "",

        priority:
          request.priority ||
          "Normal",

        quantity:
          request.quantity ??
          1,

        dimensions:
          request.dimensions ||
          "",

        itemName:
          request.item_name ||
          request.itemName,

        description:
          request.description ||
          "",

        vendorName:
          request.vendor_name ||
          request.vendorName ||
          "",

        vendorSource:
          request.vendor_source ||
          request.vendorSource ||
          "",

        assignedTo:
          request.assigned_to ||
          request.assignedTo ||
          "Lori",

        neededBy:
          request.needed_by ||
          request.neededBy ||
          null,

        status:
          request.status ||
          "Request Submitted",

        notes:
          request.notes || "",

        createdBy,
      });

    createdRequests.push(
      created
    );
  }

  return createdRequests;
}

export async function getProjectMaterialRequests(
  projectId
) {
  if (!projectId) {
    return [];
  }

  const {
    data,
    error,
  } = await supabase
    .from(
      "project_material_requests"
    )
    .select("*")
    .eq(
      "project_id",
      projectId
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    );

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getOpenProjectMaterialRequests() {
  const {
    data,
    error,
  } = await supabase
    .from(
      "project_material_requests"
    )
    .select(`
      *,
      projects (
        id,
        project_number,
        project_name,
        customer_id,
        assigned_to,
        intake_owner,
        status,
        is_active,
        quote_status,
        approval_status,
        down_payment_required,
        down_payment_status,
        customer_approval_required
      )
    `)
    .not(
      "status",
      "in",
      '("Received","Cancelled")'
    )
    .order(
      "priority",
      {
        ascending: false,
      }
    )
    .order(
      "needed_by",
      {
        ascending: true,
        nullsFirst: false,
      }
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    );

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getMaterialRequestsForAssignee(
  assignedTo
) {
  if (!assignedTo) {
    return [];
  }

  const {
    data,
    error,
  } = await supabase
    .from(
      "project_material_requests"
    )
    .select(`
      *,
      projects (
        id,
        project_number,
        project_name,
        customer_id,
        assigned_to,
        intake_owner,
        status,
        is_active,
        quote_status,
        approval_status,
        down_payment_required,
        down_payment_status,
        customer_approval_required
      )
    `)
    .eq(
      "assigned_to",
      assignedTo
    )
    .not(
      "status",
      "in",
      '("Received","Cancelled")'
    )
    .order(
      "needed_by",
      {
        ascending: true,
        nullsFirst: false,
      }
    )
    .order(
      "created_at",
      {
        ascending: false,
      }
    );

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getPricingNeededMaterialRequests() {
  const {
    data,
    error,
  } = await supabase
    .from(
      "project_material_requests"
    )
    .select(`
      *,
      projects (
        id,
        project_number,
        project_name,
        customer_id,
        assigned_to,
        intake_owner,
        status,
        is_active,
        quote_status,
        approval_status,
        down_payment_required,
        down_payment_status,
        customer_approval_required
      )
    `)
    .eq(
      "quote_complete",
      false
    )
    .not(
      "status",
      "in",
      '("Received","Cancelled")'
    )
    .order(
      "priority",
      {
        ascending: false,
      }
    )
    .order(
      "needed_by",
      {
        ascending: true,
        nullsFirst: false,
      }
    );

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getWaitingApprovalMaterialRequests() {
  const {
    data,
    error,
  } = await supabase
    .from(
      "project_material_requests"
    )
    .select(`
      *,
      projects (
        id,
        project_number,
        project_name,
        customer_id,
        assigned_to,
        intake_owner,
        status,
        is_active,
        quote_status,
        approval_status,
        down_payment_required,
        down_payment_status,
        customer_approval_required
      )
    `)
    .eq(
      "quote_complete",
      true
    )
    .eq(
      "customer_approved",
      false
    )
    .not(
      "status",
      "in",
      '("Received","Cancelled")'
    )
    .order(
      "needed_by",
      {
        ascending: true,
        nullsFirst: false,
      }
    );

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getReadyToOrderMaterialRequests() {
  const {
    data,
    error,
  } = await supabase
    .from(
      "project_material_requests"
    )
    .select(`
      *,
      projects (
        id,
        project_number,
        project_name,
        customer_id,
        assigned_to,
        intake_owner,
        status,
        is_active,
        quote_status,
        approval_status,
        down_payment_required,
        down_payment_status,
        customer_approval_required
      )
    `)
    .eq(
      "quote_complete",
      true
    )
    .eq(
      "customer_approved",
      true
    )
    .eq(
      "ordered",
      false
    )
    .not(
      "status",
      "in",
      '("Received","Cancelled")'
    )
    .order(
      "priority",
      {
        ascending: false,
      }
    )
    .order(
      "needed_by",
      {
        ascending: true,
        nullsFirst: false,
      }
    );

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getOrderedMaterialRequests() {
  const {
    data,
    error,
  } = await supabase
    .from(
      "project_material_requests"
    )
    .select(`
      *,
      projects (
        id,
        project_number,
        project_name,
        customer_id,
        assigned_to,
        intake_owner,
        status,
        is_active,
        quote_status,
        approval_status,
        down_payment_required,
        down_payment_status,
        customer_approval_required
      )
    `)
    .eq(
      "ordered",
      true
    )
    .eq(
      "received",
      false
    )
    .not(
      "status",
      "eq",
      "Cancelled"
    )
    .order(
      "ordered_at",
      {
        ascending: true,
        nullsFirst: false,
      }
    );

  if (error) {
    throw error;
  }

  return data || [];
}

export async function getRecentlyReceivedMaterialRequests(
  days = 7
) {
  const cutoff =
    new Date();

  cutoff.setDate(
    cutoff.getDate() -
      Number(days || 7)
  );

  const {
    data,
    error,
  } = await supabase
    .from(
      "project_material_requests"
    )
    .select(`
      *,
      projects (
        id,
        project_number,
        project_name,
        customer_id,
        assigned_to,
        intake_owner,
        status,
        is_active,
        customer_approval_required
      )
    `)
    .eq(
      "received",
      true
    )
    .gte(
      "received_at",
      cutoff.toISOString()
    )
    .order(
      "received_at",
      {
        ascending: false,
      }
    );

  if (error) {
    throw error;
  }

  return data || [];
}

export async function updateProjectMaterialRequest(
  requestId,
  updates
) {
  if (!requestId) {
    throw new Error(
      "A material request is required."
    );
  }

  const payload = {
    ...updates,
  };

  if (
    Object.prototype.hasOwnProperty.call(
      payload,
      "quantity"
    )
  ) {
    payload.quantity =
      normalizeQuantity(
        payload.quantity,
        0
      );
  }

  if (
    Object.prototype.hasOwnProperty.call(
      payload,
      "quantity_received"
    )
  ) {
    payload.quantity_received =
      normalizeQuantity(
        payload.quantity_received,
        0
      );
  }

  const moneyFields = [
    "unit_cost",
    "freight_cost",
    "tax_cost",
    "other_cost",
    "quoted_total",
    "markup_percent",
    "customer_material_price",
    "ordered_cost",
    "price_difference",
  ];

  for (
    const field of
    moneyFields
  ) {
    if (
      Object.prototype.hasOwnProperty.call(
        payload,
        field
      )
    ) {
      payload[field] =
        normalizeMoney(
          payload[field],
          0
        );
    }
  }

  if (
    Object.prototype.hasOwnProperty.call(
      payload,
      "lead_time_days"
    )
  ) {
    payload.lead_time_days =
      normalizeInteger(
        payload.lead_time_days,
        null
      );
  }

  const {
    data,
    error,
  } = await supabase
    .from(
      "project_material_requests"
    )
    .update(payload)
    .eq(
      "id",
      requestId
    )
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function saveMaterialPricing({
  requestId,
  projectNumber = null,
  projectName = "",
  itemName = "",
  vendorName = "",
  vendorContact = "",
  vendorPhone = "",
  vendorEmail = "",
  quoteDate = null,
  quoteExpiration = null,
  unitCost = 0,
  freightCost = 0,
  taxCost = 0,
  otherCost = 0,
  markupPercent = 0,
  leadTimeDays = null,
  pricingNotes = "",
  completedBy = "",
}) {
  if (!requestId) {
    throw new Error(
      "A material request is required."
    );
  }

  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from(
      "project_material_requests"
    )
    .select("*")
    .eq(
      "id",
      requestId
    )
    .single();

  if (existingError) {
    throw existingError;
  }

  const project =
    await getProjectWorkflowInfo(
      existing.project_id
    );

  const approvalRequired =
    project?.customer_approval_required !== false;

  const quotedTotal =
    calculateQuotedTotal({
      quantity:
        existing.quantity ||
        1,

      unitCost,
      freightCost,
      taxCost,
      otherCost,
    });

  const customerMaterialPrice =
    calculateCustomerMaterialPrice({
      quotedTotal,
      markupPercent,
    });

  const nextStatus =
    approvalRequired
      ? "Waiting Customer Approval"
      : "Ready to Order";

  const updated =
    await updateProjectMaterialRequest(
      requestId,
      {
        vendor_name:
          vendorName?.trim() ||
          null,

        vendor_contact:
          vendorContact?.trim() ||
          null,

        vendor_phone:
          vendorPhone?.trim() ||
          null,

        vendor_email:
          vendorEmail?.trim() ||
          null,

        quote_date:
          quoteDate || null,

        quote_expiration:
          quoteExpiration ||
          null,

        unit_cost:
          unitCost,

        freight_cost:
          freightCost,

        tax_cost:
          taxCost,

        other_cost:
          otherCost,

        quoted_total:
          quotedTotal,

        markup_percent:
          markupPercent,

        customer_material_price:
          customerMaterialPrice,

        lead_time_days:
          leadTimeDays,

        pricing_notes:
          pricingNotes?.trim() ||
          null,

        quote_complete:
          true,

        customer_quote_sent:
          false,

        customer_approved:
          !approvalRequired,

        status:
          nextStatus,
      }
    );

  const effectiveProjectNumber =
    projectNumber ||
    project?.project_number ||
    null;

  const effectiveProjectName =
    projectName ||
    project?.project_name ||
    "";

  try {
    const reviewOwner =
      project?.assigned_to ||
      project?.intake_owner ||
      "Chad";

    await createNotificationForAssignedName({
      assignedTo:
        approvalRequired
          ? reviewOwner
          : updated.assigned_to ||
            "Lori",

      notificationType:
        approvalRequired
          ? "Material Pricing Complete"
          : "Material Ready to Order",

      title:
        approvalRequired
          ? "Material Pricing Complete"
          : "Material Ready to Order",

      message:
        approvalRequired
          ? buildPricingCompleteMessage({
              projectNumber:
                effectiveProjectNumber,

              projectName:
                effectiveProjectName,

              itemName:
                itemName ||
                updated.item_name,

              quotedTotal:
                updated.quoted_total,

              approvalRequired,
            })
          : buildReadyToOrderMessage({
              projectNumber:
                effectiveProjectNumber,

              projectName:
                effectiveProjectName,

              itemName:
                itemName ||
                updated.item_name,

              customerMaterialPrice:
                updated.customer_material_price,
            }),

      sourceType:
        "projectMaterialRequest",

      sourceId:
        updated.id,

      targetPage:
        approvalRequired
          ? "projectDetails"
          : "procurement",

      priority:
        updated.priority ===
          "Rush" ||
        updated.priority ===
          "High"
          ? "High"
          : "Medium",
    });
  } catch (
    notificationError
  ) {
    console.error(
      "Pricing workflow notification error:",
      notificationError
    );
  }

  return updated;
}

export async function markMaterialCustomerQuoteSent(
  requestId
) {
  return updateProjectMaterialRequest(
    requestId,
    {
      customer_quote_sent:
        true,

      status:
        "Waiting Customer Approval",
    }
  );
}

export async function markMaterialCustomerApproved({
  requestId,
  projectNumber = null,
  projectName = "",
  itemName = "",
  customerMaterialPrice = 0,
}) {
  const updated =
    await updateProjectMaterialRequest(
      requestId,
      {
        customer_approved:
          true,

        status:
          "Ready to Order",
      }
    );

  try {
    await createNotificationForAssignedName({
      assignedTo:
        updated.assigned_to ||
        "Lori",

      notificationType:
        "Material Ready to Order",

      title:
        "Material Ready to Order",

      message:
        buildReadyToOrderMessage({
          projectNumber,
          projectName,

          itemName:
            itemName ||
            updated.item_name,

          customerMaterialPrice:
            customerMaterialPrice ||
            updated.customer_material_price,
        }),

      sourceType:
        "projectMaterialRequest",

      sourceId:
        updated.id,

      targetPage:
        "procurement",

      priority:
        updated.priority ===
          "Rush" ||
        updated.priority ===
          "High"
          ? "High"
          : "Medium",
    });
  } catch (
    notificationError
  ) {
    console.error(
      "Ready-to-order notification error:",
      notificationError
    );
  }

  return updated;
}

export async function markMaterialRequestOrdered({
  requestId,
  orderedBy = "",
  purchaseOrder = "",
  vendorInvoice = "",
  orderedCost = 0,
  orderingNotes = "",
}) {
  if (!requestId) {
    throw new Error(
      "A material request is required."
    );
  }

  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from(
      "project_material_requests"
    )
    .select("*")
    .eq(
      "id",
      requestId
    )
    .single();

  if (existingError) {
    throw existingError;
  }

  const finalOrderedCost =
    normalizeMoney(
      orderedCost,
      0
    );

  const difference =
    calculatePriceDifference({
      quotedTotal:
        existing.quoted_total ||
        0,

      orderedCost:
        finalOrderedCost,
    });

  return updateProjectMaterialRequest(
    requestId,
    {
      status:
        "Ordered",

      ordered:
        true,

      ordered_at:
        new Date().toISOString(),

      ordered_by:
        orderedBy || null,

      purchase_order:
        purchaseOrder?.trim() ||
        null,

      vendor_invoice:
        vendorInvoice?.trim() ||
        null,

      ordered_cost:
        finalOrderedCost,

      price_difference:
        difference,

      ordering_notes:
        orderingNotes?.trim() ||
        null,
    }
  );
}

export async function receiveMaterialRequest({
  requestId,
  quantityReceived,
  receivedBy = "",
}) {
  if (!requestId) {
    throw new Error(
      "A material request is required."
    );
  }

  const {
    data: existing,
    error: existingError,
  } = await supabase
    .from(
      "project_material_requests"
    )
    .select("*")
    .eq(
      "id",
      requestId
    )
    .single();

  if (existingError) {
    throw existingError;
  }

  const receivedQuantity =
    normalizeQuantity(
      quantityReceived,
      0
    );

  if (
    receivedQuantity <= 0
  ) {
    throw new Error(
      "Enter a quantity greater than zero."
    );
  }

  const totalReceived =
    normalizeQuantity(
      existing.quantity_received,
      0
    ) + receivedQuantity;

  const fullyReceived =
    totalReceived >=
    normalizeQuantity(
      existing.quantity,
      0
    );

  return updateProjectMaterialRequest(
    requestId,
    {
      quantity_received:
        totalReceived,

      received:
        fullyReceived,

      received_at:
        fullyReceived
          ? new Date().toISOString()
          : existing.received_at,

      received_by:
        receivedBy || null,

      status:
        fullyReceived
          ? "Received"
          : "Partially Received",
    }
  );
}

export async function reopenMaterialPricing(
  requestId
) {
  return updateProjectMaterialRequest(
    requestId,
    {
      quote_complete:
        false,

      customer_quote_sent:
        false,

      customer_approved:
        false,

      status:
        "Pricing Needed",
    }
  );
}

export async function cancelProjectMaterialRequest(
  requestId
) {
  return updateProjectMaterialRequest(
    requestId,
    {
      status:
        "Cancelled",
    }
  );
}

export {
  calculateCustomerMaterialPrice,
  calculatePriceDifference,
  calculateQuotedTotal,
};