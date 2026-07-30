import { supabase } from "../lib/supabase";

export const HOT_TODAY_SOURCE_TYPES = {
  PROJECT: "project",
  CUSTOMER_ORDER: "customer_order",
  PRODUCTION_JOB: "production_job",
};

export const HOT_TODAY_PRIORITIES = {
  CRITICAL: "critical",
  HIGH: "high",
  NORMAL: "normal",
};

export const HOT_TODAY_STATUSES = {
  ACTIVE: "active",
  COMPLETED: "completed",
  REMOVED: "removed",
  EXPIRED: "expired",
};

export const HOT_TODAY_MATERIALS_STATUSES = {
  READY: "ready",
  PARTIAL: "partial",
  WAITING: "waiting",
  SHORTAGE: "shortage",
  NOT_REQUIRED: "not_required",
  UNKNOWN: "unknown",
};

const PRIORITY_ORDER = {
  critical: 0,
  high: 1,
  normal: 2,
};

function getEasternDate() {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const values = {};

  parts.forEach((part) => {
    if (part.type !== "literal") {
      values[part.type] = part.value;
    }
  });

  return `${values.year}-${values.month}-${values.day}`;
}

function cleanText(value) {
  if (value === null || value === undefined) {
    return null;
  }

  const cleaned = String(value).trim();
  return cleaned || null;
}

function toIsoDateTime(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return null;
  }

  return parsedDate.toISOString();
}

function sortHotTodayItems(items = []) {
  return [...items].sort((a, b) => {
    const priorityA = PRIORITY_ORDER[a.priority] ?? 99;
    const priorityB = PRIORITY_ORDER[b.priority] ?? 99;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    if (a.due_at && b.due_at) {
      return new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
    }

    if (a.due_at) {
      return -1;
    }

    if (b.due_at) {
      return 1;
    }

    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });
}

function throwSupabaseError(error, fallbackMessage) {
  if (!error) {
    return;
  }

  const enhancedError = new Error(error.message || fallbackMessage);
  enhancedError.code = error.code;
  enhancedError.details = error.details;
  enhancedError.hint = error.hint;

  throw enhancedError;
}

function validateSourceType(sourceType) {
  const validTypes = Object.values(HOT_TODAY_SOURCE_TYPES);

  if (!validTypes.includes(sourceType)) {
    throw new Error(
      `Invalid Hot Today source type. Expected one of: ${validTypes.join(", ")}`
    );
  }
}

function buildCreatePayload(item) {
  const sourceType = cleanText(item.sourceType || item.source_type);
  const sourceId = cleanText(item.sourceId || item.source_id);
  const title = cleanText(item.title);
  const department = cleanText(item.department);
  const reason = cleanText(item.reason);

  validateSourceType(sourceType);

  if (!sourceId) {
    throw new Error("A project, customer order, or production job is required.");
  }

  if (!title) {
    throw new Error("A Hot Today title is required.");
  }

  if (!department) {
    throw new Error("A department is required.");
  }

  if (!reason) {
    throw new Error("A reason for making this item Hot Today is required.");
  }

  return {
    source_type: sourceType,
    source_id: sourceId,
    title,
    customer_name: cleanText(item.customerName || item.customer_name),
    assigned_to: cleanText(item.assignedTo || item.assigned_to),
    assigned_to_name: cleanText(
      item.assignedToName || item.assigned_to_name
    ),
    department,
    reason,
    priority:
      cleanText(item.priority)?.toLowerCase() ||
      HOT_TODAY_PRIORITIES.HIGH,
    notes: cleanText(item.notes),
    due_at: toIsoDateTime(item.dueAt || item.due_at),
    work_date:
      cleanText(item.workDate || item.work_date) || getEasternDate(),
    expires_at: toIsoDateTime(item.expiresAt || item.expires_at),
    status: HOT_TODAY_STATUSES.ACTIVE,
    materials_status:
      cleanText(
        item.materialsStatus || item.materials_status
      )?.toLowerCase() || HOT_TODAY_MATERIALS_STATUSES.UNKNOWN,
    blocker: cleanText(item.blocker),
  };
}

