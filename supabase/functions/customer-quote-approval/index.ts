import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function clean(value: unknown, max = 500) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function isEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(hash)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return Array.from(bytes).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed." }, 405);

  try {
    const body = await request.json().catch(() => ({}));
    const action = clean(body.action, 40);
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
    if (!supabaseUrl || !serviceRoleKey || !publishableKey) return json({ error: "Approval service is not configured." }, 500);

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    if (action === "create" || action === "revoke") {
      const authorization = request.headers.get("Authorization") || "";
      const callerClient = createClient(supabaseUrl, publishableKey, {
        global: { headers: { Authorization: authorization } },
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      });
      const { data: userData, error: userError } = await callerClient.auth.getUser();
      if (userError || !userData.user) return json({ error: "Employee authentication is required." }, 401);

      const { data: employee, error: employeeError } = await admin
        .from("employee_profiles")
        .select("display_name,is_active")
        .eq("auth_user_id", userData.user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (employeeError) throw employeeError;
      if (!employee) return json({ error: "Active employee access is required." }, 403);

      if (action === "revoke") {
        const approvalId = clean(body.approval_id, 80);
        const { data: revoked, error } = await admin
          .from("customer_quote_approvals")
          .update({ status: "Revoked", revoked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", approvalId)
          .in("status", ["Sent", "Viewed"])
          .select("id")
          .maybeSingle();
        if (error) throw error;
        if (!revoked) return json({ error: "Only an active approval link can be revoked." }, 409);
        await admin.from("customer_quote_approval_events").insert({ approval_id: approvalId, event_type: "Revoked", event_detail: { by: employee.display_name } });
        return json({ approval: revoked });
      }

      const quoteId = Number(body.quote_id);
      if (!Number.isSafeInteger(quoteId) || quoteId <= 0) return json({ error: "A valid quote is required." }, 400);
      const recipientEmail = clean(body.recipient_email, 320);
      if (recipientEmail && !isEmail(recipientEmail)) return json({ error: "Enter a valid customer email address." }, 400);
      const expirationDays = Math.min(60, Math.max(1, Number(body.expiration_days) || 15));

      const [quoteResult, itemResult, imageResult] = await Promise.all([
        admin.from("project_quotes").select("*").eq("id", quoteId).single(),
        admin.from("project_quote_items").select("*").eq("quote_id", quoteId).eq("show_on_pdf", true).order("sort_order"),
        admin.from("project_quote_images").select("id,image_url,caption,image_type,sort_order").eq("quote_id", quoteId).eq("show_on_pdf", true).order("sort_order"),
      ]);
      if (quoteResult.error) throw quoteResult.error;
      if (itemResult.error) throw itemResult.error;
      if (imageResult.error) throw imageResult.error;

      const quote = quoteResult.data;
      const { data: previous } = await admin
        .from("customer_quote_approvals")
        .select("document_version")
        .eq("quote_id", quoteId)
        .order("document_version", { ascending: false })
        .limit(1)
        .maybeSingle();

      const snapshot = {
        company: {
          name: "Metal Worx Inc.",
          address: "1122 Gillespie Street, Fayetteville, NC 28306",
          phone: "(910) 438-9353",
          email: "info@metalworxinc.net",
          website: "www.metalworxinc.net",
          note: "Veteran Owned",
        },
        quote,
        items: itemResult.data || [],
        images: imageResult.data || [],
        frozen_at: new Date().toISOString(),
      };
      const snapshotText = JSON.stringify(snapshot);
      const token = randomToken();
      const now = new Date();
      const expiresAt = new Date(now.getTime() + expirationDays * 86400000).toISOString();

      await admin
        .from("customer_quote_approvals")
        .update({ status: "Revoked", revoked_at: now.toISOString(), updated_at: now.toISOString() })
        .eq("quote_id", quoteId)
        .in("status", ["Sent", "Viewed"]);

      const { data: approval, error: approvalError } = await admin
        .from("customer_quote_approvals")
        .insert({
          quote_id: quoteId,
          project_id: quote.project_id,
          token_hash: await sha256(token),
          document_version: Number(previous?.document_version || 0) + 1,
          document_hash: await sha256(snapshotText),
          document_snapshot: snapshot,
          recipient_email: recipientEmail || quote.contact_email || null,
          status: "Sent",
          expires_at: expiresAt,
          created_by: userData.user.id,
          created_by_name: employee.display_name,
        })
        .select("id,quote_id,document_version,status,expires_at,sent_at,recipient_email")
        .single();
      if (approvalError) throw approvalError;

      await Promise.all([
        admin.from("customer_quote_approval_events").insert({ approval_id: approval.id, event_type: "Sent", event_detail: { by: employee.display_name, recipient_email: recipientEmail || quote.contact_email || null } }),
        admin.from("project_quotes").update({ status: "Sent" }).eq("id", quoteId),
        quote.project_id ? admin.from("projects").update({ quote_status: "Sent" }).eq("id", quote.project_id) : Promise.resolve(),
      ]);
      return json({ approval, token });
    }

    const token = clean(body.token, 200);
    if (!token) return json({ error: "This approval link is incomplete." }, 400);
    const tokenHash = await sha256(token);
    const { data: approval, error: approvalError } = await admin
      .from("customer_quote_approvals")
      .select("*")
      .eq("token_hash", tokenHash)
      .maybeSingle();
    if (approvalError) throw approvalError;
    if (!approval) return json({ error: "This approval link is invalid." }, 404);

    if (["Sent", "Viewed"].includes(approval.status) && new Date(approval.expires_at).getTime() < Date.now()) {
      await admin.from("customer_quote_approvals").update({ status: "Expired", updated_at: new Date().toISOString() }).eq("id", approval.id);
      approval.status = "Expired";
    }

    if (action === "view") {
      if (approval.status === "Sent") {
        const viewedAt = new Date().toISOString();
        await Promise.all([
          admin.from("customer_quote_approvals").update({ status: "Viewed", viewed_at: viewedAt, updated_at: viewedAt }).eq("id", approval.id).eq("status", "Sent"),
          admin.from("customer_quote_approval_events").insert({ approval_id: approval.id, event_type: "Viewed", event_detail: {} }),
        ]);
        approval.status = "Viewed";
        approval.viewed_at = viewedAt;
      }
      const { token_hash: _tokenHash, signature_data_url: _signature, signer_ip: _ip, signer_user_agent: _ua, created_by: _createdBy, ...safeApproval } = approval;
      return json({ approval: safeApproval });
    }

    if (action === "approve") {
      if (!["Sent", "Viewed"].includes(approval.status)) return json({ error: `This quote is ${String(approval.status).toLowerCase()} and cannot be approved again.` }, 409);
      const signerName = clean(body.signer_name, 200);
      const signerEmail = clean(body.signer_email, 320);
      const signature = clean(body.signature_data_url, 500000);
      const accepted = body.accepted === true;
      if (signerName.length < 2) return json({ error: "Enter the full name of the person approving the quote." }, 400);
      if (!isEmail(signerEmail)) return json({ error: "Enter a valid email address." }, 400);
      if (!accepted) return json({ error: "The agreement box must be checked." }, 400);
      if (!signature.startsWith("data:image/png;base64,") || signature.length < 200) return json({ error: "Please add a signature before approving." }, 400);

      const approvedAt = new Date().toISOString();
      const acceptanceText = "I have reviewed this quote, agree to its scope, pricing, payment terms, and conditions, and authorize Metal Worx Inc. to proceed.";
      const forwarded = request.headers.get("x-forwarded-for") || request.headers.get("cf-connecting-ip") || "";
      const { data: updated, error: updateError } = await admin
        .from("customer_quote_approvals")
        .update({
          status: "Approved",
          approved_at: approvedAt,
          signer_name: signerName,
          signer_email: signerEmail,
          signature_data_url: signature,
          acceptance_text: acceptanceText,
          signer_ip: forwarded.split(",")[0].trim().slice(0, 100) || null,
          signer_user_agent: clean(request.headers.get("user-agent"), 500) || null,
          updated_at: approvedAt,
        })
        .eq("id", approval.id)
        .in("status", ["Sent", "Viewed"])
        .select("id,status,approved_at,signer_name,signer_email,document_version,document_hash")
        .maybeSingle();
      if (updateError) throw updateError;
      if (!updated) return json({ error: "This quote was already updated. Refresh the approval page." }, 409);

      await Promise.all([
        admin.from("customer_quote_approval_events").insert({ approval_id: approval.id, event_type: "Approved", event_detail: { signer_name: signerName, signer_email: signerEmail } }),
        admin.from("project_quotes").update({ status: "Approved" }).eq("id", approval.quote_id),
        approval.project_id ? admin.from("projects").update({ quote_status: "Approved" }).eq("id", approval.project_id) : Promise.resolve(),
      ]);
      return json({ approval: updated });
    }

    if (action === "request_changes") {
      if (!["Sent", "Viewed"].includes(approval.status)) return json({ error: "This approval request is no longer open." }, 409);
      const customerMessage = clean(body.customer_message, 3000);
      const signerName = clean(body.signer_name, 200);
      const signerEmail = clean(body.signer_email, 320);
      if (!customerMessage) return json({ error: "Tell Metal Worx what should be changed." }, 400);
      const updatedAt = new Date().toISOString();
      const { error } = await admin.from("customer_quote_approvals").update({ status: "Changes Requested", customer_message: customerMessage, signer_name: signerName || null, signer_email: isEmail(signerEmail) ? signerEmail : null, updated_at: updatedAt }).eq("id", approval.id).in("status", ["Sent", "Viewed"]);
      if (error) throw error;
      await Promise.all([
        admin.from("customer_quote_approval_events").insert({ approval_id: approval.id, event_type: "Changes Requested", event_detail: { customer_message: customerMessage } }),
        admin.from("project_quotes").update({ status: "Ready for Review" }).eq("id", approval.quote_id),
      ]);
      return json({ approval: { id: approval.id, status: "Changes Requested" } });
    }

    return json({ error: "Unknown approval action." }, 400);
  } catch (error) {
    console.error("customer-quote-approval", error);
    return json({ error: error instanceof Error ? error.message : "The approval request could not be completed." }, 500);
  }
});
