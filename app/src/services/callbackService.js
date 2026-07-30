import { supabase } from "../lib/supabase";
import { createNotificationForAssignedName } from "./notificationService";

export async function getOpenCallbacks() {
  const { data, error } = await supabase
    .from("callbacks")
    .select("*")
    .neq("status", "Completed")
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw error;
  }

  return data || [];
}

export async function createCallback(callback) {
  const { data, error } = await supabase
    .from("callbacks")
    .insert({
      title: callback.title,
      contact_name: callback.contact_name || null,
      company_name: callback.company_name || null,
      phone: callback.phone || null,
      email: callback.email || null,
      callback_type: callback.callback_type || "Callback",
      assigned_to: callback.assigned_to || null,
      due_at: callback.due_at || null,
      priority: callback.priority || "Medium",
      notes: callback.notes || null,
      status: callback.status || "Open",
      customer_id: callback.customer_id || null,
      project_id: callback.project_id || null,
      customer_order_id: callback.customer_order_id || null,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  if (data?.assigned_to) {
    await createNotificationForAssignedName({
      assignedTo: data.assigned_to,
      notificationType: "Callback",
      title: "New Callback Assigned",
      message: `${data.title}${
        data.contact_name ? ` • ${data.contact_name}` : ""
      }${data.phone ? ` • ${data.phone}` : ""}`,
      sourceType: "callback",
      sourceId: data.id,
      targetPage: "callbacks",
      priority: data.priority || "Medium",
    });
  }

  return data;
}

export async function updateCallback(callbackId, updates) {
  const { data, error } = await supabase
    .from("callbacks")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", callbackId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function completeCallback(callbackId, outcomeNotes = "") {
  const { data, error } = await supabase
    .from("callbacks")
    .update({
      status: "Completed",
      outcome_notes: outcomeNotes || null,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", callbackId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

export async function deleteCallback(callbackId) {
  const { error } = await supabase
    .from("callbacks")
    .delete()
    .eq("id", callbackId);

  if (error) {
    throw error;
  }

  return true;
}

export async function promoteCallbackToSiteVisit({
  callbackId,
  siteVisitAt = null,
  assignedTo = "Chad",
  jobAddress = "",
  city = "",
  state = "NC",
  zipCode = "",
  siteNotes = "",
}) {
  if (!callbackId) {
    throw new Error("A callback is required before creating a site visit.");
  }

  const { data, error } = await supabase.rpc(
    "promote_callback_to_site_visit",
    {
      p_callback_id: callbackId,
      p_site_visit_at: siteVisitAt || null,
      p_assigned_to: assignedTo || "Chad",
      p_job_address: jobAddress || null,
      p_city: city || null,
      p_state: state || "NC",
      p_zip_code: zipCode || null,
      p_site_notes: siteNotes || null,
    }
  );

  if (error) {
    throw error;
  }

  const result = Array.isArray(data) ? data[0] : data;

  if (!result?.project_id) {
    throw new Error("The site-visit project was not returned by Supabase.");
  }

  return result;
}

export async function getLinkedProject(projectId) {
  if (!projectId) {
    throw new Error("This callback is not connected to a project.");
  }

  const { data, error } = await supabase
    .from("projects")
    .select("*")
    .eq("id", projectId)
    .single();

  if (error) {
    throw error;
  }

  return data;
}