function buildUpdatePayload(updates) {
  const payload = {};

  if ("title" in updates) {
    payload.title = cleanText(updates.title);
  }

  if ("customerName" in updates || "customer_name" in updates) {
    payload.customer_name = cleanText(
      updates.customerName || updates.customer_name
    );
  }

  if ("assignedTo" in updates || "assigned_to" in updates) {
    payload.assigned_to = cleanText(
      updates.assignedTo || updates.assigned_to
    );
  }

  if ("assignedToName" in updates || "assigned_to_name" in updates) {
    payload.assigned_to_name = cleanText(
      updates.assignedToName || updates.assigned_to_name
    );
  }

  if ("department" in updates) {
    payload.department = cleanText(updates.department);
  }

  if ("reason" in updates) {
    payload.reason = cleanText(updates.reason);
  }

  if ("priority" in updates) {
    payload.priority = cleanText(updates.priority)?.toLowerCase();
  }

  if ("notes" in updates) {
    payload.notes = cleanText(updates.notes);
  }

  if ("dueAt" in updates || "due_at" in updates) {
    payload.due_at = toIsoDateTime(updates.dueAt || updates.due_at);
  }

  if ("workDate" in updates || "work_date" in updates) {
    payload.work_date = cleanText(
      updates.workDate || updates.work_date
    );
  }

  if ("expiresAt" in updates || "expires_at" in updates) {
    payload.expires_at = toIsoDateTime(
      updates.expiresAt || updates.expires_at
    );
  }

  if ("materialsStatus" in updates || "materials_status" in updates) {
    payload.materials_status = cleanText(
      updates.materialsStatus || updates.materials_status
    )?.toLowerCase();
  }

  if ("blocker" in updates) {
    payload.blocker = cleanText(updates.blocker);
  }

  return payload;
}

export async function createHotTodayItem(item) {
  const payload = buildCreatePayload(item);

  const { data, error } = await supabase
    .from("hot_today_items")
    .insert(payload)
    .select("*")
    .single();

  throwSupabaseError(error, "Unable to create the Hot Today item.");

  return data;
}

export async function getActiveHotTodayItems(options = {}) {
  let query = supabase.from("active_hot_today").select("*");

  if (options.department && options.department !== "All") {
    query = query.eq("department", options.department);
  }

  if (options.assignedTo) {
    query = query.eq("assigned_to", String(options.assignedTo));
  }

  if (options.sourceType) {
    validateSourceType(options.sourceType);
    query = query.eq("source_type", options.sourceType);
  }

  if (options.workDate) {
    query = query.eq("work_date", options.workDate);
  }

  if (options.materialsStatus) {
    query = query.eq("materials_status", options.materialsStatus);
  }

  if (options.blockedOnly) {
    query = query.eq("is_blocked", true);
  }

  const { data, error } = await query;

  throwSupabaseError(error, "Unable to load active Hot Today items.");

  return sortHotTodayItems(data || []);
}

export async function getTodaysHotTodayItems(options = {}) {
  return getActiveHotTodayItems({
    ...options,
    workDate: options.workDate || getEasternDate(),
  });
}

export async function getHotTodayItemById(id) {
  if (!id) {
    throw new Error("A Hot Today item ID is required.");
  }

  const { data, error } = await supabase
    .from("hot_today_items")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  throwSupabaseError(error, "Unable to load the Hot Today item.");

  return data;
}

export async function getHotTodayItemForSource(
  sourceType,
  sourceId,
  workDate = getEasternDate()
) {
  validateSourceType(sourceType);

  if (!sourceId) {
    throw new Error("A source record ID is required.");
  }

  const { data, error } = await supabase
    .from("hot_today_items")
    .select("*")
    .eq("source_type", sourceType)
    .eq("source_id", String(sourceId))
    .eq("work_date", workDate)
    .neq("status", HOT_TODAY_STATUSES.REMOVED)
    .maybeSingle();

  throwSupabaseError(
    error,
    "Unable to check the source record's Hot Today status."
  );

  return data;
}

export async function isSourceHotToday(
  sourceType,
  sourceId,
  workDate = getEasternDate()
) {
  const item = await getHotTodayItemForSource(
    sourceType,
    sourceId,
    workDate
  );

  return Boolean(
    item &&
      item.status === HOT_TODAY_STATUSES.ACTIVE &&
      new Date(item.expires_at).getTime() > Date.now()
  );
}

export async function updateHotTodayItem(id, updates) {
  if (!id) {
    throw new Error("A Hot Today item ID is required.");
  }

  const payload = buildUpdatePayload(updates);

  if (Object.keys(payload).length === 0) {
    return getHotTodayItemById(id);
  }

  const { data, error } = await supabase
    .from("hot_today_items")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  throwSupabaseError(error, "Unable to update the Hot Today item.");

  return data;
}

