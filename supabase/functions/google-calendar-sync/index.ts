import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "@supabase/supabase-js";

const GOOGLE_AUTH = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN = "https://oauth2.googleapis.com/token";
const GOOGLE_EVENTS = "https://www.googleapis.com/calendar/v3/calendars/primary/events";
const GOOGLE_USERINFO = "https://openidconnect.googleapis.com/v1/userinfo";
const REQUIRED_EMAIL = "kory@metalworxinc.net";
const APP_URL = "https://metalworxinc-os.com";
const encoder = new TextEncoder();
const decoder = new TextDecoder();

const allowedOrigins = new Set([APP_URL, "http://localhost:5173", "http://127.0.0.1:5173"]);

function cors(request: Request) {
  const origin = request.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : APP_URL,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(request: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(request), "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function base64(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function unbase64(value: string) {
  const binary = atob(value);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function tokenKey(secret: string) {
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(`metal-worx-calendar:${secret}`));
  return crypto.subtle.importKey("raw", digest, "AES-GCM", false, ["encrypt", "decrypt"]);
}

async function encrypt(value: string, secret: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await tokenKey(secret);
  const encrypted = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(value));
  return `${base64(iv)}.${base64(new Uint8Array(encrypted))}`;
}

async function decrypt(value: string | null, secret: string) {
  if (!value) return "";
  const [ivPart, dataPart] = value.split(".");
  const key = await tokenKey(secret);
  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv: unbase64(ivPart) }, key, unbase64(dataPart));
  return decoder.decode(decrypted);
}

function randomState() {
  return base64(crypto.getRandomValues(new Uint8Array(32))).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function clean(value: unknown, max = 5000) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function addDays(date: Date, amount: number) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + amount);
  return copy;
}

function googleDateTime(event: any) {
  if (event?.start?.date) {
    const start = new Date(`${event.start.date}T00:00:00`);
    const exclusiveEnd = event.end?.date ? new Date(`${event.end.date}T00:00:00`) : addDays(start, 1);
    return { start_at: start.toISOString(), end_at: new Date(exclusiveEnd.getTime() - 1000).toISOString(), all_day: true };
  }
  return {
    start_at: new Date(event?.start?.dateTime || Date.now()).toISOString(),
    end_at: new Date(event?.end?.dateTime || event?.start?.dateTime || Date.now()).toISOString(),
    all_day: false,
  };
}

function dateOnly(value: string) {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function eventResource(source: any, sourceType = "company_event") {
  const allDay = Boolean(source.all_day);
  const start = allDay ? { date: dateOnly(source.start_at) } : { dateTime: new Date(source.start_at).toISOString(), timeZone: "America/New_York" };
  const end = allDay
    ? { date: dateOnly(addDays(new Date(source.end_at || source.start_at), 1).toISOString()) }
    : { dateTime: new Date(source.end_at || source.start_at).toISOString(), timeZone: "America/New_York" };
  return {
    summary: clean(source.title || source.project_name || source.name || "Metal Worx Event", 500),
    description: clean(source.notes || source.scheduled_notes || "", 8000),
    location: clean(source.location || source.project_location || source.site_address || "", 1000),
    start,
    end,
    extendedProperties: {
      private: {
        mw_source_type: sourceType,
        mw_source_id: String(source.id),
        mw_managed: "true",
      },
    },
  };
}

function projectEvent(project: any, type: "project_site_visit" | "project_install") {
  const siteVisit = type === "project_site_visit";
  const startAt = siteVisit ? project.site_visit_start : (project.install_start || project.install_date);
  const endAt = siteVisit ? project.site_visit_end : project.install_end;
  const projectName = project.project_name || project.name || project.title || project.customer_name || project.project_number || `Project ${project.id}`;
  return {
    id: project.id,
    title: `${siteVisit ? "Site Visit" : "Installation"}: ${projectName}`,
    start_at: startAt,
    end_at: endAt || new Date(new Date(startAt).getTime() + 60 * 60 * 1000).toISOString(),
    all_day: false,
    notes: project.scheduled_notes || project.install_notes || project.site_visit_result_notes || "",
    location: project.location || project.project_location || project.site_address || "",
  };
}

async function googleRequest(url: string, accessToken: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.error?.message || body?.error_description || `Google Calendar returned ${response.status}.`);
  return body;
}

