import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

type ChatMessage = { role?: string; content?: string };
type SparkyAction = { type?: string; work_order_id?: number };
type RequestBody = { question?: string; page?: string; history?: ChatMessage[]; action?: SparkyAction; confirmed?: boolean };

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function cleanText(value: unknown, limit = 2000) {
  return typeof value === "string" ? value.trim().slice(0, limit) : "";
}

function normalized(value: unknown) {
  return cleanText(value, 180).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function designToLaserTarget(question: string) {
  const match = question.match(/move\s+(.+?)\s+from\s+(?:the\s+)?design(?:\s+queue)?\s+to\s+(?:the\s+)?laser(?:\s+queue)?/i);
  return match ? cleanText(match[1], 120) : "";
}

function searchTerm(question: string) {
  const ignored = new Set(["what", "where", "when", "which", "show", "find", "help", "with", "this", "that", "item", "project", "order", "job", "manual", "crate", "today", "needs", "attention"]);
  return question.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").split(/\s+/).filter((word) => word.length > 2 && !ignored.has(word)).slice(0, 4).join(" ");
}

function requestedAreas(question: string, page: string) {
  const value = `${question} ${page}`.toLowerCase();
  const areas = new Set<string>();
  if (/inventory|item|crate|bin|stock|quantity|material/.test(value)) areas.add("inventory");
  if (/manual|equipment|troubleshoot|instruction|safety/.test(value)) areas.add("manuals");
  if (/project|outside|install|site visit|field|quote|approval/.test(value)) areas.add("projects");
  if (/production|job|work order|department|queue|laser|design|prep|paint|powder|assembly|qc|due|priority|attention|today/.test(value)) areas.add("production");
  if (/my task|my work|need to complete|assigned to me|follow[- ]?up|reminder|callback/.test(value)) areas.add("personal");
  if (!areas.size) areas.add("production");
  return areas;
}

function builtInAnswer(question: string, context: Record<string, unknown>) {
  const value = question.toLowerCase();
  if (/morning huddle|huddle|tomorrow morning/.test(value)) {
    return "The Morning Huddle already pulls the newest projects, artwork, production workload, site visits, deadlines, and blockers from Metal Worx OS every 30 seconds. Use **Open Updated Huddle** below to review it. Update any incorrect source record first and the Huddle will refresh automatically.";
  }
  if (/quote|estimate|pricing/.test(value)) {
    return "I can take you to Quote Center to prepare an editable draft. Use **Open Quote Drafts** below. The quote will remain a draft until an authorized employee reviews and approves it.";
  }
  if (/artwork|design|photo|image|logo|proof/.test(value)) {
    return "I can open Design Intake so you can connect the artwork and images to the correct order. Use **Add Artwork & Images** below, verify the customer and project, then save the intake.";
  }
  if (/my task|my work|need to complete|assigned to me|follow[- ]?up|reminder|callback/.test(value)) {
    const followUps = Array.isArray(context.my_open_follow_ups) ? context.my_open_follow_ups : [];
    const workOrders = Array.isArray(context.my_assigned_work_orders) ? context.my_assigned_work_orders : [];
    const projects = Array.isArray(context.my_assigned_projects) ? context.my_assigned_projects : [];
    if (!followUps.length && !workOrders.length && !projects.length) return "I do not see any open personal follow-ups, work orders, or projects assigned to your login. Use **Open My Tasks** below to review the task board.";
    return `Your login currently has ${followUps.length} open follow-up${followUps.length === 1 ? "" : "s"}, ${workOrders.length} active work order${workOrders.length === 1 ? "" : "s"}, and ${projects.length} active project${projects.length === 1 ? "" : "s"}. Use **Open My Tasks** below for the full list.`;
  }
  if (/inventory|item|crate|bin|stock|quantity|material/.test(value)) {
    const positions = Array.isArray(context.matching_inventory_positions) ? context.matching_inventory_positions as Record<string, unknown>[] : [];
    if (!positions.length) return "I could not find a matching in-stock inventory position. Check the item wording or open Inventory to verify items currently at zero.";
    return ["Here is what Metal Worx OS currently shows:", ...positions.slice(0, 8).map((item) => `• ${item.item_name || item.item_number || item.sku || "Inventory item"} — ${item.bin_code || item.bin_name || item.location_name || "Location not entered"} — ${item.quantity_on_hand ?? 0} on hand`)].join("\n");
  }
  if (/manual|equipment|troubleshoot|instruction|safety/.test(value)) {
    const manuals = Array.isArray(context.matching_manuals) ? context.matching_manuals as Record<string, unknown>[] : [];
    if (!manuals.length) return "No matching manual is currently stored in the Knowledge Center. Try the equipment manufacturer or a shorter manual title.";
    return ["Matching manuals in the Knowledge Center:", ...manuals.slice(0, 8).map((manual) => `• ${manual.title || manual.file_name || "Manual"}${manual.manufacturer ? ` — ${manual.manufacturer}` : ""}`), "Open the Knowledge Center to view the approved file and follow all safety procedures."] .join("\n");
  }
  if (/project|outside|install|site visit|field/.test(value)) {
    const projects = Array.isArray(context.matching_projects) ? context.matching_projects as Record<string, unknown>[] : [];
    if (!projects.length) return "I could not find a matching active project in Metal Worx OS.";
    return ["Matching active projects:", ...projects.slice(0, 8).map((project) => `• ${project.project_number || "Project"} — ${project.project_name || "Unnamed"} — ${project.status || "Status not entered"}${project.next_action ? ` — Next: ${project.next_action}` : ""}${project.next_action_due ? ` by ${project.next_action_due}` : ""}`)].join("\n");
  }
  const jobs = Array.isArray(context.current_production_jobs) ? context.current_production_jobs as Record<string, unknown>[] : [];
  const workOrders = Array.isArray(context.open_work_orders) ? context.open_work_orders as Record<string, unknown>[] : [];
  if (jobs.length || workOrders.length) return `Metal Worx OS currently shows ${jobs.length} active production job${jobs.length === 1 ? "" : "s"} and ${workOrders.length} open work order${workOrders.length === 1 ? "" : "s"} in this view. Ask about a department, due date, job number, project, inventory item, manual, or your assigned tasks for a narrower answer.`;
  return "I could not find matching operational records. Try a job number, project number, customer order number, inventory item, crate, manual, or ask what is assigned to you.";
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const authorization = request.headers.get("Authorization") || "";

  if (!supabaseUrl || !publishableKey || !serviceRoleKey) return json({ error: "Sparky is missing required Supabase configuration." }, 500);
  if (!authorization.startsWith("Bearer ")) return json({ error: "Please sign in to use Sparky." }, 401);

  try {
    const body = await request.json() as RequestBody;
    const question = cleanText(body.question);
    const page = cleanText(body.page, 80) || "unknown";
    if (!question && !body.action) return json({ error: "Ask Sparky a question first." }, 400);

    const callerClient = createClient(supabaseUrl, publishableKey, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
    const adminClient = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: { user }, error: userError } = await callerClient.auth.getUser();
    if (userError || !user) return json({ error: "Your employee login could not be verified." }, 401);

    const { data: employee, error: employeeError } = await adminClient.from("employee_profiles").select("id,display_name,department,role_title,access_level,is_active").eq("auth_user_id", user.id).eq("is_active", true).maybeSingle();
    if (employeeError) throw employeeError;
    if (!employee) return json({ error: "An active Metal Worx employee profile is required." }, 403);

    if (body.confirmed && body.action?.type === "move_design_to_laser") {
      if (!String(employee.access_level || "").toLowerCase().includes("admin")) return json({ error: "Administrator access is required to release artwork to Laser." }, 403);
      const workOrderId = Number(body.action.work_order_id);
      if (!Number.isInteger(workOrderId) || workOrderId <= 0) return json({ error: "The Design work order is invalid. Ask Sparky to find it again." }, 400);
      const { data: result, error: actionError } = await callerClient.rpc("mw_sparky_move_design_to_laser", {
        p_design_work_order_id: workOrderId,
        p_actor: employee.display_name,
        p_confirmation: "CONFIRM DESIGN TO LASER",
      });
      if (actionError) return json({ error: actionError.message }, 409);
      return json({
        answer: `Done. The Design work was completed and released to ${result?.next_department || "Laser"}. The linked order, production job, progress, and activity history were updated under ${employee.display_name}.`,
        action_executed: true,
        result,
      });
    }

    const requestedCustomer = designToLaserTarget(question);
    if (requestedCustomer) {
      const { data: customers, error: customerError } = await adminClient.from("customers").select("id,first_name,last_name,company_name").eq("is_active", true).limit(500);
      if (customerError) throw customerError;
      const target = normalized(requestedCustomer);
      const matches = (customers || []).filter((customer) => normalized(`${customer.first_name || ""} ${customer.last_name || ""} ${customer.company_name || ""}`).includes(target));
      if (!matches.length) return json({ answer: `I could not find an active customer matching “${requestedCustomer}.” Try the customer’s full name or order number.` });
      const customerIds = matches.map((customer) => customer.id);
      const { data: orders, error: orderError } = await adminClient.from("customer_orders").select("id,order_number,status,design_status,customer_id").in("customer_id", customerIds).is("archived_at", null);
      if (orderError) throw orderError;
      const orderIds = (orders || []).map((order) => order.id);
      if (!orderIds.length) return json({ answer: `I found ${requestedCustomer}, but no active customer order is available to move.` });
      const { data: jobs, error: jobError } = await adminClient.from("production_jobs").select("id,production_job_number,customer_order_id,current_department,status").in("customer_order_id", orderIds).eq("is_active", true);
      if (jobError) throw jobError;
      const jobIds = (jobs || []).map((job) => job.id);
      const { data: workOrders, error: workError } = jobIds.length
        ? await adminClient.from("work_orders").select("id,work_order_number,production_job_id,status,department,step_name").in("production_job_id", jobIds).eq("is_active", true).eq("department", "Design").in("status", ["Ready", "In Progress"])
        : { data: [], error: null };
      if (workError) throw workError;
      const candidates = (workOrders || []).map((workOrder) => {
        const job = (jobs || []).find((item) => item.id === workOrder.production_job_id);
        const order = (orders || []).find((item) => item.id === job?.customer_order_id);
        const customer = matches.find((item) => item.id === order?.customer_id);
        return { workOrder, job, order, customer };
      });
      if (!candidates.length) return json({ answer: `I found ${requestedCustomer}, but there is no Design work currently eligible to release to Laser.` });
      if (candidates.length > 1) return json({ answer: `I found ${candidates.length} eligible Design jobs for ${requestedCustomer}. Tell me the order number so I do not move the wrong artwork.` });
      const candidate = candidates[0];
      const customerName = [candidate.customer?.first_name, candidate.customer?.last_name].filter(Boolean).join(" ") || candidate.customer?.company_name || requestedCustomer;
      return json({
        answer: `I found ${customerName}: order ${candidate.order?.order_number}, Design work order ${candidate.workOrder.work_order_number}. It is currently ${candidate.workOrder.status}. Confirming will record customer approval and the production check, complete Design, release Laser, update progress, and add an audit-history entry.`,
        proposed_action: {
          type: "move_design_to_laser",
          work_order_id: candidate.workOrder.id,
          label: `Confirm ${customerName} — Design to Laser`,
          order_number: candidate.order?.order_number,
          work_order_number: candidate.workOrder.work_order_number,
          requires_admin: true,
        },
      });
    }

    const term = searchTerm(question);
    const areas = requestedAreas(question, page);
    const context: Record<string, unknown> = { current_page: page, current_time: new Date().toISOString() };
    const queries: PromiseLike<{ data: unknown; error: unknown }>[] = [];
    const keys: string[] = [];

    if (areas.has("personal")) {
      queries.push(adminClient.from("personal_follow_ups").select("id,title,note_type,priority,due_at,status,related_project_id").eq("owner_user_id", user.id).eq("status", "Open").order("due_at", { ascending: true, nullsFirst: false }).limit(30));
      keys.push("my_open_follow_ups");
      queries.push(adminClient.from("work_orders").select("id,work_order_number,step_name,department,status,quantity,priority,station_entered_at,project_id").eq("is_active", true).eq("assigned_to", employee.display_name).neq("status", "Completed").order("station_entered_at", { ascending: true }).limit(30));
      keys.push("my_assigned_work_orders");
      queries.push(adminClient.from("projects").select("id,project_number,project_name,status,priority,due_date,next_action,next_action_due,blocked_reason_category,percent_complete").eq("is_active", true).is("archived_at", null).or(`assigned_to.ilike.${employee.display_name},next_action_owner.ilike.${employee.display_name}`).order("next_action_due", { ascending: true, nullsFirst: false }).limit(30));
      keys.push("my_assigned_projects");
    }

    if (areas.has("inventory")) {
      let query = adminClient.from("inventory_bin_balances").select("item_number,sku,item_name,bin_code,bin_name,location_name,quantity_on_hand,quantity_available").gt("quantity_on_hand", 0).order("item_name").limit(20);
      if (term) query = query.or(`item_name.ilike.%${term}%,item_number.ilike.%${term}%,sku.ilike.%${term}%,bin_code.ilike.%${term}%,bin_name.ilike.%${term}%`);
      queries.push(query); keys.push("matching_inventory_positions");
    }
    if (areas.has("manuals")) {
      let query = adminClient.from("knowledge_manuals").select("title,category,manufacturer,description,file_name").order("title").limit(20);
      if (term) query = query.or(`title.ilike.%${term}%,category.ilike.%${term}%,manufacturer.ilike.%${term}%,description.ilike.%${term}%`);
      queries.push(query); keys.push("matching_manuals");
    }
    if (areas.has("projects")) {
      let query = adminClient.from("projects").select("project_number,project_name,project_type,status,priority,due_date,target_completion_date,site_visit_date,install_date,quote_status,approval_status,material_status,fabrication_status,test_fit_status,finish_status,assembly_status,install_status,final_inspection_status,ready_for_install,next_action,next_action_due,blocked_reason_category,percent_complete").eq("is_active", true).is("archived_at", null).order("next_action_due", { ascending: true, nullsFirst: false }).limit(20);
      if (term) query = query.or(`project_number.ilike.%${term}%,project_name.ilike.%${term}%,status.ilike.%${term}%`);
      queries.push(query); keys.push("matching_projects");
    }
    if (areas.has("production")) {
      queries.push(adminClient.from("customer_orders").select("order_number,status,due_date,rush,order_type,design_needed,design_status,starting_department,is_quick_turnaround,quick_turnaround_required_by,fulfillment_method").is("archived_at", null).order("due_date", { ascending: true, nullsFirst: false }).limit(15));
      keys.push("current_customer_orders");
      queries.push(adminClient.from("production_jobs").select("production_job_number,status,current_department,progress_percent,due_date,rush,is_quick_turnaround,quick_turnaround_required_by,quick_turnaround_priority").eq("is_active", true).order("due_date", { ascending: true, nullsFirst: false }).limit(15));
      keys.push("current_production_jobs");
      queries.push(adminClient.from("work_orders").select("work_order_number,step_name,department,step_order,status,quantity,priority,blocked_reason,station_entered_at").eq("is_active", true).neq("status", "Completed").order("station_entered_at", { ascending: true }).limit(20));
      keys.push("open_work_orders");
    }

    const results = await Promise.all(queries);
    results.forEach((result, index) => { context[keys[index]] = result.data || []; });
    const queryErrors = results.map((result) => result.error).filter(Boolean);
    if (queryErrors.length) console.error("Sparky context query warnings", queryErrors);

    return json({ answer: builtInAnswer(question, context), read_only: true, employee: employee.display_name, page, mode: "metal-worx-os" });
  } catch (error) {
    console.error("Sparky assistant error", error);
    return json({ error: error instanceof Error ? error.message : "Sparky encountered an unexpected error." }, 500);
  }
});
