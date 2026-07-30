import { supabase } from "./supabase";

export const SHOP_STATIONS = [
  "Design",
  "Laser",
  "Welding",
  "Prep",
  "Paint/Powder",
  "Assembly",
  "Final QC / Showroom",
];

export const CUSTOMER_ORDER_STATUSES = [
  "New",
  "Design Needed",
  "In Design",
  "Ready for Production",
  "In Laser",
  "In Welding",
  "In Prep",
  "In Paint/Powder",
  "In Assembly",
  "Final QC / Showroom",
  "Ready for Pickup",
  "Ready to Ship",
  "Ready for Installation",
  "On Hold",
  "Completed",
  "Cancelled",
];

export function canonicalStation(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (["design", "in design", "design needed"].includes(normalized)) return "Design";
  if (["laser", "in laser", "ready for laser"].includes(normalized)) return "Laser";
  if (["welding", "weld", "in welding"].includes(normalized)) return "Welding";
  if (["prep", "preparation", "sandblast", "sandblasting", "in prep"].includes(normalized)) return "Prep";
  if (["paint", "powder", "powder coat", "paint/powder", "in paint/powder"].includes(normalized)) return "Paint/Powder";
  if (["assembly", "in assembly"].includes(normalized)) return "Assembly";
  if (["qc", "showroom", "final qc", "final qc / showroom", "quality control"].includes(normalized)) return "Final QC / Showroom";
  return null;
}

export async function releaseCustomerOrder(orderId, station, actor = "") {
  const { data, error } = await supabase.rpc("mw_release_customer_order_to_production", {
    p_customer_order_id: Number(orderId),
    p_start_station: canonicalStation(station),
    p_built_by: String(actor || "").trim() || null,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

export async function startProductionStep(workOrderId, actor = "") {
  const { data, error } = await supabase.rpc("mw_start_work_order", {
    p_work_order_id: Number(workOrderId),
    p_actor: String(actor || "").trim() || null,
  });
  if (error) throw error;
  return data;
}

export async function completeProductionStep(workOrderId, actor = "") {
  const { data, error } = await supabase.rpc("mw_complete_work_order", {
    p_work_order_id: Number(workOrderId),
    p_actor: String(actor || "").trim() || null,
  });
  if (error) throw error;
  return data;
}

export async function releaseProject(projectId, actor = "") {
  const { data, error } = await supabase.rpc("mw_release_project_to_production", {
    p_project_id: Number(projectId),
    p_built_by: String(actor || "").trim() || null,
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}
