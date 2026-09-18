import { useCallback, useEffect, useMemo, useState } from "react";
import {
  IconBell,
  IconCheck,
  IconChevronRight,
  IconClipboardText,
  IconPhone,
  IconPlus,
  IconTrash,
  IconX,
} from "@tabler/icons-react";

import { supabase } from "../lib/supabase";

const noteStyles = `
  .mw-followups { border-top: 1px solid #313b42; }
  .mw-followups-summary { display:flex; gap:7px; flex-wrap:wrap; padding:10px 12px 0; }
  .mw-followups-summary span { padding:4px 8px; border:1px solid #354149; border-radius:999px; color:#aeb8bf; background:#0b1013; font-size:.62rem; font-weight:800; }
  .mw-followups-summary .overdue { color:#ff7d87; border-color:#74202a; background:#260b0f; }
  .mw-followups-list { display:grid; gap:7px; padding:10px 12px 12px; }
  .mw-followup-row { display:grid; grid-template-columns:auto minmax(0,1fr) auto auto; align-items:center; gap:10px; min-height:54px; padding:8px 10px; border:1px solid #303a41; border-radius:7px; background:#0c1215; }
  .mw-followup-icon { display:grid; place-items:center; width:34px; height:34px; border:1px solid #46525a; border-radius:50%; color:#f21b2d; background:#151c20; }
  .mw-followup-copy { min-width:0; }
  .mw-followup-copy strong { display:block; overflow:hidden; color:#f4f6f7; font-size:.76rem; text-overflow:ellipsis; white-space:nowrap; }
  .mw-followup-copy small { display:block; margin-top:3px; overflow:hidden; color:#8f9ba5; font-size:.62rem; text-overflow:ellipsis; white-space:nowrap; }
  .mw-followup-meta { min-width:115px; text-align:right; }
  .mw-followup-meta b, .mw-followup-meta small { display:block; font-size:.61rem; }
  .mw-followup-meta b { color:#d7dde1; }
  .mw-followup-meta small { margin-top:3px; color:#84919a; }
  .mw-followup-row.overdue { border-left:3px solid #f21b2d; }
  .mw-followup-actions { display:flex; gap:5px; }
  .mw-followup-actions button { display:grid; place-items:center; width:32px; height:32px; border:1px solid #3c4850; border-radius:6px; color:#cbd2d7; background:#171f24; cursor:pointer; }
  .mw-followup-actions button:hover { border-color:#f21b2d; color:#fff; }
  .mw-followup-form { display:grid; grid-template-columns:1.4fr .75fr .75fr 1fr; gap:8px; padding:12px; border-top:1px solid #313b42; background:#0a0f12; }
  .mw-followup-form .wide { grid-column:span 2; }
  .mw-followup-form input, .mw-followup-form select, .mw-followup-form textarea { width:100%; min-height:38px; padding:8px 9px; border:1px solid #3a454d; border-radius:6px; color:#f4f6f7; background:#151c20; font:600 .7rem Arial,sans-serif; }
  .mw-followup-form textarea { grid-column:span 2; min-height:62px; resize:vertical; }
  .mw-followup-form-actions { display:flex; justify-content:flex-end; align-items:end; gap:7px; grid-column:span 2; }
  .mw-followups-error { margin:10px 12px 0; padding:8px 10px; border:1px solid #7f1d28; border-radius:6px; color:#ffadb4; background:#2a0c11; font-size:.68rem; }
  @media (max-width:850px) {
    .mw-followup-row { grid-template-columns:auto minmax(0,1fr) auto; }
    .mw-followup-meta { grid-column:2; text-align:left; }
    .mw-followup-form { grid-template-columns:1fr 1fr; }
    .mw-followup-form .wide, .mw-followup-form textarea, .mw-followup-form-actions { grid-column:span 2; }
  }
`;

