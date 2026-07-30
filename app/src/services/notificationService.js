import { supabase } from "../lib/supabase";

export async function getActiveProfiles() {
  const { data, error } = await supabase
    .from("employee_profiles")
    .select("*")
    .eq("is_active", true)
    .order("profile_type", { ascending: true })
    .order("display_name", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function getProfileByName(displayName) {
  if (!displayName) return null;

  const { data, error } = await supabase
    .from("employee_profiles")
    .select("*")
    .ilike("display_name", displayName.trim())
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function createNotificationForProfile({
  recipientProfileId,
  notificationType = "General",
  title,
  message = "",
  sourceType = null,
  sourceId = null,
  targetPage = null,
  priority = "Medium",
}) {
  if (!recipientProfileId || !title) return null;

  const { data, error } = await supabase
    .from("notifications")
    .insert({
      recipient_profile_id: recipientProfileId,
      notification_type: notificationType,
      title,
      message,
      source_type: sourceType,
      source_id: sourceId ? String(sourceId) : null,
      target_page: targetPage,
      priority,
      is_read: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function createNotificationForAssignedName({
  assignedTo,
  notificationType = "General",
  title,
  message = "",
  sourceType = null,
  sourceId = null,
  targetPage = null,
  priority = "Medium",
}) {
  const profile = await getProfileByName(assignedTo);
  if (!profile) return null;

  return createNotificationForProfile({
    recipientProfileId: profile.id,
    notificationType,
    title,
    message,
    sourceType,
    sourceId,
    targetPage,
    priority,
  });
}

export async function createNotificationsForAssignedNames({
  assignedToList = [],
  notificationType = "General",
  title,
  message = "",
  sourceType = null,
  sourceId = null,
  targetPage = null,
  priority = "Medium",
}) {
  const uniqueNames = Array.from(
    new Set((assignedToList || []).filter(Boolean))
  );

  const created = [];

  for (const assignedTo of uniqueNames) {
    const notification = await createNotificationForAssignedName({
      assignedTo,
      notificationType,
      title,
      message,
      sourceType,
      sourceId,
      targetPage,
      priority,
    });

    if (notification) created.push(notification);
  }

  return created;
}

export async function getUnreadNotificationsForName(displayName) {
  const profile = await getProfileByName(displayName);

  if (!profile) {
    return { profile: null, notifications: [] };
  }

  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("recipient_profile_id", profile.id)
    .eq("is_read", false)
    .order("created_at", { ascending: false })
    .limit(25);

  if (error) throw error;

  return {
    profile,
    notifications: data || [],
  };
}

export async function markNotificationRead(notificationId) {
  if (!notificationId) return null;

  const { data, error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("id", notificationId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

export async function markAllNotificationsReadForName(displayName) {
  const profile = await getProfileByName(displayName);
  if (!profile) return true;

  const { error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("recipient_profile_id", profile.id)
    .eq("is_read", false);

  if (error) throw error;
  return true;
}

export async function markNotificationsReadBySource({ sourceType, sourceId }) {
  if (!sourceType || !sourceId) return true;

  const { error } = await supabase
    .from("notifications")
    .update({
      is_read: true,
      read_at: new Date().toISOString(),
    })
    .eq("source_type", sourceType)
    .eq("source_id", String(sourceId))
    .eq("is_read", false);

  if (error) throw error;
  return true;
}