export async function completeHotTodayItem(id) {
  if (!id) {
    throw new Error("A Hot Today item ID is required.");
  }

  const { data, error } = await supabase
    .from("hot_today_items")
    .update({
      status: HOT_TODAY_STATUSES.COMPLETED,
    })
    .eq("id", id)
    .select("*")
    .single();

  throwSupabaseError(error, "Unable to complete the Hot Today item.");

  return data;
}

export async function removeHotTodayItem(id, removalReason) {
  if (!id) {
    throw new Error("A Hot Today item ID is required.");
  }

  const cleanedReason = cleanText(removalReason);

  if (!cleanedReason) {
    throw new Error("A removal reason is required.");
  }

  const { data, error } = await supabase
    .from("hot_today_items")
    .update({
      status: HOT_TODAY_STATUSES.REMOVED,
      removal_reason: cleanedReason,
    })
    .eq("id", id)
    .select("*")
    .single();

  throwSupabaseError(error, "Unable to remove the Hot Today item.");

  return data;
}

export async function reactivateHotTodayItem(id, options = {}) {
  if (!id) {
    throw new Error("A Hot Today item ID is required.");
  }

  const payload = {
    status: HOT_TODAY_STATUSES.ACTIVE,
    work_date: options.workDate || getEasternDate(),
    expires_at: options.expiresAt
      ? toIsoDateTime(options.expiresAt)
      : null,
  };

  if ("dueAt" in options) {
    payload.due_at = toIsoDateTime(options.dueAt);
  }

  if ("reason" in options) {
    payload.reason = cleanText(options.reason);
  }

  if ("priority" in options) {
    payload.priority = cleanText(options.priority)?.toLowerCase();
  }

  const { data, error } = await supabase
    .from("hot_today_items")
    .update(payload)
    .eq("id", id)
    .select("*")
    .single();

  throwSupabaseError(error, "Unable to reactivate the Hot Today item.");

  return data;
}

export async function getHotTodayHistory(id) {
  if (!id) {
    throw new Error("A Hot Today item ID is required.");
  }

  const { data, error } = await supabase
    .from("hot_today_history")
    .select("*")
    .eq("hot_today_id", id)
    .order("changed_at", { ascending: false });

  throwSupabaseError(error, "Unable to load Hot Today history.");

  return data || [];
}

export async function getHotTodayArchive(options = {}) {
  let query = supabase
    .from("hot_today_items")
    .select("*")
    .neq("status", HOT_TODAY_STATUSES.ACTIVE)
    .order("updated_at", { ascending: false });

  if (options.department && options.department !== "All") {
    query = query.eq("department", options.department);
  }

  if (options.status) {
    query = query.eq("status", options.status);
  }

  if (options.sourceType) {
    validateSourceType(options.sourceType);
    query = query.eq("source_type", options.sourceType);
  }

  if (options.limit) {
    query = query.limit(options.limit);
  }

  const { data, error } = await query;

  throwSupabaseError(error, "Unable to load the Hot Today archive.");

  return data || [];
}

export async function expireHotTodayItems() {
  const { data, error } = await supabase.rpc(
    "expire_hot_today_items"
  );

  throwSupabaseError(error, "Unable to expire old Hot Today items.");

  return Number(data || 0);
}

export function subscribeToHotTodayChanges(callback) {
  if (typeof callback !== "function") {
    throw new Error("A Hot Today subscription callback is required.");
  }

  const channel = supabase
    .channel(`hot-today-${Date.now()}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "hot_today_items",
      },
      (payload) => callback(payload)
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

export function getHotTodaySourceLabel(sourceType) {
  const labels = {
    [HOT_TODAY_SOURCE_TYPES.PROJECT]: "Project",
    [HOT_TODAY_SOURCE_TYPES.CUSTOMER_ORDER]: "Customer Order",
    [HOT_TODAY_SOURCE_TYPES.PRODUCTION_JOB]: "Production Job",
  };

  return labels[sourceType] || "Work Item";
}

export function getHotTodayPriorityColor(priority) {
  const colors = {
    critical: "red",
    high: "orange",
    normal: "blue",
  };

  return colors[priority] || "gray";
}

export function getHotTodayMaterialsColor(status) {
  const colors = {
    ready: "green",
    partial: "yellow",
    waiting: "orange",
    shortage: "red",
    not_required: "gray",
    unknown: "dark",
  };

  return colors[status] || "gray";
}

export function getHotTodayStatusColor(status) {
  const colors = {
    active: "red",
    completed: "green",
    removed: "gray",
    expired: "dark",
  };

  return colors[status] || "gray";
}

export function getCurrentEasternWorkDate() {
  return getEasternDate();
}