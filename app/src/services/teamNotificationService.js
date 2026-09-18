import { supabase } from "../lib/supabase";

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

export async function notifyTeam({
  names = [],
  departments = [],
  title,
  message,
  sourceType = "Customer Order",
  sourceId = null,
  targetPage = "customerOrders",
  priority = "Medium",
}) {
  if (!title) return;

  const { data: profiles, error } = await supabase
    .from("employee_profiles")
    .select("id,display_name,department,is_active")
    .eq("is_active", true);
  if (error) throw error;

  const wantedNames = new Set(names.map(normalize).filter(Boolean));
  const wantedDepartments = new Set(departments.map(normalize).filter(Boolean));
  const recipients = (profiles || []).filter((profile) =>
    wantedNames.has(normalize(profile.display_name)) ||
    wantedDepartments.has(normalize(profile.department))
  );

  const uniqueRecipients = [...new Map(recipients.map((profile) => [profile.id, profile])).values()];
  if (!uniqueRecipients.length) return;

  const { error: insertError } = await supabase.from("notifications").insert(
    uniqueRecipients.map((profile) => ({
      recipient_profile_id: profile.id,
      notification_type: "Workflow",
      title,
      message: message || null,
      source_type: sourceType,
      source_id: sourceId === null || sourceId === undefined ? null : String(sourceId),
      target_page: targetPage,
      priority,
    })),
  );
  if (insertError) throw insertError;
}