async function getCaller(request: Request, admin: any, supabaseUrl: string, publishableKey: string) {
  const authorization = request.headers.get("Authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const callerClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  const { data, error } = await callerClient.auth.getUser();
  if (error || !data.user) return null;
  const { data: profile } = await admin.from("employee_profiles").select("id,display_name,access_level,is_active").eq("auth_user_id", data.user.id).eq("is_active", true).maybeSingle();
  if (!profile || profile.access_level !== "Administrator") return null;
  return { user: data.user, profile };
}

async function validAccessToken(admin: any, connection: any, clientId: string, clientSecret: string) {
  const expires = connection.token_expires_at ? new Date(connection.token_expires_at).getTime() : 0;
  if (connection.access_token_encrypted && expires > Date.now() + 120000) {
    return decrypt(connection.access_token_encrypted, clientSecret);
  }
  const refreshToken = await decrypt(connection.refresh_token_encrypted, clientSecret);
  if (!refreshToken) throw new Error("Google Calendar must be reconnected because no refresh token is available.");
  const response = await fetch(GOOGLE_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const tokens = await response.json();
  if (!response.ok) throw new Error(tokens.error_description || "Google could not refresh calendar access.");
  const expiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString();
  await admin.from("google_calendar_connections").update({
    access_token_encrypted: await encrypt(tokens.access_token, clientSecret),
    token_expires_at: expiresAt,
    status: "Connected",
    updated_at: new Date().toISOString(),
  }).eq("id", connection.id);
  return tokens.access_token as string;
}

async function upsertLink(admin: any, connectionId: string, sourceType: string, sourceId: string, event: any) {
  const now = new Date().toISOString();
  const { error } = await admin.from("google_calendar_event_links").upsert({
    connection_id: connectionId,
    source_type: sourceType,
    source_id: String(sourceId),
    google_event_id: event.id,
    google_etag: event.etag || null,
    google_updated_at: event.updated || null,
    last_synced_at: now,
    updated_at: now,
  }, { onConflict: "connection_id,source_type,source_id" });
  if (error) throw error;
}

async function syncCalendar(admin: any, connection: any, accessToken: string) {
  const startedAt = new Date().toISOString();
  await admin.from("google_calendar_connections").update({ last_sync_started_at: startedAt, last_sync_status: "Running", last_sync_error: null }).eq("id", connection.id);
  let imported = 0;
  let exported = 0;
  let updated = 0;

  try {
    const timeMin = addDays(new Date(), -30).toISOString();
    let pageToken = "";
    const googleEvents: any[] = [];
    do {
      const query = new URLSearchParams({ singleEvents: "true", showDeleted: "true", maxResults: "2500", timeMin });
      if (pageToken) query.set("pageToken", pageToken);
      const page = await googleRequest(`${GOOGLE_EVENTS}?${query}`, accessToken);
      googleEvents.push(...(page.items || []));
      pageToken = page.nextPageToken || "";
    } while (pageToken);

    const { data: links, error: linksError } = await admin.from("google_calendar_event_links").select("*").eq("connection_id", connection.id);
    if (linksError) throw linksError;
    const linkByGoogle = new Map((links || []).map((link: any) => [link.google_event_id, link]));
    const googleById = new Map(googleEvents.map((event) => [event.id, event]));

    for (const event of googleEvents) {
      const link: any = linkByGoogle.get(event.id);
      const privateProps = event.extendedProperties?.private || {};
      const sourceType = link?.source_type || privateProps.mw_source_type;
      const sourceId = link?.source_id || privateProps.mw_source_id;

      if (sourceType === "project_site_visit" || sourceType === "project_install") {
        if (!sourceId || event.status === "cancelled") continue;
        const times = googleDateTime(event);
        const patch = sourceType === "project_site_visit"
          ? { site_visit_start: times.start_at, site_visit_end: times.end_at }
          : { install_start: times.start_at, install_end: times.end_at };
        const { error } = await admin.from("projects").update(patch).eq("id", sourceId);
        if (error) throw error;
        await upsertLink(admin, connection.id, sourceType, sourceId, event);
        updated += 1;
        continue;
      }

      let local: any = null;
      if (sourceType === "company_event" && sourceId) {
        const result = await admin.from("company_calendar_events").select("*").eq("id", sourceId).maybeSingle();
        if (result.error) throw result.error;
        local = result.data;
      }
      if (!local) {
        const result = await admin.from("company_calendar_events").select("*").eq("google_event_id", event.id).maybeSingle();
        if (result.error) throw result.error;
        local = result.data;
      }

      const now = new Date().toISOString();
      if (event.status === "cancelled") {
        if (local) await admin.from("company_calendar_events").update({ status: "Cancelled", google_sync_status: "Cancelled in Google", google_updated_at: event.updated || now, google_last_synced_at: now }).eq("id", local.id);
        continue;
      }
      const times = googleDateTime(event);
      const payload = {
        title: clean(event.summary || "Google Calendar Event", 500),
        event_type: local?.event_type || "Company Event",
        ...times,
        location: clean(event.location, 1000) || null,
        notes: clean(event.description, 8000) || null,
        status: "Scheduled",
        priority: local?.priority || "Normal",
        google_event_id: event.id,
        google_calendar_id: "primary",
        google_etag: event.etag || null,
        google_updated_at: event.updated || now,
        google_last_synced_at: now,
        google_sync_status: "Synced",
        calendar_source: local?.calendar_source || "google",
      };
      if (local) {
        const localChanged = local.google_last_synced_at && new Date(local.updated_at || 0) > new Date(local.google_last_synced_at);
        const googleChanged = !local.google_updated_at || new Date(event.updated || 0) > new Date(local.google_updated_at);
        if (!localChanged || googleChanged) {
          const { error } = await admin.from("company_calendar_events").update(payload).eq("id", local.id);
          if (error) throw error;
          updated += 1;
        }
        await upsertLink(admin, connection.id, "company_event", local.id, event);
      } else {
        const { data: inserted, error } = await admin.from("company_calendar_events").insert(payload).select("id").single();
        if (error) throw error;
        await upsertLink(admin, connection.id, "company_event", inserted.id, event);
        imported += 1;
      }
    }

    const { data: localEvents, error: localError } = await admin.from("company_calendar_events").select("*").gte("end_at", timeMin).order("start_at");
    if (localError) throw localError;
    for (const local of localEvents || []) {
      const resource = eventResource(local, "company_event");
      if (local.google_event_id) {
        if (local.status === "Cancelled") {
          if (googleById.get(local.google_event_id)?.status !== "cancelled") {
            await googleRequest(`${GOOGLE_EVENTS}/${encodeURIComponent(local.google_event_id)}`, accessToken, { method: "DELETE" });
          }
          await admin.from("company_calendar_events").update({ google_sync_status: "Cancelled", google_last_synced_at: new Date().toISOString() }).eq("id", local.id);
        } else if (!local.google_last_synced_at || new Date(local.updated_at || 0) > new Date(local.google_last_synced_at)) {
          const event = await googleRequest(`${GOOGLE_EVENTS}/${encodeURIComponent(local.google_event_id)}`, accessToken, { method: "PATCH", body: JSON.stringify(resource) });
          await admin.from("company_calendar_events").update({ google_etag: event.etag || null, google_updated_at: event.updated || null, google_last_synced_at: new Date().toISOString(), google_sync_status: "Synced" }).eq("id", local.id);
          await upsertLink(admin, connection.id, "company_event", local.id, event);
          exported += 1;
        }
      } else if (local.status !== "Cancelled") {
        const event = await googleRequest(GOOGLE_EVENTS, accessToken, { method: "POST", body: JSON.stringify(resource) });
        await admin.from("company_calendar_events").update({ google_event_id: event.id, google_calendar_id: "primary", google_etag: event.etag || null, google_updated_at: event.updated || null, google_last_synced_at: new Date().toISOString(), google_sync_status: "Synced" }).eq("id", local.id);
        await upsertLink(admin, connection.id, "company_event", local.id, event);
        exported += 1;
      }
    }

    const { data: projects, error: projectError } = await admin.from("projects").select("*").or(`site_visit_start.gte.${timeMin},install_start.gte.${timeMin}`);
    if (projectError) throw projectError;
    const linksBySource = new Map((links || []).map((link: any) => [`${link.source_type}:${link.source_id}`, link]));
    for (const project of projects || []) {
      for (const sourceType of ["project_site_visit", "project_install"] as const) {
        const source = projectEvent(project, sourceType);
        if (!source.start_at) continue;
        const existing = linksBySource.get(`${sourceType}:${project.id}`);
        const resource = eventResource(source, sourceType);
        const event = existing
          ? await googleRequest(`${GOOGLE_EVENTS}/${encodeURIComponent(existing.google_event_id)}`, accessToken, { method: "PATCH", body: JSON.stringify(resource) })
          : await googleRequest(GOOGLE_EVENTS, accessToken, { method: "POST", body: JSON.stringify(resource) });
        await upsertLink(admin, connection.id, sourceType, project.id, event);
        exported += 1;
      }
    }

    const completedAt = new Date().toISOString();
    await admin.from("google_calendar_connections").update({ last_sync_completed_at: completedAt, last_sync_status: "Completed", last_sync_error: null, updated_at: completedAt }).eq("id", connection.id);
    return { imported, exported, updated, completed_at: completedAt };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Calendar synchronization failed.";
    await admin.from("google_calendar_connections").update({ last_sync_completed_at: new Date().toISOString(), last_sync_status: "Error", last_sync_error: message, updated_at: new Date().toISOString() }).eq("id", connection.id);
    throw error;
  }
}

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: cors(request) });
  const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || "";
  const clientId = Deno.env.get("GOOGLE_CALENDAR_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("GOOGLE_CALENDAR_CLIENT_SECRET") || "";
  const redirectUri = Deno.env.get("GOOGLE_CALENDAR_REDIRECT_URI") || "";
  if (!supabaseUrl || !serviceRoleKey || !publishableKey || !clientId || !clientSecret || !redirectUri) return json(request, { error: "Google Calendar sync is not fully configured." }, 500);
  const admin = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });

  try {
    const url = new URL(request.url);
    const action = request.method === "GET" ? "callback" : clean((await request.json().catch(() => ({})))?.action, 40);

    if (action === "callback") {
      const code = clean(url.searchParams.get("code"), 5000);
      const state = clean(url.searchParams.get("state"), 5000);
      if (!code || !state) return Response.redirect(`${APP_URL}/?calendar=error&reason=missing_oauth_response`, 302);
      const stateHash = await sha256(state);
      const { data: connection } = await admin.from("google_calendar_connections").select("*").eq("provider", "google").eq("oauth_state_hash", stateHash).gt("oauth_state_expires_at", new Date().toISOString()).maybeSingle();
      if (!connection) return Response.redirect(`${APP_URL}/?calendar=error&reason=invalid_oauth_state`, 302);
      const tokenResponse = await fetch(GOOGLE_TOKEN, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code" }),
      });
      const tokens = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(tokens.error_description || "Google authorization failed.");
      const userInfo = await googleRequest(GOOGLE_USERINFO, tokens.access_token);
      const email = clean(userInfo.email, 320).toLowerCase();
      if (email !== REQUIRED_EMAIL) return Response.redirect(`${APP_URL}/?calendar=error&reason=wrong_google_account`, 302);
      const expiresAt = new Date(Date.now() + Number(tokens.expires_in || 3600) * 1000).toISOString();
      const { data: connected, error } = await admin.from("google_calendar_connections").update({
        google_email: email,
        access_token_encrypted: await encrypt(tokens.access_token, clientSecret),
        refresh_token_encrypted: tokens.refresh_token ? await encrypt(tokens.refresh_token, clientSecret) : connection.refresh_token_encrypted,
        token_expires_at: expiresAt,
        granted_scope: tokens.scope || null,
        oauth_state_hash: null,
        oauth_state_expires_at: null,
        status: "Connected",
        connected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }).eq("id", connection.id).select("*").single();
      if (error) throw error;
      const result = await syncCalendar(admin, connected, tokens.access_token);
      return Response.redirect(`${APP_URL}/?page=companyCalendar&calendar=connected&imported=${result.imported}`, 302);
    }

    const caller = await getCaller(request, admin, supabaseUrl, publishableKey);
    if (!caller) return json(request, { error: "An active Administrator login is required." }, 403);
    const { data: connection, error: connectionError } = await admin.from("google_calendar_connections").select("*").eq("provider", "google").maybeSingle();
    if (connectionError) throw connectionError;

    if (action === "status") {
      return json(request, { connection: connection ? { status: connection.status, google_email: connection.google_email, connected_at: connection.connected_at, last_sync_completed_at: connection.last_sync_completed_at, last_sync_status: connection.last_sync_status, last_sync_error: connection.last_sync_error } : null });
    }

    if (action === "authorize") {
      const state = randomState();
      const expires = new Date(Date.now() + 10 * 60 * 1000).toISOString();
      const payload = { provider: "google", status: "Pending", connected_by: caller.user.id, oauth_state_hash: await sha256(state), oauth_state_expires_at: expires, updated_at: new Date().toISOString() };
      const { error } = await admin.from("google_calendar_connections").upsert(payload, { onConflict: "provider" });
      if (error) throw error;
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: "code",
        access_type: "offline",
        prompt: "consent",
        include_granted_scopes: "true",
        scope: "openid email https://www.googleapis.com/auth/calendar.events",
        state,
        login_hint: REQUIRED_EMAIL,
      });
      return json(request, { authorization_url: `${GOOGLE_AUTH}?${params}` });
    }

    if (action === "sync") {
      if (!connection || connection.status !== "Connected") return json(request, { error: "Connect Kory's Google Calendar before syncing." }, 409);
      const accessToken = await validAccessToken(admin, connection, clientId, clientSecret);
      return json(request, { result: await syncCalendar(admin, connection, accessToken) });
    }

    if (action === "disconnect") {
      if (connection) await admin.from("google_calendar_connections").update({ status: "Disconnected", access_token_encrypted: null, refresh_token_encrypted: null, token_expires_at: null, updated_at: new Date().toISOString() }).eq("id", connection.id);
      return json(request, { disconnected: true });
    }

    return json(request, { error: "Unsupported calendar action." }, 400);
  } catch (error) {
    console.error("Google Calendar sync error", error);
    return json(request, { error: error instanceof Error ? error.message : "Google Calendar sync failed." }, 500);
  }
});
