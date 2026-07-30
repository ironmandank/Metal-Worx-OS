import { supabase } from "../lib/supabase";

export const PILOT_FEEDBACK_CATEGORIES = [
  "Issue",
  "Improvement",
  "Question",
  "Training",
];

export const PILOT_FEEDBACK_PRIORITIES = [
  "Low",
  "Normal",
  "High",
  "Critical",
];

export const PILOT_FEEDBACK_STATUSES = [
  "Open",
  "Reviewing",
  "In Progress",
  "Resolved",
  "Deferred",
  "Closed",
];

export async function getCurrentEmployeeProfile() {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) throw userError;
  if (!user) return null;

  const { data, error } = await supabase
    .from("employee_profiles")
    .select("*")
    .eq("auth_user_id", user.id)
    .maybeSingle();

  if (error) throw error;

  return data || {
    auth_user_id: user.id,
    display_name: user.email || "Metal Worx Employee",
    email: user.email || null,
  };
}

export async function getPilotFeedback() {
  const { data, error } = await supabase
    .from("pilot_feedback")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function uploadPilotFeedbackScreenshot(file, employeeName) {
  if (!file) return null;

  const extension = file.name?.split(".").pop()?.toLowerCase() || "jpg";
  const safeEmployeeName = (employeeName || "employee")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const filePath = `${safeEmployeeName}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from("pilot-feedback")
    .upload(filePath, file, {
      cacheControl: "3600",
      contentType: file.type || undefined,
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage
    .from("pilot-feedback")
    .getPublicUrl(filePath);

  return {
    path: filePath,
    url: data.publicUrl,
  };
}

export async function createPilotFeedback(values, screenshotFile) {
  const employee = await getCurrentEmployeeProfile();
  const employeeName = employee?.display_name || employee?.email || "Metal Worx Employee";
  const screenshot = screenshotFile
    ? await uploadPilotFeedbackScreenshot(screenshotFile, employeeName)
    : null;

  const { data, error } = await supabase
    .from("pilot_feedback")
    .insert({
      title: values.title.trim(),
      description: values.description.trim(),
      page_name: values.page_name?.trim() || null,
      attempted_action: values.attempted_action?.trim() || null,
      actual_result: values.actual_result?.trim() || null,
      suggested_improvement: values.suggested_improvement?.trim() || null,
      reported_by: employee?.id || null,
      reported_by_name: employeeName,
      category: values.category || "Issue",
      priority: values.priority || "Normal",
      status: "Open",
      blocked_work: Boolean(values.blocked_work),
      screenshot_url: screenshot?.url || null,
      screenshot_path: screenshot?.path || null,
    })
    .select()
    .single();

  if (error) {
    if (screenshot?.path) {
      await supabase.storage.from("pilot-feedback").remove([screenshot.path]);
    }
    throw error;
  }

  return data;
}

export async function updatePilotFeedback(feedbackId, updates) {
  const { data, error } = await supabase
    .from("pilot_feedback")
    .update(updates)
    .eq("id", feedbackId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function resolvePilotFeedback(feedbackId, resolutionNotes) {
  const employee = await getCurrentEmployeeProfile();

  const { data, error } = await supabase.rpc("resolve_pilot_feedback", {
    p_feedback_id: feedbackId,
    p_resolution_notes: resolutionNotes?.trim() || null,
    p_resolved_by: employee?.id || null,
    p_resolved_by_name:
      employee?.display_name || employee?.email || "Metal Worx Employee",
  });

  if (error) throw error;
  return data;
}