function dueLabel(value) {
  if (!value) return "No due date";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "No due date";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function noteIcon(type) {
  if (type === "Callback") return IconPhone;
  if (type === "Reminder") return IconBell;
  return IconClipboardText;
}

export default function PersonalFollowUps({ onOpenProject }) {
  const [notes, setNotes] = useState([]);
  const [profiles, setProfiles] = useState([]);
  const [projects, setProjects] = useState([]);
  const [currentUserId, setCurrentUserId] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ title: "", details: "", note_type: "Task", priority: "Normal", due_at: "", owner_user_id: "", related_project_id: "" });

  const load = useCallback(async () => {
    setError("");
    const { data: sessionData } = await supabase.auth.getSession();
    const userId = sessionData?.session?.user?.id || "";
    setCurrentUserId(userId);
    if (!userId) return;

    const [profileResult, notesResult, profilesResult, projectsResult] = await Promise.all([
      supabase.from("employee_profiles").select("auth_user_id,display_name,access_level,is_active").eq("auth_user_id", userId).maybeSingle(),
      supabase.from("personal_follow_ups").select("*").order("status", { ascending: false }).order("due_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: false }),
      supabase.from("employee_profiles").select("auth_user_id,display_name,access_level,is_active").eq("is_active", true).not("auth_user_id", "is", null).order("display_name"),
      supabase.from("projects").select("id,project_number,project_name,contact_name,status,is_active").eq("is_active", true).order("created_at", { ascending: false }).limit(100),
    ]);

    const loadError = profileResult.error || notesResult.error || profilesResult.error || projectsResult.error;
    if (loadError) {
      setError(loadError.message || "Follow-ups could not be loaded.");
      return;
    }
    const admin = String(profileResult.data?.access_level || "").toLowerCase().includes("admin");
    setIsAdmin(admin);
    setNotes(notesResult.data || []);
    setProfiles(profilesResult.data || []);
    setProjects(projectsResult.data || []);
    setForm((current) => ({ ...current, owner_user_id: current.owner_user_id || userId }));
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNotes = useMemo(() => notes.filter((note) => note.status !== "Completed"), [notes]);
  const now = Date.now();
  const overdueCount = openNotes.filter((note) => note.due_at && new Date(note.due_at).getTime() < now).length;

  async function addNote(event) {
    event.preventDefault();
    if (!form.title.trim() || !form.owner_user_id) return;
    setSaving(true);
    setError("");
    const owner = profiles.find((profile) => profile.auth_user_id === form.owner_user_id);
    const payload = {
      owner_user_id: form.owner_user_id,
      owner_name: owner?.display_name || "Team Member",
      title: form.title.trim(),
      details: form.details.trim() || null,
      note_type: form.note_type,
      priority: form.priority,
      due_at: form.due_at ? new Date(form.due_at).toISOString() : null,
      related_project_id: form.related_project_id ? Number(form.related_project_id) : null,
      created_by: currentUserId,
    };
    const { error: saveError } = await supabase.from("personal_follow_ups").insert(payload);
    setSaving(false);
    if (saveError) { setError(saveError.message); return; }
    setForm((current) => ({ ...current, title: "", details: "", due_at: "", related_project_id: "" }));
    setFormOpen(false);
    load();
  }

  async function completeNote(note) {
    const { error: updateError } = await supabase.from("personal_follow_ups").update({ status: "Completed", completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", note.id);
    if (updateError) setError(updateError.message); else load();
  }

  async function deleteNote(note) {
    if (!window.confirm(`Delete “${note.title}”?`)) return;
    const { error: deleteError } = await supabase.from("personal_follow_ups").delete().eq("id", note.id);
    if (deleteError) setError(deleteError.message); else load();
  }

  return (
    <section className="mc-panel">
      <style>{noteStyles}</style>
      <div className="mc-panel-head">
        <div className="mc-panel-title">
          <IconClipboardText />
          <div><h2>Personal Notes &amp; Follow-Ups</h2><small>Callbacks, reminders, and personal tasks for Chad, Lori, Kory, and Dan</small></div>
        </div>
        <button className="mc-link" type="button" onClick={() => setFormOpen((open) => !open)}>{formOpen ? "Close" : "Add Follow-Up"} ›</button>
      </div>

      {formOpen && (
        <form className="mw-followup-form" onSubmit={addNote}>
          <input className="wide" aria-label="Follow-up title" placeholder="What needs to be done?" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} required />
          <select aria-label="Type" value={form.note_type} onChange={(event) => setForm({ ...form, note_type: event.target.value })}><option>Task</option><option>Callback</option><option>Reminder</option><option>General</option></select>
          <select aria-label="Priority" value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value })}><option>Low</option><option>Normal</option><option>High</option><option>Urgent</option></select>
          <select aria-label="Owner" value={form.owner_user_id} disabled={!isAdmin} onChange={(event) => setForm({ ...form, owner_user_id: event.target.value })}>{profiles.map((profile) => <option key={profile.auth_user_id} value={profile.auth_user_id}>{profile.display_name}</option>)}</select>
          <input type="datetime-local" aria-label="Due date" value={form.due_at} onChange={(event) => setForm({ ...form, due_at: event.target.value })} />
          <select className="wide" aria-label="Related project" value={form.related_project_id} onChange={(event) => setForm({ ...form, related_project_id: event.target.value })}><option value="">No project link</option>{projects.map((project) => <option key={project.id} value={project.id}>{project.project_number || "Project"} — {project.project_name || project.contact_name || "Unnamed"}</option>)}</select>
          <textarea placeholder="Details, phone number, or next step…" value={form.details} onChange={(event) => setForm({ ...form, details: event.target.value })} />
          <div className="mw-followup-form-actions"><button className="mc-button" type="button" onClick={() => setFormOpen(false)}><IconX /> Cancel</button><button className="mc-button primary" type="submit" disabled={saving}><IconPlus /> {saving ? "Saving" : "Save Follow-Up"}</button></div>
        </form>
      )}

      {error && <div className="mw-followups-error">{error}</div>}
      <div className="mw-followups-summary"><span>{openNotes.length} open</span><span className={overdueCount ? "overdue" : ""}>{overdueCount} overdue</span><span>{notes.filter((note) => note.status === "Completed").length} completed</span></div>
      <div className="mw-followups-list">
        {openNotes.length === 0 ? <div className="mc-empty compact">No personal follow-ups are waiting.</div> : openNotes.slice(0, 8).map((note) => {
          const NoteIcon = noteIcon(note.note_type);
          const overdue = note.due_at && new Date(note.due_at).getTime() < now;
          const linkedProject = projects.find((project) => Number(project.id) === Number(note.related_project_id));
          return <div className={`mw-followup-row ${overdue ? "overdue" : ""}`} key={note.id}>
            <span className="mw-followup-icon"><NoteIcon size={17} /></span>
            <span className="mw-followup-copy"><strong>{note.title}</strong><small>{note.details || linkedProject?.project_name || `${note.note_type} · ${note.priority} priority`}</small></span>
            <span className="mw-followup-meta"><b>{note.owner_name}</b><small>{overdue ? "OVERDUE · " : ""}{dueLabel(note.due_at)}</small></span>
            <span className="mw-followup-actions">{linkedProject && <button type="button" title="Open linked project" onClick={() => onOpenProject?.(linkedProject.id)}><IconChevronRight size={17} /></button>}<button type="button" title="Mark completed" onClick={() => completeNote(note)}><IconCheck size={17} /></button><button type="button" title="Delete" onClick={() => deleteNote(note)}><IconTrash size={16} /></button></span>
          </div>;
        })}
      </div>
    </section>
  );
}
