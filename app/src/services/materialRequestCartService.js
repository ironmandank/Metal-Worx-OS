import { supabase } from "../lib/supabase";

export const MATERIAL_REQUEST_SOURCE_TYPES = {
  PROJECT: "project",
  CUSTOMER_ORDER: "customer_order",
  PRODUCTION_JOB: "production_job",
  SHOP_SUPPLY: "shop_supply",
};

export const MATERIAL_REQUEST_PRIORITIES = {
  CRITICAL: "critical",
  HIGH: "high",
  NORMAL: "normal",
};

export const MATERIAL_REQUEST_STATUSES = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  APPROVED: "approved",
  PARTIALLY_FULFILLED: "partially_fulfilled",
  FULFILLED: "fulfilled",
  BLOCKED: "blocked",
  CANCELLED: "cancelled",
};

const SOURCE_TABLES = {
  [MATERIAL_REQUEST_SOURCE_TYPES.PROJECT]: "projects",
  [MATERIAL_REQUEST_SOURCE_TYPES.CUSTOMER_ORDER]:
    "customer_orders",
  [MATERIAL_REQUEST_SOURCE_TYPES.PRODUCTION_JOB]:
    "production_jobs",
};

function cleanText(value, fallback = "") {
  if (value === null || value === undefined) {
    return fallback;
  }

  const cleaned = String(value).trim();
  return cleaned || fallback;
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function firstValue(record, keys, fallback = "") {
  for (const key of keys) {
    const value = record?.[key];

    if (
      value !== null &&
      value !== undefined &&
      String(value).trim() !== ""
    ) {
      return value;
    }
  }

  return fallback;
}

function validateSourceType(sourceType) {
  const validTypes = Object.values(
    MATERIAL_REQUEST_SOURCE_TYPES
  );

  if (!validTypes.includes(sourceType)) {
    throw new Error(
      `Invalid source type. Expected one of: ${validTypes.join(", ")}`
    );
  }
}

function throwSupabaseError(error, fallbackMessage) {
  if (!error) {
    return;
  }

  const enhancedError = new Error(
    error.message || fallbackMessage
  );

  enhancedError.code = error.code;
  enhancedError.details = error.details;
  enhancedError.hint = error.hint;

  throw enhancedError;
}

async function findActiveLabelByField(field, value) {
  const { data, error } = await supabase
    .from("inventory_labels")
    .select(`
      id,
      label_type,
      inventory_item_id,
      bin_id,
      location_id,
      qr_token,
      barcode_value,
      is_active
    `)
    .eq("is_active", true)
    .eq(field, value)
    .limit(1)
    .maybeSingle();

  throwSupabaseError(
    error,
    "Unable to search inventory labels."
  );

  return data || null;
}

async function findInventoryItemByField(field, value) {
  const { data, error } = await supabase
    .from("inventory_item_availability")
    .select("*")
    .eq(field, value)
    .limit(1)
    .maybeSingle();

  throwSupabaseError(
    error,
    "Unable to search inventory items."
  );

  return data || null;
}

export async function getInventoryItemAvailability(
  inventoryItemId
) {
  if (!inventoryItemId) {
    throw new Error("An inventory item ID is required.");
  }

  const { data, error } = await supabase
    .from("inventory_item_availability")
    .select("*")
    .eq("inventory_item_id", inventoryItemId)
    .maybeSingle();

  throwSupabaseError(
    error,
    "Unable to load inventory availability."
  );

  return data || null;
}

export async function getInventoryBrowseItems() {
  const { data, error } = await supabase
    .from("inventory_item_availability")
    .select("*")
    .order("name", { ascending: true });

  throwSupabaseError(
    error,
    "Unable to load inventory items."
  );

  return (data || []).map((item) => ({
    ...item,
    inventory_item_id:
      item.inventory_item_id || item.id,
    browse_label: [
      item.name,
      item.item_number || item.sku,
      `${numberValue(item.quantity_available)} available`,
    ]
      .filter(Boolean)
      .join(" — "),
  }));
}

export async function findInventoryItemByScan(rawValue) {
  const value = cleanText(rawValue);

  if (!value) {
    throw new Error("Scan or enter an inventory code.");
  }

  let label = await findActiveLabelByField(
    "qr_token",
    value
  );

  if (!label) {
    label = await findActiveLabelByField(
      "barcode_value",
      value
    );
  }

  if (label?.inventory_item_id) {
    const item = await getInventoryItemAvailability(
      label.inventory_item_id
    );

    if (item) {
      return {
        item,
        scanValue: value,
        matchedBy:
          label.qr_token === value
            ? "qr_code"
            : "barcode",
        label,
      };
    }
  }

  const directFields = [
    "item_number",
    "sku",
    "manufacturer_part_number",
  ];

  for (const field of directFields) {
    const item = await findInventoryItemByField(
      field,
      value
    );

    if (item) {
      return {
        item,
        scanValue: value,
        matchedBy: field,
        label: null,
      };
    }
  }

  return {
    item: null,
    scanValue: value,
    matchedBy: null,
    label: null,
  };
}

export function buildCartItem(
  inventoryItem,
  quantity = 1,
  scanValue = ""
) {
  if (!inventoryItem) {
    throw new Error("An inventory item is required.");
  }

  const inventoryItemId =
    inventoryItem.inventory_item_id ||
    inventoryItem.id;

  if (!inventoryItemId) {
    throw new Error(
      "The selected inventory item does not have an ID."
    );
  }

  const requestedQuantity = numberValue(
    quantity,
    1
  );

  const availableQuantity = numberValue(
    inventoryItem.quantity_available,
    0
  );

  if (requestedQuantity <= 0) {
    throw new Error(
      "Requested quantity must be greater than zero."
    );
  }

  const shortageQuantity = Math.max(
    requestedQuantity - availableQuantity,
    0
  );

  const stockStatus = cleanText(
    inventoryItem.stock_status,
    "Unknown"
  );

  return {
    inventoryItemId: String(inventoryItemId),

    itemNumber: cleanText(
      inventoryItem.item_number ||
        inventoryItem.sku
    ),

    itemName: cleanText(
      inventoryItem.name,
      "Inventory Item"
    ),

    unitOfMeasure: cleanText(
      inventoryItem.unit_of_measure,
      "each"
    ),

    scanValue: cleanText(scanValue),

    quantity: requestedQuantity,

    quantityOnHand: numberValue(
      inventoryItem.quantity_on_hand,
      0
    ),

    quantityAvailable: availableQuantity,

    shortageQuantity,

    stockStatus,

    lowStock:
      stockStatus === "Low Stock" ||
      stockStatus === "Out of Stock" ||
      shortageQuantity > 0,

    shortage: shortageQuantity > 0,

    defaultBinCode: cleanText(
      inventoryItem.default_bin_code
    ),

    defaultBinName: cleanText(
      inventoryItem.default_bin_name
    ),

    primaryImageUrl: cleanText(
      inventoryItem.primary_image_url
    ),

    notes: "",

    raw: inventoryItem,
  };
}

export function mergeCartItem(
  cartItems,
  incomingItem
) {
  const currentItems = Array.isArray(cartItems)
    ? cartItems
    : [];

  const existingIndex = currentItems.findIndex(
    (item) =>
      String(item.inventoryItemId) ===
      String(incomingItem.inventoryItemId)
  );

  if (existingIndex === -1) {
    return [...currentItems, incomingItem];
  }

  return currentItems.map((item, index) => {
    if (index !== existingIndex) {
      return item;
    }

    const combinedQuantity =
      numberValue(item.quantity) +
      numberValue(incomingItem.quantity);

    const availableQuantity = numberValue(
      incomingItem.quantityAvailable,
      numberValue(item.quantityAvailable)
    );

    const shortageQuantity = Math.max(
      combinedQuantity - availableQuantity,
      0
    );

    return {
      ...item,
      ...incomingItem,

      quantity: combinedQuantity,

      quantityAvailable:
        availableQuantity,

      shortageQuantity,

      shortage:
        shortageQuantity > 0,

      lowStock:
        incomingItem.lowStock ||
        item.lowStock ||
        shortageQuantity > 0,

      notes:
        item.notes ||
        incomingItem.notes ||
        "",
    };
  });
}

export function updateCartItemQuantity(
  cartItems,
  inventoryItemId,
  quantity
) {
  const requestedQuantity =
    numberValue(quantity);

  if (requestedQuantity <= 0) {
    return cartItems.filter(
      (item) =>
        String(item.inventoryItemId) !==
        String(inventoryItemId)
    );
  }

  return cartItems.map((item) => {
    if (
      String(item.inventoryItemId) !==
      String(inventoryItemId)
    ) {
      return item;
    }

    const shortageQuantity = Math.max(
      requestedQuantity -
        numberValue(item.quantityAvailable),
      0
    );

    return {
      ...item,
      quantity: requestedQuantity,
      shortageQuantity,
      shortage:
        shortageQuantity > 0,
      lowStock:
        item.stockStatus === "Low Stock" ||
        item.stockStatus === "Out of Stock" ||
        shortageQuantity > 0,
    };
  });
}

export function getCartSummary(
  cartItems = []
) {
  return cartItems.reduce(
    (summary, item) => {
      summary.itemCount += 1;

      summary.totalQuantity +=
        numberValue(item.quantity);

      if (item.lowStock) {
        summary.lowStockCount += 1;
      }

      if (item.shortage) {
        summary.shortageCount += 1;

        summary.shortageQuantity +=
          numberValue(
            item.shortageQuantity
          );
      }

      return summary;
    },
    {
      itemCount: 0,
      totalQuantity: 0,
      lowStockCount: 0,
      shortageCount: 0,
      shortageQuantity: 0,
      hasLowStock: false,
      hasShortage: false,
    }
  );
}

export function finalizeCartSummary(
  cartItems = []
) {
  const summary =
    getCartSummary(cartItems);

  return {
    ...summary,
    hasLowStock:
      summary.lowStockCount > 0,
    hasShortage:
      summary.shortageCount > 0,
  };
}

export async function getMaterialRequestSourceRecords(
  sourceType
) {
  validateSourceType(sourceType);

  if (
    sourceType ===
    MATERIAL_REQUEST_SOURCE_TYPES.SHOP_SUPPLY
  ) {
    return [
      {
        id: "SHOP-STOCK",
        sourceType:
          MATERIAL_REQUEST_SOURCE_TYPES.SHOP_SUPPLY,
        number: "SHOP-STOCK",
        title:
          "General Shop Supply / Restock",
        customerName:
          "Metal Worx Internal",
        department: "",
        assignedTo: "",
        label:
          "General Shop Supply / Restock",
        raw: null,
      },
    ];
  }

  const table =
    SOURCE_TABLES[sourceType];

  const { data, error } = await supabase
    .from(table)
    .select("*")
    .limit(500);

  throwSupabaseError(
    error,
    `Unable to load ${sourceType.replaceAll(
      "_",
      " "
    )} records.`
  );

  const records = (data || [])
    .map((record) =>
      normalizeMaterialRequestSource(
        record,
        sourceType
      )
    )
    .filter((record) => record.id);

  records.sort((a, b) =>
    a.label.localeCompare(b.label)
  );

  return records;
}

export function normalizeMaterialRequestSource(
  record,
  sourceType
) {
  validateSourceType(sourceType);

  if (
    sourceType ===
    MATERIAL_REQUEST_SOURCE_TYPES.SHOP_SUPPLY
  ) {
    return {
      id: "SHOP-STOCK",
      sourceType:
        MATERIAL_REQUEST_SOURCE_TYPES.SHOP_SUPPLY,
      number: "SHOP-STOCK",
      title:
        "General Shop Supply / Restock",
      customerName:
        "Metal Worx Internal",
      department: "",
      assignedTo: "",
      label:
        "General Shop Supply / Restock",
      raw: record || null,
    };
  }

  const id = String(
    firstValue(record, [
      "id",
      "project_id",
      "order_id",
      "production_job_id",
      "job_id",
    ])
  );

  if (
    sourceType ===
    MATERIAL_REQUEST_SOURCE_TYPES.PROJECT
  ) {
    const number = cleanText(
      firstValue(record, [
        "project_number",
        "work_order_number",
        "job_number",
      ])
    );

    const title = cleanText(
      firstValue(
        record,
        [
          "project_name",
          "name",
          "title",
          "job_name",
        ],
        "Project"
      )
    );

    return {
      id,
      sourceType,
      number,
      title,

      customerName: cleanText(
        firstValue(record, [
          "customer_name",
          "customer",
          "client_name",
          "contact_name",
        ])
      ),

      department: cleanText(
        firstValue(record, [
          "department",
          "current_department",
        ])
      ),

      assignedTo: cleanText(
        firstValue(record, [
          "assigned_to",
          "assigned_to_name",
          "employee_name",
        ])
      ),

      label:
        [number, title]
          .filter(Boolean)
          .join(" — ") ||
        `Project ${id}`,

      raw: record,
    };
  }

  if (
    sourceType ===
    MATERIAL_REQUEST_SOURCE_TYPES.CUSTOMER_ORDER
  ) {
    const number = cleanText(
      firstValue(record, [
        "order_number",
        "order_no",
        "work_order_number",
        "job_number",
      ])
    );

    const title = cleanText(
      firstValue(
        record,
        [
          "order_name",
          "title",
          "description",
          "customer_name",
        ],
        "Customer Order"
      )
    );

    return {
      id,
      sourceType,
      number,
      title,

      customerName: cleanText(
        firstValue(record, [
          "customer_name",
          "customer",
          "client_name",
          "contact_name",
        ])
      ),

      department: cleanText(
        firstValue(record, [
          "department",
          "current_department",
        ])
      ),

      assignedTo: cleanText(
        firstValue(record, [
          "assigned_to",
          "assigned_to_name",
          "employee_name",
        ])
      ),

      label:
        [number, title]
          .filter(Boolean)
          .join(" — ") ||
        `Customer Order ${id}`,

      raw: record,
    };
  }

  const number = cleanText(
    firstValue(record, [
      "job_number",
      "production_number",
      "work_order_number",
      "order_number",
    ])
  );

  const title = cleanText(
    firstValue(
      record,
      [
        "job_name",
        "title",
        "description",
        "product_name",
      ],
      "Production Job"
    )
  );

  return {
    id,
    sourceType,
    number,
    title,

    customerName: cleanText(
      firstValue(record, [
        "customer_name",
        "customer",
        "client_name",
      ])
    ),

    department: cleanText(
      firstValue(record, [
        "department",
        "current_department",
        "current_stage",
        "station",
      ])
    ),

    assignedTo: cleanText(
      firstValue(record, [
        "assigned_to",
        "assigned_to_name",
        "employee_name",
      ])
    ),

    label:
      [number, title]
        .filter(Boolean)
        .join(" — ") ||
      `Production Job ${id}`,

    raw: record,
  };
}

export async function submitMaterialRequestCart({
  source,
  requestedBy = "",
  department = "",
  priority =
    MATERIAL_REQUEST_PRIORITIES.NORMAL,
  isPriorityWork = false,
  blockedWork = false,
  neededBy = null,
  notes = "",
  items = [],
}) {
  if (!source?.id || !source?.sourceType) {
    throw new Error(
      "Select a project, customer order, production job, or Shop Supply request."
    );
  }

  validateSourceType(
    source.sourceType
  );

  if (
    !Array.isArray(items) ||
    items.length === 0
  ) {
    throw new Error(
      "Add at least one inventory item to the request cart."
    );
  }

  const invalidItem = items.find(
    (item) =>
      !item.inventoryItemId ||
      numberValue(item.quantity) <= 0
  );

  if (invalidItem) {
    throw new Error(
      "Every cart item requires a valid inventory item and quantity."
    );
  }

  const cartItems = items.map(
    (item) => ({
      inventory_item_id:
        item.inventoryItemId,

      quantity:
        numberValue(item.quantity),

      unit_of_measure:
        cleanText(
          item.unitOfMeasure,
          "each"
        ),

      scan_value:
        cleanText(item.scanValue) ||
        null,

      notes:
        cleanText(item.notes) ||
        null,
    })
  );

  const { data, error } =
    await supabase.rpc(
      "mw_submit_material_request_cart",
      {
        p_source_type:
          source.sourceType,

        p_source_id:
          String(source.id),

        p_source_number:
          cleanText(source.number) ||
          null,

        p_source_title:
          cleanText(source.title) ||
          null,

        p_customer_name:
          cleanText(
            source.customerName
          ) || null,

        p_requested_by:
          cleanText(requestedBy) ||
          null,

        p_department:
          cleanText(
            department ||
              source.department
          ) || null,

        p_priority:
          cleanText(priority)
            .toLowerCase() ||
          MATERIAL_REQUEST_PRIORITIES.NORMAL,

        p_is_priority_work:
          Boolean(isPriorityWork),

        p_blocked_work:
          Boolean(blockedWork),

        p_needed_by: neededBy
          ? new Date(
              neededBy
            ).toISOString()
          : null,

        p_notes:
          cleanText(notes) ||
          null,

        p_items: cartItems,
      }
    );

  throwSupabaseError(
    error,
    "Unable to submit the material request."
  );

  return data;
}

export async function getMaterialRequestDashboard(
  options = {}
) {
  let query = supabase
    .from("material_request_dashboard")
    .select("*")
    .order("created_at", {
      ascending: false,
    });

  if (options.status) {
    query = query.eq(
      "status",
      options.status
    );
  }

  if (
    options.department &&
    options.department !== "All"
  ) {
    query = query.eq(
      "department",
      options.department
    );
  }

  if (options.priority) {
    query = query.eq(
      "priority",
      options.priority
    );
  }

  if (options.sourceType) {
    query = query.eq(
      "source_type",
      options.sourceType
    );
  }

  if (options.priorityOnly) {
    query = query.eq(
      "is_priority_work",
      true
    );
  }

  if (options.blockedOnly) {
    query = query.eq(
      "blocked_work",
      true
    );
  }

  if (options.limit) {
    query = query.limit(
      options.limit
    );
  }

  const { data, error } =
    await query;

  throwSupabaseError(
    error,
    "Unable to load material requests."
  );

  return data || [];
}

export async function getMaterialRequestById(
  materialRequestId
) {
  if (!materialRequestId) {
    throw new Error(
      "A material request ID is required."
    );
  }

  const [
    requestResult,
    itemsResult,
    historyResult,
  ] = await Promise.all([
    supabase
      .from(
        "material_request_dashboard"
      )
      .select("*")
      .eq(
        "id",
        materialRequestId
      )
      .maybeSingle(),

    supabase
      .from(
        "material_request_item_availability"
      )
      .select("*")
      .eq(
        "material_request_id",
        materialRequestId
      )
      .order("created_at", {
        ascending: true,
      }),

    supabase
      .from(
        "material_request_history"
      )
      .select("*")
      .eq(
        "material_request_id",
        materialRequestId
      )
      .order("created_at", {
        ascending: false,
      }),
  ]);

  throwSupabaseError(
    requestResult.error,
    "Unable to load the material request."
  );

  throwSupabaseError(
    itemsResult.error,
    "Unable to load material request items."
  );

  throwSupabaseError(
    historyResult.error,
    "Unable to load material request history."
  );

  return {
    request:
      requestResult.data ||
      null,

    items:
      itemsResult.data ||
      [],

    history:
      historyResult.data ||
      [],
  };
}

export async function updateMaterialRequestStatus(
  materialRequestId,
  status,
  employeeName = "",
  details = {}
) {
  if (!materialRequestId) {
    throw new Error(
      "A material request ID is required."
    );
  }

  const validStatuses =
    Object.values(
      MATERIAL_REQUEST_STATUSES
    );

  if (
    !validStatuses.includes(status)
  ) {
    throw new Error(
      `Invalid request status: ${status}`
    );
  }

  const { data, error } =
    await supabase
      .from("material_requests")
      .update({ status })
      .eq(
        "id",
        materialRequestId
      )
      .select("*")
      .single();

  throwSupabaseError(
    error,
    "Unable to update the material request."
  );

  const {
    error: historyError,
  } = await supabase
    .from(
      "material_request_history"
    )
    .insert({
      material_request_id:
        materialRequestId,

      action: status,

      employee_name:
        cleanText(employeeName) ||
        null,

      details:
        details || {},
    });

  throwSupabaseError(
    historyError,
    "The request changed, but its history could not be recorded."
  );

  return data;
}

export async function updateMaterialRequestItem({
  itemId,
  quantityAllocated,
  quantityFulfilled,
  status,
  notes,
}) {
  if (!itemId) {
    throw new Error(
      "A material request item ID is required."
    );
  }

  const payload = {};

  if (
    quantityAllocated !== undefined
  ) {
    payload.quantity_allocated =
      Math.max(
        numberValue(
          quantityAllocated
        ),
        0
      );
  }

  if (
    quantityFulfilled !== undefined
  ) {
    payload.quantity_fulfilled =
      Math.max(
        numberValue(
          quantityFulfilled
        ),
        0
      );
  }

  if (status) {
    payload.status = status;
  }

  if (notes !== undefined) {
    payload.notes =
      cleanText(notes) ||
      null;
  }

  const { data, error } =
    await supabase
      .from(
        "material_request_items"
      )
      .update(payload)
      .eq("id", itemId)
      .select("*")
      .single();

  throwSupabaseError(
    error,
    "Unable to update the requested inventory item."
  );

  return data;
}

export function subscribeToMaterialRequestChanges(
  callback
) {
  if (
    typeof callback !== "function"
  ) {
    throw new Error(
      "A material request subscription callback is required."
    );
  }

  const channel = supabase
    .channel(
      `material-requests-${Date.now()}`
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table:
          "material_requests",
      },
      callback
    )
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table:
          "material_request_items",
      },
      callback
    )
    .subscribe();

  return () => {
    supabase.removeChannel(
      channel
    );
  };
}

export function getMaterialRequestPriorityColor(
  priority
) {
  const colors = {
    critical: "red",
    high: "orange",
    normal: "blue",
  };

  return colors[priority] || "gray";
}

export function getMaterialRequestStatusColor(
  status
) {
  const colors = {
    draft: "gray",
    submitted: "blue",
    approved: "cyan",
    partially_fulfilled:
      "yellow",
    fulfilled: "green",
    blocked: "red",
    cancelled: "gray",
  };

  return colors[status] || "gray";
}

export function getMaterialRequestSourceLabel(
  sourceType
) {
  const labels = {
    project: "Project",
    customer_order:
      "Customer Order",
    production_job:
      "Production Job",
    shop_supply:
      "Shop Supply / Restock",
  };

  return (
    labels[sourceType] ||
    "Work Item"
  );
}